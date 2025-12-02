/**
 * DeploymentService
 * Manages CLI paths and deployment operations for Railway and Netlify
 */

import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { spawn } from 'child_process'

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
   * Get the command to execute CLI (different for Railway vs Netlify)
   */
  getCliCommand(provider: DeploymentProvider): { cmd: string; baseArgs: string[] } | null {
    if (provider === 'railway') {
      if (!this.railwayCliPath) return null
      return {
        cmd: this.railwayCliPath,
        baseArgs: []
      }
    } else if (provider === 'netlify') {
      if (!this.netlifyCliPath) return null
      // Netlify CLI needs to be run with Node.js
      return {
        cmd: process.execPath,
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
      return {
        ...baseEnv,
        RAILWAY_TOKEN: token,
        CI: 'true' // Non-interactive mode
      }
    } else if (provider === 'netlify') {
      return {
        ...baseEnv,
        NETLIFY_AUTH_TOKEN: token,
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
}

// Export singleton instance
export const deploymentService = new DeploymentService()
