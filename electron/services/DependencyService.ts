import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { terminalAggregator } from './TerminalAggregator'
import { bundledBinaries } from './BundledBinaries'

/**
 * Service for managing npm dependencies in project directories
 */
class DependencyService {
  /**
   * Check if package.json exists in a directory
   */
  hasPackageJson(projectPath: string): boolean {
    const packageJsonPath = path.join(projectPath, 'package.json')
    return fs.existsSync(packageJsonPath)
  }

  /**
   * Install dependencies using npm install
   * @param projectPath - Absolute path to project directory
   * @param onProgress - Callback for streaming output
   * @param projectId - Optional project ID for terminal output
   * @returns Promise that resolves when installation completes
   */
  async installDependencies(
    projectPath: string,
    onProgress?: (data: string) => void,
    projectId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      try {
        // Check if package.json exists
        if (!this.hasPackageJson(projectPath)) {
          resolve({
            success: false,
            error: 'No package.json found in project directory'
          })
          return
        }


        if (projectId) {
          terminalAggregator.addNpmLine(projectId, `Installing dependencies in ${path.basename(projectPath)}...\n`)
        }

        // Use bundled Node/npm binaries
        const { command, args } = bundledBinaries.getNpmSpawnConfig(['install'])
        const env = bundledBinaries.getEnvWithBundledPath()

        // Spawn npm install process using bundled binaries
        const npmProcess = spawn(command, args, {
          cwd: projectPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env
        })

        let output = ''
        let errorOutput = ''

        // Capture stdout
        npmProcess.stdout?.on('data', (data) => {
          const text = data.toString()
          output += text
          if (onProgress) {
            onProgress(text)
          }
          // Also send to terminal
          if (projectId) {
            terminalAggregator.addNpmLine(projectId, text)
          }
        })

        // Capture stderr
        npmProcess.stderr?.on('data', (data) => {
          const text = data.toString()
          errorOutput += text
          if (onProgress) {
            onProgress(text)
          }
          // Also send to terminal
          if (projectId) {
            terminalAggregator.addNpmLine(projectId, text, 'stderr')
          }
        })

        // Handle process completion
        npmProcess.on('close', (code) => {
          if (code === 0) {
            if (projectId) {
              terminalAggregator.addNpmLine(projectId, `✓ Dependencies installed successfully\n`)
            }
            resolve({ success: true })
          } else {
            console.error('❌ npm install failed with code:', code)
            if (projectId) {
              terminalAggregator.addNpmLine(projectId, `✗ npm install failed with code ${code}\n`, 'stderr')
            }
            resolve({
              success: false,
              error: errorOutput || `npm install exited with code ${code}`
            })
          }
        })

        // Handle process errors
        npmProcess.on('error', (error) => {
          console.error('❌ Failed to spawn npm install:', error)
          if (projectId) {
            terminalAggregator.addNpmLine(projectId, `✗ Failed to spawn npm install: ${error.message}\n`, 'stderr')
          }
          resolve({
            success: false,
            error: error.message
          })
        })
      } catch (error) {
        console.error('❌ Error during dependency installation:', error)
        if (projectId) {
          terminalAggregator.addNpmLine(projectId, `✗ Error during installation: ${error instanceof Error ? error.message : 'Unknown error'}\n`, 'stderr')
        }
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })
  }

  /**
   * Install dependencies for fullstack projects
   * Installs in order: root, frontend, backend
   * Root dependencies (e.g., netlify-cli) must be installed first
   */
  async installFullstackDependencies(
    projectPath: string,
    onProgress?: (data: string) => void,
    projectId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const frontendPath = path.join(projectPath, 'frontend')
    const backendPath = path.join(projectPath, 'backend')

    const hasRoot = this.hasPackageJson(projectPath)
    const hasFrontend = this.hasPackageJson(frontendPath)
    const hasBackend = this.hasPackageJson(backendPath)

    if (!hasRoot && !hasFrontend && !hasBackend) {
      return {
        success: false,
        error: 'No package.json found in project'
      }
    }

    // CRITICAL: Install root dependencies first (netlify-cli, etc.)
    if (hasRoot) {
      if (onProgress) onProgress('📦 Installing root dependencies (netlify-cli)...\n')
      if (projectId) {
        terminalAggregator.addNpmLine(projectId, '📦 Installing root dependencies (netlify-cli)...\n')
      }
      const rootResult = await this.installDependencies(projectPath, onProgress, projectId)
      if (!rootResult.success) {
        return rootResult
      }
    }

    // Install frontend dependencies
    if (hasFrontend) {
      if (onProgress) onProgress('\n📦 Installing frontend dependencies...\n')
      if (projectId) {
        terminalAggregator.addNpmLine(projectId, '\n📦 Installing frontend dependencies...\n')
      }
      const frontendResult = await this.installDependencies(frontendPath, onProgress, projectId)
      if (!frontendResult.success) {
        return frontendResult
      }
    }

    // Install backend dependencies
    if (hasBackend) {
      if (onProgress) onProgress('\n📦 Installing backend dependencies...\n')
      if (projectId) {
        terminalAggregator.addNpmLine(projectId, '\n📦 Installing backend dependencies...\n')
      }
      const backendResult = await this.installDependencies(backendPath, onProgress, projectId)
      if (!backendResult.success) {
        return backendResult
      }
    }

    return { success: true }
  }

  /**
   * Check if node_modules exists (dependencies already installed)
   */
  hasDependencies(projectPath: string): boolean {
    const nodeModulesPath = path.join(projectPath, 'node_modules')
    return fs.existsSync(nodeModulesPath)
  }
}

export const dependencyService = new DependencyService()
