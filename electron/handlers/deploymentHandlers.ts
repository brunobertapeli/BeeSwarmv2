import { ipcMain, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { deploymentService, DeploymentProvider } from '../services/DeploymentService.js'

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
