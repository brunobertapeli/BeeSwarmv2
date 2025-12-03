import { ipcMain, safeStorage, WebContents } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { execSync } from 'child_process'
import { deploymentService, DeploymentProvider } from '../services/DeploymentService.js'
import { databaseService } from '../services/DatabaseService.js'
import { envService } from '../services/EnvService.js'

// Helper to get current git HEAD commit hash
const getHeadCommit = (projectPath: string): string | null => {
  try {
    const result = execSync('git rev-parse HEAD', {
      cwd: projectPath,
      encoding: 'utf-8',
      timeout: 5000
    }).trim()
    return result || null
  } catch (error) {
    console.warn('Failed to get HEAD commit:', error)
    return null
  }
}

// Store reference to main window for sending events
let mainWindowContents: WebContents | null = null

export function setDeploymentMainWindow(webContents: WebContents) {
  mainWindowContents = webContents
}

// Store deployment tokens in a JSON file in user data directory
// This is global (not project-specific)
const getTokensFilePath = () => {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'deployment-tokens.json')
}

interface DeploymentTokens {
  [serviceId: string]: {
    encrypted: string
    isFallback: boolean
  }
}

const readTokensFile = (): DeploymentTokens => {
  try {
    const filePath = getTokensFilePath()
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (error) {
    console.error('Error reading deployment tokens file:', error)
  }
  return {}
}

const writeTokensFile = (tokens: DeploymentTokens): void => {
  try {
    const filePath = getTokensFilePath()
    fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), 'utf-8')
  } catch (error) {
    console.error('Error writing deployment tokens file:', error)
    throw error
  }
}

export function registerDeploymentHandlers() {
  // Save a deployment token (encrypted)
  ipcMain.handle('deployment:save-token', async (_event, serviceId: string, token: string) => {
    try {
      let encrypted: string
      let isFallback = false

      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('⚠️  Encryption not available for deployment token, using base64 fallback')
        encrypted = Buffer.from(token).toString('base64')
        isFallback = true
      } else {
        const buffer = safeStorage.encryptString(token)
        encrypted = buffer.toString('base64')
      }

      const tokens = readTokensFile()
      tokens[serviceId] = { encrypted, isFallback }
      writeTokensFile(tokens)

      console.log(`✅ Deployment token saved for ${serviceId}`)
      return { success: true }
    } catch (error: any) {
      console.error(`Error saving deployment token for ${serviceId}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Get a deployment token (decrypted)
  ipcMain.handle('deployment:get-token', async (_event, serviceId: string) => {
    try {
      const tokens = readTokensFile()
      const tokenData = tokens[serviceId]

      if (!tokenData) {
        return { success: true, token: null, connected: false }
      }

      let decrypted: string

      if (tokenData.isFallback) {
        decrypted = Buffer.from(tokenData.encrypted, 'base64').toString('utf-8')
      } else {
        try {
          const buffer = Buffer.from(tokenData.encrypted, 'base64')
          decrypted = safeStorage.decryptString(buffer)
        } catch (decryptError) {
          console.error('Failed to decrypt deployment token:', decryptError)
          return { success: false, error: 'Failed to decrypt token' }
        }
      }

      return { success: true, token: decrypted, connected: true }
    } catch (error: any) {
      console.error(`Error getting deployment token for ${serviceId}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Check if a deployment service is connected (has token)
  ipcMain.handle('deployment:is-connected', async (_event, serviceId: string) => {
    try {
      const tokens = readTokensFile()
      const connected = !!tokens[serviceId]
      return { success: true, connected }
    } catch (error: any) {
      console.error(`Error checking deployment connection for ${serviceId}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Get all connected services
  ipcMain.handle('deployment:get-connected-services', async () => {
    try {
      const tokens = readTokensFile()
      const connectedServices = Object.keys(tokens)
      return { success: true, services: connectedServices }
    } catch (error: any) {
      console.error('Error getting connected services:', error)
      return { success: false, error: error.message }
    }
  })

  // Disconnect a deployment service (remove token)
  ipcMain.handle('deployment:disconnect', async (_event, serviceId: string) => {
    try {
      const tokens = readTokensFile()
      delete tokens[serviceId]
      writeTokensFile(tokens)
      console.log(`✅ Deployment token removed for ${serviceId}`)
      return { success: true }
    } catch (error: any) {
      console.error(`Error disconnecting ${serviceId}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Get CLI status for all deployment services
  ipcMain.handle('deployment:get-cli-status', async () => {
    try {
      const status = await deploymentService.getStatus()
      return { success: true, status }
    } catch (error: any) {
      console.error('Error getting CLI status:', error)
      return { success: false, error: error.message }
    }
  })

  // Check if a specific provider CLI is available
  ipcMain.handle('deployment:is-cli-available', async (_event, provider: DeploymentProvider) => {
    try {
      const available = deploymentService.isProviderAvailable(provider)
      return { success: true, available }
    } catch (error: any) {
      console.error(`Error checking CLI availability for ${provider}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Deploy project to a provider
  ipcMain.handle('deployment:deploy', async (_event, projectId: string, provider: DeploymentProvider) => {
    try {
      console.log(`🚀 [DEPLOY] Starting deployment for project ${projectId} to ${provider}`)

      // Send progress event helper
      const sendProgress = (message: string) => {
        console.log(`📤 [DEPLOY] Progress: ${message}`)
        if (mainWindowContents && !mainWindowContents.isDestroyed()) {
          mainWindowContents.send('deployment:progress', projectId, message)
        }
      }

      // 1. Get project data
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return { success: false, error: 'Project not found' }
      }

      sendProgress(`Starting deployment to ${provider}...`)

      // 2a. Emit deployment:started event for StatusSheet
      if (mainWindowContents && !mainWindowContents.isDestroyed()) {
        mainWindowContents.send('deployment:started', projectId, provider, project.name)
      }

      // 2. Get token for provider
      const tokens = readTokensFile()
      const tokenData = tokens[provider]
      if (!tokenData) {
        return { success: false, error: `No token found for ${provider}. Please connect in Settings.` }
      }

      let token: string
      if (tokenData.isFallback) {
        token = Buffer.from(tokenData.encrypted, 'base64').toString('utf-8')
      } else {
        try {
          const buffer = Buffer.from(tokenData.encrypted, 'base64')
          token = safeStorage.decryptString(buffer)
        } catch (decryptError) {
          console.error('Failed to decrypt deployment token:', decryptError)
          return { success: false, error: 'Failed to decrypt token' }
        }
      }

      // 3. Get environment variables from project's .env files
      const envVars: Record<string, string> = {}

      if (project.envFiles) {
        try {
          const envFilesConfig = JSON.parse(project.envFiles)
          const envFilesData = envService.readProjectEnvFiles(project.path, envFilesConfig)

          // Flatten all env vars from all files
          for (const envFile of envFilesData) {
            for (const [key, value] of Object.entries(envFile.variables)) {
              if (value && value.trim()) {
                envVars[key] = value
              }
            }
          }
        } catch (error) {
          console.error('Error reading env files:', error)
          // Continue without env vars
        }
      }

      sendProgress(`Found ${Object.keys(envVars).length} environment variables`)

      // 4. Get existing deployment ID
      const existingId = databaseService.getDeploymentId(projectId, provider)

      // 5. Deploy
      const result = await deploymentService.deploy(
        provider,
        project.path,
        project.name,
        token,
        envVars,
        existingId,
        sendProgress
      )

      // 6. Save deployment ID if new
      if (result.success) {
        if (provider === 'netlify' && result.siteId) {
          databaseService.saveDeploymentId(projectId, 'netlify', result.siteId)
        } else if (provider === 'railway' && result.projectId) {
          databaseService.saveDeploymentId(projectId, 'railway', result.projectId)
        }

        // Save live URL
        if (result.url) {
          databaseService.saveLiveUrl(projectId, result.url)
        }

        // 6a. Save deployed commit hash
        const commitHash = getHeadCommit(project.path)
        if (commitHash) {
          databaseService.saveDeployedCommit(projectId, commitHash)
          sendProgress(`📌 Deployed commit: ${commitHash.substring(0, 7)}`)
        }
      }

      // 7. Send completion event
      if (mainWindowContents && !mainWindowContents.isDestroyed()) {
        mainWindowContents.send('deployment:complete', projectId, result)
      }

      return result
    } catch (error: any) {
      console.error(`Error deploying to ${provider}:`, error)
      return { success: false, error: error.message }
    }
  })

  // Initialize deployment service and log CLI status on startup
  console.log('🚀 Initializing Deployment Service...')
  deploymentService.init().then(status => {
    console.log('='.repeat(50))
    console.log('DEPLOYMENT CLI STATUS')
    console.log('='.repeat(50))

    if (status.railway.available) {
      console.log(`✅ Railway CLI ready: ${status.railway.version}`)
    } else {
      console.log(`❌ Railway CLI not available: ${status.railway.error}`)
    }

    if (status.netlify.available) {
      console.log(`✅ Netlify CLI ready: ${status.netlify.version}`)
    } else {
      console.log(`❌ Netlify CLI not available: ${status.netlify.error}`)
    }

    console.log('='.repeat(50))
  }).catch(err => {
    console.error('❌ Deployment service initialization failed:', err)
  })
}
