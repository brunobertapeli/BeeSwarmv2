/**
 * DeploymentService
 * Manages CLI paths and deployment operations for Railway and Netlify
 */

import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { bundledBinaries } from './BundledBinaries'

export interface DeployResult {
  success: boolean
  url?: string
  siteId?: string // For Netlify
  projectId?: string // For Railway
  error?: string
}

/**
 * Get the application root directory
 * In dev: /Users/.../CodeDeck
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

export type DeploymentProvider = 'railway' | 'netlify' | 'vercel'

interface CLIStatus {
  available: boolean
  path: string | null
  version: string | null
  error: string | null
}

interface DeploymentServiceStatus {
  railway: CLIStatus
  netlify: CLIStatus
  vercel: CLIStatus
}

class DeploymentService {
  private railwayCliPath: string | null = null
  private netlifyCliPath: string | null = null
  private vercelCliPath: string | null = null
  private initialized = false

  /**
   * Initialize the deployment service and verify CLI availability
   */
  async init(): Promise<DeploymentServiceStatus> {
    const status: DeploymentServiceStatus = {
      railway: { available: false, path: null, version: null, error: null },
      netlify: { available: false, path: null, version: null, error: null },
      vercel: { available: false, path: null, version: null, error: null }
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
      } else {
        status.netlify.error = 'Netlify CLI not found'
        console.warn('⚠️ Netlify CLI not found')
      }
    } catch (error) {
      status.netlify.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Netlify CLI initialization failed:', error)
    }

    // Initialize Vercel CLI
    try {
      this.vercelCliPath = this.getVercelCliPath()
      if (this.vercelCliPath) {
        const version = await this.getCliVersion('vercel')
        status.vercel = {
          available: true,
          path: this.vercelCliPath,
          version,
          error: null
        }
      } else {
        status.vercel.error = 'Vercel CLI not found'
        console.warn('⚠️ Vercel CLI not found')
      }
    } catch (error) {
      status.vercel.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Vercel CLI initialization failed:', error)
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

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    console.warn('Netlify CLI not found in any expected location')
    return null
  }

  /**
   * Get the path to the Vercel CLI
   * Uses require.resolve to find the npm package
   */
  private getVercelCliPath(): string | null {
    const isDev = !app.isPackaged
    const appRoot = getAppRoot()

    // Build list of possible paths
    const possiblePaths: string[] = []

    if (isDev) {
      // Development: look in node_modules relative to app root
      possiblePaths.push(
        path.join(appRoot, 'node_modules/vercel/dist/index.js')
      )
    } else {
      // Production: look in unpacked asar
      possiblePaths.push(
        path.join(process.resourcesPath || '', 'app.asar.unpacked/node_modules/vercel/dist/index.js'),
        path.join(process.resourcesPath || '', 'app/node_modules/vercel/dist/index.js')
      )
    }

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p
      }
    }

    console.warn('Vercel CLI not found in any expected location')
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
        } else if (provider === 'netlify') {
          if (!this.netlifyCliPath) {
            resolve(null)
            return
          }
          // Netlify CLI needs to be run with Node
          cmd = process.execPath
          args = [this.netlifyCliPath, '--version']
        } else if (provider === 'vercel') {
          if (!this.vercelCliPath) {
            resolve(null)
            return
          }
          // Vercel CLI needs to be run with Node
          cmd = process.execPath
          args = [this.vercelCliPath, '--version']
        } else {
          resolve(null)
          return
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
    } else if (provider === 'vercel') {
      return this.vercelCliPath !== null
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
    } else if (provider === 'vercel') {
      return this.vercelCliPath
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
    } else if (provider === 'vercel') {
      if (!this.vercelCliPath) return null
      // Vercel CLI needs to be run with system Node.js (not Electron)
      const nodePath = this.getSystemNodePath()
      return {
        cmd: nodePath,
        baseArgs: [this.vercelCliPath]
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
    } else if (provider === 'vercel') {
      return {
        ...baseEnv,
        VERCEL_TOKEN: token,
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
      },
      vercel: {
        available: this.isProviderAvailable('vercel'),
        path: this.vercelCliPath,
        version: await this.getCliVersion('vercel'),
        error: this.vercelCliPath ? null : 'CLI not found'
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
      onProgress(`Running: ${cmd} ${args.join(' ')}`)

      // Handle npm/npx commands - use bundled binaries for cross-platform compatibility
      let spawnCmd = cmd
      let spawnArgs = args
      if (cmd === 'npm') {
        const npmConfig = bundledBinaries.getNpmSpawnConfig(args)
        spawnCmd = npmConfig.command
        spawnArgs = npmConfig.args
      } else if (cmd === 'npx') {
        const npxConfig = bundledBinaries.getNpxSpawnConfig(args)
        spawnCmd = npxConfig.command
        spawnArgs = npxConfig.args
      }

      const proc = spawn(spawnCmd, spawnArgs, {
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
        onProgress(text)

        // Auto-answer interactive prompts by sending Enter
        // Detect prompts like "? Team:" or "? Select" and send newline to accept default
        if (options.stdinInput && !stdinSent && (text.includes('?') || text.includes('arrow keys'))) {
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

      const buildResult = await this.runCommand(
        'npm',
        ['run', 'build'],
        { cwd: projectPath, env: { ...process.env } },
        onProgress
      )

      if (!buildResult.success) {
        // Combine stdout and stderr for full build output
        const fullOutput = buildResult.output + '\n' + (buildResult.error || '')
        const logs = fullOutput.split('\n').filter(line => line.trim())

        // Extract meaningful error summary
        const errorSummary = this.extractErrorSummary(logs)

        // Save logs to netlify.md
        this.saveNetlifyErrorLogs(projectPath, logs)

        // Send progress message for StatusSheet to detect
        onProgress(`❌ Build: FAILED${errorSummary ? ` - ${errorSummary}` : ''}`)

        return { success: false, error: `Build failed: ${errorSummary || buildResult.error}` }
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
              onProgress(`📎 Found existing Netlify site: ${stateContent.siteId.substring(0, 8)}...`)
            }
          } catch (e) {
            console.warn('⚠️ [NETLIFY] Could not read state.json:', e)
          }
        }
      }

      // Step 3: Create site if still no siteId
      if (!siteId) {
        onProgress('🌐 Creating Netlify site...')

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
              } else if (service.name.toLowerCase().includes('frontend')) {
                frontendServiceId = service.id
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
            projectPath,
            onProgress
          )

          if (!pollResult.success) {
            // Check which services failed and extract error summary
            const failedServices = servicesToPoll
              .filter(s => pollResult.statuses[s.id] === 'FAILED' || pollResult.statuses[s.id] === 'CRASHED')

            if (failedServices.length > 0) {
              // Build error message with actual error from logs
              const errorDetails = failedServices.map(s => {
                const logs = pollResult.errorLogs[s.id] || []
                // Extract the most relevant error line (look for error patterns)
                const errorLine = this.extractErrorSummary(logs)
                return `${s.name}: ${errorLine || pollResult.statuses[s.id]}`
              }).join('\n')

              return {
                success: false,
                error: `Build failed:\n${errorDetails}`,
                projectId: projectId || undefined
              }
            }
          }
        }

        onProgress(`✅ Full-stack deployed! Frontend: ${frontendUrl}`)

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
            projectPath,
            onProgress
          )

          if (!pollResult.success) {
            const status = pollResult.statuses[serviceId]
            if (status === 'FAILED' || status === 'CRASHED') {
              // Extract error summary from logs
              const logs = pollResult.errorLogs[serviceId] || []
              const errorLine = this.extractErrorSummary(logs)
              return {
                success: false,
                error: `Build failed: ${errorLine || status}`,
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
   * Save Railway error logs to project's .codedeck/logs/railway.md
   * Clears the file before writing (only keeps latest error)
   */
  private saveRailwayErrorLogs(projectPath: string, serviceName: string, logs: string[]): void {
    try {
      const logsDir = path.join(projectPath, '.codedeck', 'logs')
      const railwayLogPath = path.join(logsDir, 'railway.md')

      // Ensure directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      // Build log content with header
      const timestamp = new Date().toISOString()
      const content = `# Railway Build Error - ${serviceName}\n` +
        `**Timestamp:** ${timestamp}\n\n` +
        `## Build Logs\n\n` +
        '```\n' +
        logs.join('\n') +
        '\n```\n'

      // Clear and write (only keep latest error)
      fs.writeFileSync(railwayLogPath, content, 'utf-8')
      console.log(`📝 [RAILWAY] Error logs saved to ${railwayLogPath}`)
    } catch (error) {
      console.error('❌ [RAILWAY] Failed to save error logs:', error)
    }
  }

  /**
   * Save Netlify build error logs to project's .codedeck/logs/netlify.md
   * Clears the file before writing (only keeps latest error)
   */
  private saveNetlifyErrorLogs(projectPath: string, logs: string[]): void {
    try {
      const logsDir = path.join(projectPath, '.codedeck', 'logs')
      const netlifyLogPath = path.join(logsDir, 'netlify.md')

      // Ensure directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      // Build log content with header
      const timestamp = new Date().toISOString()
      const content = `# Netlify Build Error\n` +
        `**Timestamp:** ${timestamp}\n\n` +
        `## Build Logs\n\n` +
        '```\n' +
        logs.join('\n') +
        '\n```\n'

      // Clear and write (only keep latest error)
      fs.writeFileSync(netlifyLogPath, content, 'utf-8')
      console.log(`📝 [NETLIFY] Error logs saved to ${netlifyLogPath}`)
    } catch (error) {
      console.error('❌ [NETLIFY] Failed to save error logs:', error)
    }
  }

  /**
   * Save Vercel error logs to project's .codedeck/logs/vercel.md
   * Clears the file before writing (only keeps latest error)
   */
  private saveVercelErrorLogs(projectPath: string, logs: string[]): void {
    try {
      const logsDir = path.join(projectPath, '.codedeck', 'logs')
      const vercelLogPath = path.join(logsDir, 'vercel.md')

      // Ensure directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      // Build log content with header
      const timestamp = new Date().toISOString()
      const content = `# Vercel Build Error\n` +
        `**Timestamp:** ${timestamp}\n\n` +
        `## Build Logs\n\n` +
        '```\n' +
        logs.join('\n') +
        '\n```\n'

      // Clear and write (only keep latest error)
      fs.writeFileSync(vercelLogPath, content, 'utf-8')
    } catch (error) {
      console.error('❌ [VERCEL] Failed to save error logs:', error)
    }
  }

  /**
   * Extract a meaningful error summary from build logs
   * Looks for common error patterns and returns the most relevant line
   */
  private extractErrorSummary(logs: string[]): string | null {
    if (logs.length === 0) return null

    // Common error patterns to look for (in priority order)
    const errorPatterns = [
      /error\[E\d+\]:/i,                    // Rust errors
      /error: /i,                            // Generic error
      /Error: /,                             // Node/JS errors
      /failed to compile/i,                  // Build failures
      /Cannot find module/i,                 // Module not found
      /Module not found/i,                   // Webpack module errors
      /SyntaxError/i,                        // Syntax errors
      /TypeError/i,                          // Type errors
      /ReferenceError/i,                     // Reference errors
      /ENOENT/i,                             // File not found
      /npm ERR!/i,                           // npm errors
      /exit code 1/i,                        // Generic exit failure
      /Build failed/i,                       // Build failure
      /command failed/i,                     // Command failure
    ]

    // Search logs from end to start (recent logs are more relevant)
    const reversedLogs = [...logs].reverse()

    for (const pattern of errorPatterns) {
      for (const line of reversedLogs) {
        if (pattern.test(line)) {
          // Clean up the line and truncate if too long
          const cleanLine = line.trim().slice(0, 200)
          return cleanLine
        }
      }
    }

    // If no pattern matched, return the last non-empty line
    for (const line of reversedLogs) {
      const trimmed = line.trim()
      if (trimmed && trimmed.length > 10) {
        return trimmed.slice(0, 200)
      }
    }

    return null
  }

  /**
   * Fetch build logs for a Railway deployment
   * Returns the last N lines of build logs
   */
  private async fetchRailwayBuildLogs(
    token: string,
    deploymentId: string,
    limit: number = 100
  ): Promise<string[]> {
    try {
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: `
            query GetBuildLogs($deploymentId: String!, $limit: Int!) {
              buildLogs(deploymentId: $deploymentId, limit: $limit) {
                message
              }
            }
          `,
          variables: { deploymentId, limit }
        })
      })

      const result = await response.json() as any
      const logs = result.data?.buildLogs || []
      return logs.map((log: { message: string }) => log.message)
    } catch (error) {
      console.error('❌ [RAILWAY] Error fetching build logs:', error)
      return []
    }
  }

  /**
   * Post-deployment health check - monitors services for runtime crashes after successful deployment
   * Polls for ~20 seconds to catch services that crash on startup
   */
  private async postDeploymentHealthCheck(
    token: string,
    projectId: string,
    services: Array<{ id: string; name: string }>,
    environmentId: string,
    projectPath: string,
    deploymentIds: Record<string, string>,
    onProgress: (message: string) => void
  ): Promise<{ success: boolean; statuses: Record<string, string>; errorLogs: Record<string, string[]> }> {
    const healthCheckDurationMs = 20000 // 20 seconds
    const pollIntervalMs = 3000 // Poll every 3 seconds
    const startTime = Date.now()
    const statuses: Record<string, string> = {}
    const errorLogs: Record<string, string[]> = {}

    // Initialize all statuses as SUCCESS (they passed deployment)
    for (const service of services) {
      statuses[service.id] = 'SUCCESS'
    }

    while (Date.now() - startTime < healthCheckDurationMs) {
      try {
        // Query current deployment status to detect crashes
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

        // Check each service for crashes
        for (const service of services) {
          const serviceDeployment = deployments.find((d: any) => d.node.serviceId === service.id)
          const currentStatus = serviceDeployment?.node?.status || 'UNKNOWN'

          // Detect if service crashed after deployment
          if (currentStatus === 'CRASHED') {
            const prevStatus = statuses[service.id]
            statuses[service.id] = 'CRASHED'

            // Only log and fetch if this is a new crash
            if (prevStatus !== 'CRASHED') {
              console.log(`\n💥 [RAILWAY] ${service.name} crashed at runtime!`)
              onProgress(`💥 ${service.name}: CRASHED (runtime error)`)

              // Fetch deployment logs (runtime errors are in deploy logs, not build logs)
              const deploymentId = deploymentIds[service.id] || serviceDeployment?.node?.id
              if (deploymentId) {
                const logs = await this.fetchRailwayDeployLogs(token, deploymentId, 150)
                errorLogs[service.id] = logs

                if (logs.length > 0) {
                  console.log(`\n========== ${service.name} RUNTIME ERROR LOGS ==========`)
                  const relevantLogs = logs.slice(-50)
                  for (const line of relevantLogs) {
                    console.log(line)
                  }
                  console.log(`========== END ${service.name} LOGS ==========\n`)

                  // Save logs to railway.md
                  this.saveRailwayErrorLogs(projectPath, service.name, logs)

                  // Send detailed error message
                  const errorSummary = this.extractErrorSummary(logs)
                  onProgress(`❌ ${service.name}: CRASHED${errorSummary ? ` - ${errorSummary}` : ''}`)
                } else {
                  console.log(`⚠️ [RAILWAY] No runtime logs available for ${service.name}`)
                }
              }

              // Return immediately on crash detection
              return { success: false, statuses, errorLogs }
            }
          }
        }

      } catch (error) {
        console.error('❌ [RAILWAY] Error during health check:', error)
        // Continue checking despite errors
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
    }

    // Health check passed - all services still running
    onProgress('✅ All services running')
    return { success: true, statuses, errorLogs }
  }

  /**
   * Fetch deploy/runtime logs for a Railway deployment
   * Different from build logs - these are the logs from when the service runs
   */
  private async fetchRailwayDeployLogs(
    token: string,
    deploymentId: string,
    limit: number = 100
  ): Promise<string[]> {
    try {
      const response = await fetch('https://backboard.railway.app/graphql/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: `
            query GetDeployLogs($deploymentId: String!, $limit: Int!) {
              deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
                message
              }
            }
          `,
          variables: { deploymentId, limit }
        })
      })

      const result = await response.json() as any
      const logs = result.data?.deploymentLogs || []
      return logs.map((log: { message: string }) => log.message)
    } catch (error) {
      console.error('❌ [RAILWAY] Error fetching deploy logs:', error)
      return []
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
    projectPath: string,
    onProgress: (message: string) => void,
    maxWaitMs: number = 300000 // 5 minutes max
  ): Promise<{ success: boolean; statuses: Record<string, string>; errorLogs: Record<string, string[]> }> {
    const startTime = Date.now()
    const pollIntervalMs = 5000 // Poll every 5 seconds
    const statuses: Record<string, string> = {}
    const deploymentIds: Record<string, string> = {} // Track deployment ID for each service
    const errorLogs: Record<string, string[]> = {} // Store error logs for failed services

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
          const deploymentId = serviceDeployment?.node?.id
          const prevStatus = statuses[service.id]

          statuses[service.id] = status
          if (deploymentId) {
            deploymentIds[service.id] = deploymentId
          }

          // Log status changes
          if (prevStatus !== status) {
            const statusEmoji = status === 'SUCCESS' ? '✅' : status === 'BUILDING' ? '🔨' : status === 'DEPLOYING' ? '🚀' : status === 'FAILED' ? '❌' : '⏳'
            onProgress(`${statusEmoji} ${service.name}: ${status}`)
          }

          if (!terminalStatuses.includes(status)) {
            allTerminal = false
          }
          if (status === 'FAILED' || status === 'CRASHED') {
            anyFailed = true
          }
        }

        // If all services have reached terminal status, check for failures
        if (allTerminal && services.length > 0) {
          // If any service failed during build/deploy, handle it
          if (anyFailed) {
            // Fetch error logs for any failed services
            for (const service of services) {
              const status = statuses[service.id]
              const deploymentId = deploymentIds[service.id]

              if ((status === 'FAILED' || status === 'CRASHED') && deploymentId) {
                console.log(`\n❌ [RAILWAY] ${service.name} build failed. Fetching logs...`)
                const logs = await this.fetchRailwayBuildLogs(token, deploymentId, 150)
                errorLogs[service.id] = logs

                // Log the error to console
                if (logs.length > 0) {
                  console.log(`\n========== ${service.name} BUILD ERROR LOGS ==========`)
                  const relevantLogs = logs.slice(-50)
                  for (const line of relevantLogs) {
                    console.log(line)
                  }
                  console.log(`========== END ${service.name} LOGS ==========\n`)

                  // Save logs to railway.md
                  this.saveRailwayErrorLogs(projectPath, service.name, logs)

                  // Extract error summary and send progress message
                  const errorSummary = this.extractErrorSummary(logs)
                  onProgress(`❌ ${service.name}: FAILED${errorSummary ? ` - ${errorSummary}` : ''}`)
                } else {
                  console.log(`⚠️ [RAILWAY] No build logs available for ${service.name}`)
                  onProgress(`❌ ${service.name}: FAILED`)
                }
              }
            }
            return { success: false, statuses, errorLogs }
          }

          // All services succeeded - now do post-deployment health check for runtime crashes
          onProgress('🔍 Verifying services are running...')
          const healthCheckResult = await this.postDeploymentHealthCheck(
            token,
            projectId,
            services,
            environmentId,
            projectPath,
            deploymentIds,
            onProgress
          )

          if (!healthCheckResult.success) {
            // A service crashed at runtime
            return {
              success: false,
              statuses: healthCheckResult.statuses,
              errorLogs: healthCheckResult.errorLogs
            }
          }

          // All services healthy!
          return { success: true, statuses, errorLogs }
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
    return { success: false, statuses, errorLogs }
  }

  /**
   * Deploy to Vercel - handles frontend-only projects
   */
  async deployVercel(
    projectPath: string,
    projectName: string,
    token: string,
    envVars: Record<string, string>,
    existingProjectId: string | null,
    onProgress: (message: string) => void
  ): Promise<DeployResult> {
    const cliCommand = this.getCliCommand('vercel')
    if (!cliCommand) {
      return { success: false, error: 'Vercel CLI not available' }
    }

    const { cmd, baseArgs } = cliCommand
    const env = this.getCliEnv('vercel', token)

    try {
      // Step 1: Build the project
      onProgress('📦 Building project...')

      // Determine if we should build from frontend/ or root
      const hasFrontend = fs.existsSync(path.join(projectPath, 'frontend'))
      const buildCwd = hasFrontend ? path.join(projectPath, 'frontend') : projectPath

      const buildResult = await this.runCommand(
        'npm',
        ['run', 'build'],
        { cwd: buildCwd, env: { ...process.env } },
        onProgress
      )

      if (!buildResult.success) {
        const fullOutput = buildResult.output + '\n' + (buildResult.error || '')
        const logs = fullOutput.split('\n').filter(line => line.trim())
        const errorSummary = this.extractErrorSummary(logs)

        // Save logs to vercel.md
        this.saveVercelErrorLogs(projectPath, logs)

        onProgress(`❌ Build: FAILED${errorSummary ? ` - ${errorSummary}` : ''}`)
        return { success: false, error: `Build failed: ${errorSummary || buildResult.error}` }
      }

      onProgress('✅ Build complete!')

      // Determine build directory
      const possibleBuildDirs = hasFrontend
        ? ['frontend/dist', 'frontend/build', 'frontend/.next', 'frontend/out']
        : ['dist', 'build', '.next', 'out']
      let buildDir: string | null = null

      for (const dir of possibleBuildDirs) {
        const checkPath = path.join(projectPath, dir)
        if (fs.existsSync(checkPath)) {
          buildDir = dir
          break
        }
      }

      if (!buildDir) {
        return { success: false, error: `Build directory not found. Checked: ${possibleBuildDirs.join(', ')}` }
      }

      // Step 2: Deploy to Vercel
      onProgress('🚀 Deploying to Vercel...')

      // Build deploy args
      // --yes skips confirmation prompts and auto-links/creates project
      // --prod deploys to production
      // --token passed explicitly via CLI flag (more reliable than env var)
      const deployCwd = hasFrontend ? path.join(projectPath, 'frontend') : projectPath

      // Extract unique suffix from CodeDeck project path (e.g., proj_1765120725824_q4tbqega4 -> q4tbqega4)
      // This ensures globally unique Vercel project names even if two users have same project name
      const pathParts = projectPath.split('/')
      const codedeckProjectId = pathParts.find(p => p.startsWith('proj_')) || ''
      const uniqueSuffix = codedeckProjectId.split('_').pop() || Math.random().toString(36).substring(2, 8)

      // Clean project name for Vercel (lowercase, alphanumeric and hyphens only)
      // Format: codedeck-{projectname}-{uniquesuffix}
      const cleanProjectName = `codedeck-${projectName}-${uniqueSuffix}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 100) // Vercel has a max length

      // Check if this is a first deploy or redeploy
      const vercelConfigPath = path.join(deployCwd, '.vercel', 'project.json')
      const isFirstDeploy = !fs.existsSync(vercelConfigPath)

      // For first deploy, set the project name. For redeploy, Vercel uses .vercel/project.json
      const deployArgs = isFirstDeploy
        ? [...baseArgs, '--prod', '--yes', '--token', token, '--name', cleanProjectName]
        : [...baseArgs, '--prod', '--yes', '--token', token]

      const deployResult = await this.runCommand(
        cmd,
        deployArgs,
        { cwd: deployCwd, env },
        onProgress
      )

      if (!deployResult.success) {
        return { success: false, error: `Deploy failed: ${deployResult.error}` }
      }

      // Read project ID from .vercel/project.json
      let projectId = existingProjectId
      let url: string | null = null

      // After deploy, .vercel/project.json should exist with projectId and orgId
      if (fs.existsSync(vercelConfigPath)) {
        try {
          const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'))
          if (vercelConfig.projectId) {
            projectId = vercelConfig.projectId
          }
        } catch (e) {
          // Failed to read .vercel/project.json
        }
      }

      // Query Vercel API to get the production domain
      if (projectId) {
        try {
          const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          })

          if (response.ok) {
            const projectData = await response.json()
            // Get production domain - check aliases or targets
            const domains = projectData.targets?.production?.alias || projectData.alias || []
            const productionDomain = domains.find((d: string) => d.endsWith('.vercel.app'))

            if (productionDomain) {
              url = `https://${productionDomain}`
            }
          }
        } catch (e) {
          // Failed to query Vercel API
        }
      }

      // Fallback: parse URL from CLI output if API didn't work
      if (!url) {
        const previewUrlMatch = deployResult.output.match(/(https:\/\/[a-z0-9-]+\.vercel\.app)/i)
        url = previewUrlMatch?.[1] || null
      }

      // Step 3: Set environment variables via Vercel API
      if (Object.keys(envVars).length > 0 && projectId) {
        onProgress('🔐 Setting environment variables...')
        let envVarsSet = 0
        let envVarsFailed = 0

        for (const [key, value] of Object.entries(envVars)) {
          if (value && value.trim()) {
            try {
              // Use Vercel API to create/update environment variable
              // POST /v10/projects/{projectId}/env
              const response = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  key: key,
                  value: value,
                  type: 'encrypted', // Use encrypted for security
                  target: ['production', 'preview', 'development'], // Apply to all environments
                }),
              })

              if (response.ok) {
                envVarsSet++
              } else {
                // Check if it's a conflict (variable already exists)
                const responseText = await response.text()
                const isConflict = response.status === 409 || responseText.includes('ENV_CONFLICT')

                if (isConflict) {
                  // Variable already exists, try to update it
                  const listResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                  })

                  if (listResponse.ok) {
                    const envList = await listResponse.json()
                    const existingVar = envList.envs?.find((e: any) => e.key === key)

                    if (existingVar) {
                      // PATCH to update existing variable
                      const updateResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env/${existingVar.id}`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          value: value,
                        }),
                      })

                      if (updateResponse.ok) {
                        envVarsSet++
                      } else {
                        envVarsFailed++
                      }
                    } else {
                      envVarsFailed++
                    }
                  } else {
                    envVarsFailed++
                  }
                } else {
                  envVarsFailed++
                }
              }
            } catch (e) {
              envVarsFailed++
            }
          }
        }

        if (envVarsSet > 0) {
          onProgress(`✅ Set ${envVarsSet} environment variable${envVarsSet > 1 ? 's' : ''}`)
        }
        if (envVarsFailed > 0) {
          onProgress(`⚠️ Failed to set ${envVarsFailed} environment variable${envVarsFailed > 1 ? 's' : ''}`)
        }

        // Note: Env vars are applied immediately to new deployments
        // No need to redeploy - the current deployment already has them
      }

      onProgress(`✅ Deployed successfully!${url ? ` Live at: ${url}` : ''}`)

      return {
        success: true,
        url: url || undefined,
        projectId: projectId || undefined
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ [VERCEL] Deploy error:', error)
      return { success: false, error: errMsg }
    }
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
    } else if (provider === 'vercel') {
      return this.deployVercel(projectPath, projectName, token, envVars, existingId, onProgress)
    }
    return { success: false, error: `Unknown provider: ${provider}` }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService()
