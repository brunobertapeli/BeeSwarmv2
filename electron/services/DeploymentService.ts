/**
 * DeploymentService
 * Manages CLI paths and deployment operations for Railway and Netlify
 */

import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'

export interface DeployResult {
  success: boolean
  url?: string
  siteId?: string // For Netlify
  projectId?: string // For Railway
  error?: string
}

/**
 * Get the application root directory
 * In dev: /Users/.../BeeSwarmv2
 * In production: varies by platform
 */
function getAppRoot(): string {
  if (app.isPackaged) {
    // Production: app.getAppPath() returns the asar/app directory
    return path.dirname(app.getAppPath())
  } else {
    // Development: app.getAppPath() returns the project root
    return app.getAppPath()
  }
}

export type DeploymentProvider = 'railway' | 'netlify'

interface CLIStatus {
  available: boolean
  path: string | null
  version: string | null
  error: string | null
}

interface DeploymentServiceStatus {
  railway: CLIStatus
  netlify: CLIStatus
}

class DeploymentService {
  private railwayCliPath: string | null = null
  private netlifyCliPath: string | null = null
  private initialized = false

  /**
   * Initialize the deployment service and verify CLI availability
   */
  async init(): Promise<DeploymentServiceStatus> {
    const status: DeploymentServiceStatus = {
      railway: { available: false, path: null, version: null, error: null },
      netlify: { available: false, path: null, version: null, error: null }
    }

    // Initialize Railway CLI
    try {
      this.railwayCliPath = this.getRailwayCliPath()
      if (this.railwayCliPath && fs.existsSync(this.railwayCliPath)) {
        const version = await this.getCliVersion('railway')
        status.railway = {
          available: true,
          path: this.railwayCliPath,
          version,
          error: null
        }
        console.log(`✅ Railway CLI ready: ${this.railwayCliPath} (${version})`)
      } else {
        status.railway.error = 'Railway CLI binary not found'
        console.warn('⚠️ Railway CLI not found')
      }
    } catch (error) {
      status.railway.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Railway CLI initialization failed:', error)
    }

    // Initialize Netlify CLI
    try {
      this.netlifyCliPath = this.getNetlifyCliPath()
      if (this.netlifyCliPath) {
        const version = await this.getCliVersion('netlify')
        status.netlify = {
          available: true,
          path: this.netlifyCliPath,
          version,
          error: null
        }
        console.log(`✅ Netlify CLI ready: ${this.netlifyCliPath} (${version})`)
      } else {
        status.netlify.error = 'Netlify CLI not found'
        console.warn('⚠️ Netlify CLI not found')
      }
    } catch (error) {
      status.netlify.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Netlify CLI initialization failed:', error)
    }

    this.initialized = true
    return status
  }

  /**
   * Get the path to the Railway CLI binary
   */
  private getRailwayCliPath(): string | null {
    const isDev = !app.isPackaged

    let binaryName = 'railway'
    if (process.platform === 'win32') {
      binaryName = 'railway.exe'
    }

    const platformKey = `${process.platform}-${process.arch}`

    let binaryPath: string

    if (isDev) {
      // Development: use binaries from resources folder relative to app root
      const appRoot = getAppRoot()
      binaryPath = path.join(
        appRoot,
        'resources/binaries',
        platformKey,
        binaryName
      )
      console.log(`[DeploymentService] Dev mode - looking for Railway CLI at: ${binaryPath}`)
    } else {
      // Production: use binaries from app resources
      binaryPath = path.join(
        process.resourcesPath,
        'binaries',
        binaryName
      )
    }

    // Verify binary exists
    if (!fs.existsSync(binaryPath)) {
      console.warn(`Railway CLI binary not found at: ${binaryPath}`)
      return null
    }

    // Verify it's executable on Unix
    if (process.platform !== 'win32') {
      try {
        fs.accessSync(binaryPath, fs.constants.X_OK)
      } catch {
        // Make it executable
        try {
          fs.chmodSync(binaryPath, '755')
        } catch (err) {
          console.error('Failed to make Railway CLI executable:', err)
        }
      }
    }

    return binaryPath
  }

  /**
   * Get the path to the Netlify CLI
   * Uses require.resolve to find the npm package
   */
  private getNetlifyCliPath(): string | null {
    const isDev = !app.isPackaged
    const appRoot = getAppRoot()

    // Build list of possible paths
    const possiblePaths: string[] = []

    if (isDev) {
      // Development: look in node_modules relative to app root
      possiblePaths.push(
        path.join(appRoot, 'node_modules/netlify-cli/bin/run.js')
      )
    } else {
      // Production: look in unpacked asar
      possiblePaths.push(
        path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/netlify-cli/bin/run.js'),
        path.join(process.resourcesPath || '', 'app/node_modules/netlify-cli/bin/run.js')
      )
    }

    console.log(`[DeploymentService] Looking for Netlify CLI in:`, possiblePaths)

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[DeploymentService] Found Netlify CLI at: ${p}`)
        return p
      }
    }

    console.warn('Netlify CLI not found in any expected location')
    return null
  }

  /**
   * Get CLI version
   */
  private async getCliVersion(provider: DeploymentProvider): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        let cmd: string
        let args: string[]

        if (provider === 'railway') {
          if (!this.railwayCliPath) {
            resolve(null)
            return
          }
          cmd = this.railwayCliPath
          args = ['--version']
        } else {
          if (!this.netlifyCliPath) {
            resolve(null)
            return
          }
          // Netlify CLI needs to be run with Node
          cmd = process.execPath
          args = [this.netlifyCliPath, '--version']
        }

        const proc = spawn(cmd, args, {
          timeout: 10000,
          shell: process.platform === 'win32'
        })

        let output = ''
        proc.stdout?.on('data', (data) => {
          output += data.toString()
        })

        proc.on('close', (code) => {
          if (code === 0) {
            // Parse version from output
            const match = output.match(/(\d+\.\d+\.\d+)/)
            resolve(match ? `v${match[1]}` : output.trim().slice(0, 20))
          } else {
            resolve(null)
          }
        })

        proc.on('error', () => {
          resolve(null)
        })
      } catch {
        resolve(null)
      }
    })
  }

  /**
   * Check if a provider's CLI is available
   */
  isProviderAvailable(provider: DeploymentProvider): boolean {
    if (provider === 'railway') {
      return this.railwayCliPath !== null && fs.existsSync(this.railwayCliPath)
    } else if (provider === 'netlify') {
      return this.netlifyCliPath !== null
    }
    return false
  }

  /**
   * Get the CLI path for a provider
   */
  getCliPath(provider: DeploymentProvider): string | null {
    if (provider === 'railway') {
      return this.railwayCliPath
    } else if (provider === 'netlify') {
      return this.netlifyCliPath
    }
    return null
  }

  /**
   * Get the system Node.js path (not Electron's)
   */
  private getSystemNodePath(): string {
    // Common Node.js locations
    const possiblePaths = [
      '/usr/local/bin/node',
      '/opt/homebrew/bin/node',
      '/usr/bin/node',
      process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'node') : null
    ].filter(Boolean) as string[]

    for (const nodePath of possiblePaths) {
      if (fs.existsSync(nodePath)) {
        return nodePath
      }
    }

    // Fallback: assume 'node' is in PATH
    return 'node'
  }

  /**
   * Get the command to execute CLI (different for Railway vs Netlify)
   */
  getCliCommand(provider: DeploymentProvider, token?: string): { cmd: string; baseArgs: string[] } | null {
    if (provider === 'railway') {
      if (!this.railwayCliPath) return null
      return {
        cmd: this.railwayCliPath,
        baseArgs: []
      }
    } else if (provider === 'netlify') {
      if (!this.netlifyCliPath) return null
      // Netlify CLI needs to be run with system Node.js (not Electron)
      const nodePath = this.getSystemNodePath()
      return {
        cmd: nodePath,
        baseArgs: [this.netlifyCliPath]
      }
    }
    return null
  }

  /**
   * Get environment variables needed for CLI execution
   */
  getCliEnv(provider: DeploymentProvider, token: string): NodeJS.ProcessEnv {
    const baseEnv = { ...process.env }

    if (provider === 'railway') {
      // IMPORTANT: Only set RAILWAY_API_TOKEN for account-level operations (init, whoami, link)
      // Do NOT set RAILWAY_TOKEN as it takes precedence and blocks account-level commands
      return {
        ...baseEnv,
        RAILWAY_API_TOKEN: token,
        CI: 'true' // Non-interactive mode
      }
    } else if (provider === 'netlify') {
      return {
        ...baseEnv,
        NETLIFY_AUTH_TOKEN: token,
        NETLIFY_SITE_ID: '', // Will be set per-command if needed
        CI: 'true', // Non-interactive mode
        NODE_ENV: 'production'
      }
    }

    return baseEnv
  }

  /**
   * Get status of all deployment services
   */
  async getStatus(): Promise<DeploymentServiceStatus> {
    if (!this.initialized) {
      return this.init()
    }

    return {
      railway: {
        available: this.isProviderAvailable('railway'),
        path: this.railwayCliPath,
        version: await this.getCliVersion('railway'),
        error: this.railwayCliPath ? null : 'CLI not found'
      },
      netlify: {
        available: this.isProviderAvailable('netlify'),
        path: this.netlifyCliPath,
        version: await this.getCliVersion('netlify'),
        error: this.netlifyCliPath ? null : 'CLI not found'
      }
    }
  }

  /**
   * Determine which deployment provider to use based on template config and connected services
   */
  selectProvider(
    templateServices: string[],
    connectedServices: string[]
  ): DeploymentProvider | null {
    // Find services that are both required by template AND connected by user
    const availableServices = templateServices.filter(service =>
      connectedServices.includes(service) && this.isProviderAvailable(service as DeploymentProvider)
    )

    if (availableServices.length === 0) {
      return null
    }

    // If multiple services available, prioritize based on template order
    return availableServices[0] as DeploymentProvider
  }

  /**
   * Run a command and capture output
   */
  private runCommand(
    cmd: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; stdinInput?: string },
    onProgress: (message: string) => void
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      console.log(`🚀 [DEPLOY] Running: ${cmd} ${args.join(' ')}`)
      onProgress(`Running: ${cmd} ${args.join(' ')}`)

      const proc = spawn(cmd, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false // Don't use shell to avoid issues with special characters in args
      })

      let stdout = ''
      let stderr = ''
      let stdinSent = false

      proc.stdout?.on('data', (data) => {
        const text = data.toString()
        stdout += text
        console.log(`📤 [DEPLOY STDOUT] ${text}`)
        onProgress(text)

        // Auto-answer interactive prompts by sending Enter
        // Detect prompts like "? Team:" or "? Select" and send newline to accept default
        if (options.stdinInput && !stdinSent && (text.includes('?') || text.includes('arrow keys'))) {
          console.log(`📝 [DEPLOY] Detected prompt, sending input...`)
          setTimeout(() => {
            proc.stdin?.write(options.stdinInput)
            proc.stdin?.end()
            stdinSent = true
          }, 100)
        }
      })

      proc.stderr?.on('data', (data) => {
        const text = data.toString()
        stderr += text
        console.log(`📤 [DEPLOY STDERR] ${text}`)
        onProgress(text)
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout })
        } else {
          resolve({ success: false, output: stdout, error: stderr || `Process exited with code ${code}` })
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, output: stdout, error: err.message })
      })
    })
  }

  /**
   * Deploy to Netlify
   */
  async deployNetlify(
    projectPath: string,
    projectName: string,
    token: string,
    envVars: Record<string, string>,
    existingSiteId: string | null,
    onProgress: (message: string) => void
  ): Promise<DeployResult> {
    const cliCommand = this.getCliCommand('netlify')
    if (!cliCommand) {
      return { success: false, error: 'Netlify CLI not available' }
    }

    const { cmd, baseArgs } = cliCommand
    const env = this.getCliEnv('netlify', token)

    try {
      // Step 1: Build the project
      onProgress('📦 Building project...')
      console.log('🔨 [NETLIFY] Building project...')

      const buildResult = await this.runCommand(
        'npm',
        ['run', 'build'],
        { cwd: projectPath, env: { ...process.env } },
        onProgress
      )

      if (!buildResult.success) {
        return { success: false, error: `Build failed: ${buildResult.error}` }
      }

      onProgress('✅ Build complete!')

      // Determine build directory - check multiple possible locations
      const possibleBuildDirs = ['dist', 'frontend/dist', 'build', 'frontend/build', 'out']
      let buildDir: string | null = null
      let fullBuildPath: string | null = null

      for (const dir of possibleBuildDirs) {
        const checkPath = path.join(projectPath, dir)
        if (fs.existsSync(checkPath)) {
          buildDir = dir
          fullBuildPath = checkPath
          console.log(`📁 [NETLIFY] Found build output at: ${dir}`)
          break
        }
      }

      if (!buildDir || !fullBuildPath) {
        return { success: false, error: `Build directory not found. Checked: ${possibleBuildDirs.join(', ')}` }
      }

      let siteId = existingSiteId

      // Step 2: Check for existing siteId in .netlify/state.json (if not in database)
      if (!siteId) {
        const stateJsonPath = path.join(projectPath, '.netlify', 'state.json')
        if (fs.existsSync(stateJsonPath)) {
          try {
            const stateContent = JSON.parse(fs.readFileSync(stateJsonPath, 'utf-8'))
            if (stateContent.siteId) {
              siteId = stateContent.siteId
              onProgress(`📎 Found existing Netlify site: ${siteId.substring(0, 8)}...`)
              console.log(`📎 [NETLIFY] Found existing siteId in state.json: ${siteId}`)
            }
          } catch (e) {
            console.warn('⚠️ [NETLIFY] Could not read state.json:', e)
          }
        }
      }

      // Step 3: Create site if still no siteId
      if (!siteId) {
        onProgress('🌐 Creating Netlify site...')
        console.log('🌐 [NETLIFY] Creating site...')

        // Clean project name for Netlify (lowercase, no special chars)
        const cleanName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')

        const createResult = await this.runCommand(
          cmd,
          [...baseArgs, 'sites:create', '--name', cleanName, '--manual'],
          { cwd: projectPath, env, stdinInput: '\n' }, // Auto-select default team
          onProgress
        )

        if (!createResult.success) {
          // Site name might already exist, try with timestamp
          const uniqueName = `${cleanName}-${Date.now()}`
          const retryResult = await this.runCommand(
            cmd,
            [...baseArgs, 'sites:create', '--name', uniqueName, '--manual'],
            { cwd: projectPath, env, stdinInput: '\n' }, // Auto-select default team
            onProgress
          )

          if (!retryResult.success) {
            return { success: false, error: `Failed to create site: ${retryResult.error}` }
          }

          // Parse site ID from output
          const siteIdMatch = retryResult.output.match(/Site ID:\s+([a-f0-9-]+)/i)
          siteId = siteIdMatch?.[1] || null
        } else {
          const siteIdMatch = createResult.output.match(/Site ID:\s+([a-f0-9-]+)/i)
          siteId = siteIdMatch?.[1] || null
        }

        if (siteId) {
          onProgress(`✅ Site created with ID: ${siteId}`)
        }
      }

      // Step 4: Set environment variables
      if (Object.keys(envVars).length > 0 && siteId) {
        onProgress('🔐 Setting environment variables...')
        console.log('🔐 [NETLIFY] Setting env vars...')

        for (const [key, value] of Object.entries(envVars)) {
          if (value && value.trim()) {
            await this.runCommand(
              cmd,
              [...baseArgs, 'env:set', key, value, '--site', siteId],
              { cwd: projectPath, env },
              onProgress
            )
          }
        }
      }

      // Step 5: Deploy
      onProgress('🚀 Deploying to Netlify...')
      console.log('🚀 [NETLIFY] Deploying...')

      // Build deploy args - use --site flag if we have a siteId
      const deployArgs = [...baseArgs, 'deploy', '--prod', '--dir', buildDir, '--no-build']
      if (siteId) {
        deployArgs.push('--site', siteId)
      }

      const deployResult = await this.runCommand(
        cmd,
        deployArgs,
        { cwd: projectPath, env },
        onProgress
      )

      if (!deployResult.success) {
        return { success: false, error: `Deploy failed: ${deployResult.error}` }
      }

      // Parse URL from output
      const urlMatch = deployResult.output.match(/Website URL:\s+(https:\/\/[^\s]+)/i) ||
                       deployResult.output.match(/Live URL:\s+(https:\/\/[^\s]+)/i) ||
                       deployResult.output.match(/(https:\/\/[a-z0-9-]+\.netlify\.app)/i)
      const url = urlMatch?.[1] || null

      onProgress(`✅ Deployed successfully!${url ? ` Live at: ${url}` : ''}`)
      console.log(`✅ [NETLIFY] Deploy complete! URL: ${url}`)

      // NOTE: We no longer delete .netlify/state.json after deployment
      // The ProcessManager now injects NETLIFY_AUTH_TOKEN when running `netlify dev`,
      // which allows it to authenticate with linked sites without issues.
      // This means redeployments will work correctly because the state.json contains the siteId.

      return {
        success: true,
        url: url || undefined,
        siteId: siteId || undefined
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ [NETLIFY] Deploy error:', error)
      return { success: false, error: errMsg }
    }
  }

  /**
   * Deploy to Railway - handles both single-service and multi-service (backend/frontend) projects
   */
  async deployRailway(
    projectPath: string,
    projectName: string,
    token: string,
    envVars: Record<string, string>,
    existingProjectId: string | null,
    onProgress: (message: string) => void
  ): Promise<DeployResult> {
    const cliCommand = this.getCliCommand('railway', token)
    if (!cliCommand) {
      return { success: false, error: 'Railway CLI not available' }
    }

    const { cmd, baseArgs } = cliCommand
    const env = this.getCliEnv('railway', token)

    // Check if this is a multi-service project (has backend/ and frontend/)
    const hasBackend = fs.existsSync(path.join(projectPath, 'backend'))
    const hasFrontend = fs.existsSync(path.join(projectPath, 'frontend'))
    const isFullStack = hasBackend && hasFrontend

    console.log(`🚂 [RAILWAY] Project type: ${isFullStack ? 'Full-stack (backend + frontend)' : 'Single service'}`)

    try {
      let projectId = existingProjectId

      // Step 1: Initialize project if needed
      if (!projectId) {
        onProgress('🚂 Creating Railway project...')

        const cleanName = projectName.replace(/[^a-zA-Z0-9-]/g, '-')
        const initResult = await this.runCommand(
          cmd,
          [...baseArgs, 'init', '--name', cleanName],
          { cwd: projectPath, env, stdinInput: '\n' },
          onProgress
        )

        if (!initResult.success) {
          return { success: false, error: `Failed to create project: ${initResult.error}` }
        }

        const projectIdMatch = initResult.output.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
        projectId = projectIdMatch?.[1] || null

        if (projectId) {
          onProgress(`✅ Project created with ID: ${projectId}`)
        }
      }

      let frontendUrl: string | undefined
      let backendUrl: string | undefined
      let environmentId: string | null = null

      // Get the environment ID from the project (needed for domain creation)
      if (projectId) {
        try {
          const projectResponse = await fetch('https://backboard.railway.app/graphql/v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              query: `
                query GetProject($id: String!) {
                  project(id: $id) {
                    id
                    environments {
                      edges {
                        node {
                          id
                          name
                        }
                      }
                    }
                  }
                }
              `,
              variables: { id: projectId }
            })
          })

          const projectResult = await projectResponse.json() as any
          const environments = projectResult.data?.project?.environments?.edges || []
          // Use production environment, or fall back to first environment
          const prodEnv = environments.find((e: any) => e.node.name === 'production')
          environmentId = prodEnv?.node?.id || environments[0]?.node?.id || null
          console.log(`🔗 [RAILWAY] Environment ID: ${environmentId}`)
        } catch (apiError) {
          console.error(`❌ [RAILWAY] Failed to get environment ID:`, apiError)
        }
      }

      if (isFullStack) {
        // === FULL-STACK DEPLOYMENT ===
        // Deploy each subdirectory using PATH argument: `railway up ./backend`
        // This uploads ONLY the subdirectory contents, not the whole project

        const backendPath = path.join(projectPath, 'backend')
        let backendServiceId: string | null = null
        let frontendServiceId: string | null = null

        // For redeployment: Query existing services first
        if (existingProjectId) {
          onProgress('🔍 Checking existing services...')
          try {
            const servicesResponse = await fetch('https://backboard.railway.app/graphql/v2', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                query: `
                  query GetProjectServices($projectId: String!) {
                    project(id: $projectId) {
                      services {
                        edges {
                          node {
                            id
                            name
                          }
                        }
                      }
                    }
                  }
                `,
                variables: { projectId: projectId }
              })
            })

            const servicesResult = await servicesResponse.json() as any
            const services = servicesResult.data?.project?.services?.edges || []

            // Find existing backend and frontend services by name
            for (const edge of services) {
              const service = edge.node
              if (service.name.toLowerCase().includes('backend')) {
                backendServiceId = service.id
                console.log(`🔗 [RAILWAY] Found existing Backend Service: ${backendServiceId}`)
              } else if (service.name.toLowerCase().includes('frontend')) {
                frontendServiceId = service.id
                console.log(`🔗 [RAILWAY] Found existing Frontend Service: ${frontendServiceId}`)
              }
            }
          } catch (apiError) {
            console.error(`❌ [RAILWAY] API error querying services:`, apiError)
          }
        }

        // Step 2a: Create backend service if it doesn't exist
        if (!backendServiceId) {
          onProgress('🔧 Creating backend service...')
          try {
            const createBackendResponse = await fetch('https://backboard.railway.app/graphql/v2', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                query: `
                  mutation ServiceCreate($projectId: String!, $name: String!) {
                    serviceCreate(input: { projectId: $projectId, name: $name }) {
                      id
                      name
                    }
                  }
                `,
                variables: {
                  projectId: projectId,
                  name: `${projectName} - Backend`
                }
              })
            })

            const backendResult = await createBackendResponse.json() as { data?: { serviceCreate?: { id: string } }, errors?: unknown[] }
            if (backendResult.data?.serviceCreate?.id) {
              backendServiceId = backendResult.data.serviceCreate.id
              console.log(`🔗 [RAILWAY] Backend Service created via API: ${backendServiceId}`)
            }
          } catch (apiError) {
            console.error(`❌ [RAILWAY] API error creating backend service:`, apiError)
          }
        } else {
          onProgress('🔧 Redeploying backend service...')
        }

        // Deploy backend
        onProgress('🔧 Deploying backend service...')

        const backendDeployArgs = backendServiceId
          ? [...baseArgs, 'up', '--detach', '--path-as-root', '--service', backendServiceId, backendPath]
          : [...baseArgs, 'up', '--detach', '--path-as-root', backendPath]

        const backendDeployResult = await this.runCommand(
          cmd,
          backendDeployArgs,
          { cwd: projectPath, env },
          onProgress
        )

        if (!backendDeployResult.success) {
          return { success: false, error: `Backend deploy failed: ${backendDeployResult.error}` }
        }

        // Get backend service ID from output if not already set
        if (!backendServiceId) {
          const backendServiceMatch = backendDeployResult.output.match(/\/service\/([a-f0-9-]{36})/i)
          backendServiceId = backendServiceMatch?.[1] || null
        }
        console.log(`🔗 [RAILWAY] Backend Service ID: ${backendServiceId}`)

        // Get backend domain (use --service flag since we're at project root)
        onProgress('🌐 Getting backend URL...')
        const backendDomainResult = await this.runCommand(
          cmd,
          [...baseArgs, 'domain', ...(backendServiceId ? ['--service', backendServiceId] : [])],
          { cwd: projectPath, env },
          onProgress
        )

        if (backendDomainResult.success) {
          const urlMatch = backendDomainResult.output.match(/(https:\/\/[^\s]+)/i)
          backendUrl = urlMatch?.[1]
          console.log(`🔗 [RAILWAY] Backend URL: ${backendUrl}`)
        }

        // Set backend env vars (excluding frontend-specific ones)
        if (backendServiceId) {
          onProgress('🔐 Setting backend environment variables...')
          for (const [key, value] of Object.entries(envVars)) {
            // Skip VITE_ vars for backend
            if (value && value.trim() && !key.startsWith('VITE_')) {
              await this.runCommand(
                cmd,
                [...baseArgs, 'variables', '--set', `${key}=${value}`, '--service', backendServiceId],
                { cwd: projectPath, env },
                onProgress
              )
            }
          }
        }

        // Step 2b: Create frontend service if it doesn't exist
        if (!frontendServiceId) {
          onProgress('🎨 Creating frontend service...')
          try {
            const createServiceResponse = await fetch('https://backboard.railway.app/graphql/v2', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                query: `
                  mutation ServiceCreate($projectId: String!, $name: String!) {
                    serviceCreate(input: { projectId: $projectId, name: $name }) {
                      id
                      name
                    }
                  }
                `,
                variables: {
                  projectId: projectId,
                  name: `${projectName} - Frontend`
                }
              })
            })

            const createResult = await createServiceResponse.json() as { data?: { serviceCreate?: { id: string } }, errors?: unknown[] }
            if (createResult.data?.serviceCreate?.id) {
              frontendServiceId = createResult.data.serviceCreate.id
              console.log(`🔗 [RAILWAY] Frontend Service created via API: ${frontendServiceId}`)
            } else {
              console.log(`⚠️ [RAILWAY] Could not create frontend service via API:`, createResult.errors)
            }
          } catch (apiError) {
            console.error(`❌ [RAILWAY] API error creating frontend service:`, apiError)
          }
        } else {
          onProgress('🎨 Redeploying frontend service...')
        }

        // Deploy frontend to the created service (use PATH argument to upload only frontend folder)
        onProgress('🎨 Deploying frontend service...')

        const frontendPath = path.join(projectPath, 'frontend')
        const frontendDeployArgs = frontendServiceId
          ? [...baseArgs, 'up', '--detach', '--path-as-root', '--service', frontendServiceId, frontendPath]
          : [...baseArgs, 'up', '--detach', '--path-as-root', frontendPath]

        const frontendDeployResult = await this.runCommand(
          cmd,
          frontendDeployArgs,
          { cwd: projectPath, env },
          onProgress
        )

        if (!frontendDeployResult.success) {
          return { success: false, error: `Frontend deploy failed: ${frontendDeployResult.error}` }
        }

        // Get frontend service ID from output if not already set
        if (!frontendServiceId) {
          const frontendServiceMatch = frontendDeployResult.output.match(/\/service\/([a-f0-9-]{36})/i)
          frontendServiceId = frontendServiceMatch?.[1] || null
        }
        console.log(`🔗 [RAILWAY] Frontend Service ID: ${frontendServiceId}`)

        // Get frontend domain via Railway API (CLI doesn't work well with service ID)
        if (frontendServiceId && environmentId) {
          onProgress('🌐 Getting frontend URL...')

          try {
            // Create a service domain via Railway API
            const domainResponse = await fetch('https://backboard.railway.app/graphql/v2', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                query: `
                  mutation ServiceDomainCreate($serviceId: String!, $environmentId: String!) {
                    serviceDomainCreate(input: { serviceId: $serviceId, environmentId: $environmentId }) {
                      domain
                    }
                  }
                `,
                variables: {
                  serviceId: frontendServiceId,
                  environmentId: environmentId
                }
              })
            })

            const domainResult = await domainResponse.json() as { data?: { serviceDomainCreate?: { domain: string } }, errors?: unknown[] }
            if (domainResult.data?.serviceDomainCreate?.domain) {
              frontendUrl = `https://${domainResult.data.serviceDomainCreate.domain}`
              console.log(`🔗 [RAILWAY] Frontend URL via API: ${frontendUrl}`)
            } else {
              // Fallback: try to get existing domain
              const getDomainResponse = await fetch('https://backboard.railway.app/graphql/v2', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  query: `
                    query GetServiceDomains($projectId: String!, $serviceId: String!) {
                      project(id: $projectId) {
                        services(first: 10) {
                          edges {
                            node {
                              id
                              serviceDomains {
                                domain
                              }
                            }
                          }
                        }
                      }
                    }
                  `,
                  variables: {
                    projectId: projectId,
                    serviceId: frontendServiceId
                  }
                })
              })

              const getResult = await getDomainResponse.json() as any
              const services = getResult.data?.project?.services?.edges || []
              const frontendService = services.find((s: any) => s.node.id === frontendServiceId)
              if (frontendService?.node?.serviceDomains?.[0]?.domain) {
                frontendUrl = `https://${frontendService.node.serviceDomains[0].domain}`
                console.log(`🔗 [RAILWAY] Frontend URL from query: ${frontendUrl}`)
              }
            }
          } catch (apiError) {
            console.error(`❌ [RAILWAY] API error getting frontend domain:`, apiError)
          }
        }

        // Set frontend env vars with backend URL
        if (frontendServiceId) {
          onProgress('🔐 Setting frontend environment variables...')

          // Set VITE_API_URL to backend URL
          if (backendUrl) {
            await this.runCommand(
              cmd,
              [...baseArgs, 'variables', '--set', `VITE_API_URL=${backendUrl}`, '--service', frontendServiceId],
              { cwd: projectPath, env },
              onProgress
            )
          }

          // Set other VITE_ vars for frontend
          for (const [key, value] of Object.entries(envVars)) {
            if (value && value.trim() && key.startsWith('VITE_') && key !== 'VITE_API_URL') {
              await this.runCommand(
                cmd,
                [...baseArgs, 'variables', '--set', `${key}=${value}`, '--service', frontendServiceId],
                { cwd: projectPath, env },
                onProgress
              )
            }
          }
        }

        // Update backend with frontend URL
        if (backendServiceId && frontendUrl) {
          onProgress('🔄 Updating backend with frontend URL...')
          await this.runCommand(
            cmd,
            [...baseArgs, 'variables', '--set', `FRONTEND_URL=${frontendUrl}`, '--service', backendServiceId],
            { cwd: projectPath, env },
            onProgress
          )
        }

        // Redeploy both services to pick up env vars (use --path-as-root)
        onProgress('🔄 Redeploying services with environment variables...')

        if (backendServiceId) {
          await this.runCommand(
            cmd,
            [...baseArgs, 'up', '--detach', '--path-as-root', '--service', backendServiceId, backendPath],
            { cwd: projectPath, env },
            onProgress
          )
        }

        if (frontendServiceId) {
          await this.runCommand(
            cmd,
            [...baseArgs, 'up', '--detach', '--path-as-root', '--service', frontendServiceId, frontendPath],
            { cwd: projectPath, env },
            onProgress
          )
        }

        // Poll for deployment completion
        const servicesToPoll: Array<{ id: string; name: string }> = []
        if (backendServiceId) servicesToPoll.push({ id: backendServiceId, name: 'Backend' })
        if (frontendServiceId) servicesToPoll.push({ id: frontendServiceId, name: 'Frontend' })

        if (servicesToPoll.length > 0 && projectId && environmentId) {
          onProgress('⏳ Waiting for Railway to build and deploy...')

          const pollResult = await this.pollRailwayDeploymentStatus(
            token,
            projectId,
            servicesToPoll,
            environmentId,
            onProgress
          )

          if (!pollResult.success) {
            // Check which services failed
            const failedServices = servicesToPoll
              .filter(s => pollResult.statuses[s.id] === 'FAILED' || pollResult.statuses[s.id] === 'CRASHED')
              .map(s => `${s.name}: ${pollResult.statuses[s.id]}`)

            if (failedServices.length > 0) {
              return {
                success: false,
                error: `Build failed: ${failedServices.join(', ')}`,
                projectId: projectId || undefined
              }
            }
          }
        }

        onProgress(`✅ Full-stack deployed! Frontend: ${frontendUrl}`)
        console.log(`✅ [RAILWAY] Deploy complete! Frontend: ${frontendUrl}, Backend: ${backendUrl}`)

        return {
          success: true,
          url: frontendUrl, // Return frontend URL as main URL
          projectId: projectId || undefined
        }

      } else {
        // === SINGLE SERVICE DEPLOYMENT ===
        onProgress('🚀 Deploying to Railway...')

        const deployResult = await this.runCommand(
          cmd,
          [...baseArgs, 'up', '--detach'],
          { cwd: projectPath, env },
          onProgress
        )

        if (!deployResult.success) {
          return { success: false, error: `Deploy failed: ${deployResult.error}` }
        }

        // Parse service ID
        const serviceMatch = deployResult.output.match(/\/service\/([a-f0-9-]{36})/i)
        const serviceId = serviceMatch?.[1]

        // Set environment variables
        if (Object.keys(envVars).length > 0 && serviceId) {
          onProgress('🔐 Setting environment variables...')

          for (const [key, value] of Object.entries(envVars)) {
            if (value && value.trim()) {
              await this.runCommand(
                cmd,
                [...baseArgs, 'variables', '--set', `${key}=${value}`, '--service', serviceId],
                { cwd: projectPath, env },
                onProgress
              )
            }
          }

          onProgress('🔄 Redeploying with environment variables...')
          await this.runCommand(
            cmd,
            [...baseArgs, 'up', '--detach', '--service', serviceId],
            { cwd: projectPath, env },
            onProgress
          )
        }

        // Poll for deployment completion
        if (serviceId && projectId && environmentId) {
          onProgress('⏳ Waiting for Railway to build and deploy...')

          const pollResult = await this.pollRailwayDeploymentStatus(
            token,
            projectId,
            [{ id: serviceId, name: 'Service' }],
            environmentId,
            onProgress
          )

          if (!pollResult.success) {
            const status = pollResult.statuses[serviceId]
            if (status === 'FAILED' || status === 'CRASHED') {
              return {
                success: false,
                error: `Build failed: ${status}`,
                projectId: projectId || undefined
              }
            }
          }
        }

        // Get domain
        onProgress('⏳ Getting deployment URL...')
        const domainResult = await this.runCommand(
          cmd,
          [...baseArgs, 'domain'],
          { cwd: projectPath, env },
          onProgress
        )

        let url: string | undefined
        if (domainResult.success) {
          const urlMatch = domainResult.output.match(/(https:\/\/[^\s]+)/i)
          url = urlMatch?.[1]
        }

        onProgress(`✅ Deployed successfully!${url ? ` Live at: ${url}` : ''}`)
        return { success: true, url, projectId: projectId || undefined }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ [RAILWAY] Deploy error:', error)
      return { success: false, error: errMsg }
    }
  }

  /**
   * Poll Railway deployment status until it reaches a terminal state (SUCCESS, FAILED, CRASHED)
   * Returns the final status for all services
   */
  private async pollRailwayDeploymentStatus(
    token: string,
    projectId: string,
    services: Array<{ id: string; name: string }>,
    environmentId: string,
    onProgress: (message: string) => void,
    maxWaitMs: number = 300000 // 5 minutes max
  ): Promise<{ success: boolean; statuses: Record<string, string> }> {
    const startTime = Date.now()
    const pollIntervalMs = 5000 // Poll every 5 seconds
    const statuses: Record<string, string> = {}

    // Create a map of serviceId -> name for easy lookup
    const serviceNames = new Map(services.map(s => [s.id, s.name]))

    // Terminal statuses that indicate completion
    const terminalStatuses = ['SUCCESS', 'FAILED', 'CRASHED', 'REMOVED']

    while (Date.now() - startTime < maxWaitMs) {
      try {
        // Query deployment status for each service
        const response = await fetch('https://backboard.railway.app/graphql/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            query: `
              query GetDeployments($projectId: String!, $environmentId: String!) {
                deployments(
                  first: 10
                  input: {
                    projectId: $projectId
                    environmentId: $environmentId
                  }
                ) {
                  edges {
                    node {
                      id
                      status
                      serviceId
                      staticUrl
                    }
                  }
                }
              }
            `,
            variables: { projectId, environmentId }
          })
        })

        const result = await response.json() as any
        const deployments = result.data?.deployments?.edges || []

        // Update statuses for our services
        let allTerminal = true
        let anyFailed = false

        for (const service of services) {
          // Find the most recent deployment for this service
          const serviceDeployment = deployments.find((d: any) => d.node.serviceId === service.id)
          const status = serviceDeployment?.node?.status || 'UNKNOWN'
          const prevStatus = statuses[service.id]

          statuses[service.id] = status

          // Log status changes
          if (prevStatus !== status) {
            const statusEmoji = status === 'SUCCESS' ? '✅' : status === 'BUILDING' ? '🔨' : status === 'DEPLOYING' ? '🚀' : status === 'FAILED' ? '❌' : '⏳'
            onProgress(`${statusEmoji} ${service.name}: ${status}`)
            console.log(`🚂 [RAILWAY] Service ${service.name} (${service.id}): ${status}`)
          }

          if (!terminalStatuses.includes(status)) {
            allTerminal = false
          }
          if (status === 'FAILED' || status === 'CRASHED') {
            anyFailed = true
          }
        }

        // If all services have reached terminal status, we're done
        if (allTerminal && services.length > 0) {
          return { success: !anyFailed, statuses }
        }

      } catch (error) {
        console.error('❌ [RAILWAY] Error polling deployment status:', error)
        // Continue polling despite errors
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    // Timeout reached
    onProgress('⚠️ Build status polling timed out')
    return { success: false, statuses }
  }

  /**
   * Main deploy method - routes to appropriate provider
   */
  async deploy(
    provider: DeploymentProvider,
    projectPath: string,
    projectName: string,
    token: string,
    envVars: Record<string, string>,
    existingId: string | null,
    onProgress: (message: string) => void
  ): Promise<DeployResult> {
    if (provider === 'netlify') {
      return this.deployNetlify(projectPath, projectName, token, envVars, existingId, onProgress)
    } else if (provider === 'railway') {
      return this.deployRailway(projectPath, projectName, token, envVars, existingId, onProgress)
    }
    return { success: false, error: `Unknown provider: ${provider}` }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService()
