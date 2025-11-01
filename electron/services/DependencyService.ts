import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

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
   * @returns Promise that resolves when installation completes
   */
  async installDependencies(
    projectPath: string,
    onProgress?: (data: string) => void
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

        console.log(`📦 Installing dependencies in: ${projectPath}`)

        // Spawn npm install process
        const npmProcess = spawn('npm', ['install'], {
          cwd: projectPath,
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe']
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
        })

        // Capture stderr
        npmProcess.stderr?.on('data', (data) => {
          const text = data.toString()
          errorOutput += text
          if (onProgress) {
            onProgress(text)
          }
        })

        // Handle process completion
        npmProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Dependencies installed successfully')
            resolve({ success: true })
          } else {
            console.error('❌ npm install failed with code:', code)
            resolve({
              success: false,
              error: errorOutput || `npm install exited with code ${code}`
            })
          }
        })

        // Handle process errors
        npmProcess.on('error', (error) => {
          console.error('❌ Failed to spawn npm install:', error)
          resolve({
            success: false,
            error: error.message
          })
        })
      } catch (error) {
        console.error('❌ Error during dependency installation:', error)
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
    onProgress?: (data: string) => void
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
      const rootResult = await this.installDependencies(projectPath, onProgress)
      if (!rootResult.success) {
        return rootResult
      }
    }

    // Install frontend dependencies
    if (hasFrontend) {
      if (onProgress) onProgress('\n📦 Installing frontend dependencies...\n')
      const frontendResult = await this.installDependencies(frontendPath, onProgress)
      if (!frontendResult.success) {
        return frontendResult
      }
    }

    // Install backend dependencies
    if (hasBackend) {
      if (onProgress) onProgress('\n📦 Installing backend dependencies...\n')
      const backendResult = await this.installDependencies(backendPath, onProgress)
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
