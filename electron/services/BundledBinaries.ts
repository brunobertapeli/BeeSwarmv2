/**
 * Helper to get paths to bundled Node.js and npm binaries
 * These are bundled with the app so users don't need Node installed
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { app } from 'electron'

class BundledBinaries {
  private basePath: string | null = null

  /**
   * Get the platform folder name based on current OS
   */
  private getPlatformFolder(): string {
    const platform = process.platform
    const arch = process.arch

    if (platform === 'darwin') {
      return arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
    } else if (platform === 'win32') {
      return 'win32-x64'
    } else {
      return 'linux-x64'
    }
  }

  /**
   * Get the base path for bundled binaries based on platform
   */
  private getBasePath(): string {
    if (this.basePath) return this.basePath

    const platformFolder = this.getPlatformFolder()

    // In production, binaries are in resources/binaries
    // In development, binaries are in resources/binaries/<platform>
    if (app.isPackaged) {
      this.basePath = path.join(process.resourcesPath, 'binaries')
    } else {
      // app.getAppPath() returns project root in dev mode
      this.basePath = path.join(app.getAppPath(), 'resources', 'binaries', platformFolder)
    }

    return this.basePath
  }

  /**
   * Get path to bundled Node.js executable
   */
  get nodePath(): string {
    const basePath = this.getBasePath()
    const nodeBinary = process.platform === 'win32' ? 'node.exe' : 'node'
    return path.join(basePath, nodeBinary)
  }

  /**
   * Get path to bundled npm CLI wrapper
   */
  get npmPath(): string {
    const basePath = this.getBasePath()
    const npmBinary = process.platform === 'win32' ? 'npm-cli.cmd' : 'npm-cli'
    return path.join(basePath, npmBinary)
  }

  /**
   * Get path to bundled npx CLI wrapper
   */
  get npxPath(): string {
    const basePath = this.getBasePath()
    const npxBinary = process.platform === 'win32' ? 'npx-cli.cmd' : 'npx-cli'
    return path.join(basePath, npxBinary)
  }

  /**
   * Get path to bundled Git executable
   * - Windows: uses MinGit in git/ subfolder
   * - macOS/Linux: wrapper script that uses system git
   */
  get gitPath(): string {
    const basePath = this.getBasePath()
    if (process.platform === 'win32') {
      return path.join(basePath, 'git', 'cmd', 'git.exe')
    }
    return path.join(basePath, 'git')
  }

  /**
   * Get path to bundled GitHub CLI (gh) executable
   */
  get ghPath(): string {
    const basePath = this.getBasePath()
    const ghBinary = process.platform === 'win32' ? 'gh.exe' : 'gh'
    return path.join(basePath, ghBinary)
  }

  /**
   * Check if bundled binaries exist
   */
  isAvailable(): boolean {
    return fs.existsSync(this.nodePath) && fs.existsSync(this.npmPath)
  }

  /**
   * Check if Git is available (bundled or system)
   */
  isGitAvailable(): boolean {
    return fs.existsSync(this.gitPath)
  }

  /**
   * Check if GitHub CLI is available
   */
  isGhAvailable(): boolean {
    return fs.existsSync(this.ghPath)
  }

  /**
   * Get path to bundled Claude Code CLI executable
   */
  get claudePath(): string {
    const basePath = this.getBasePath()
    const claudeBinary = process.platform === 'win32' ? 'claude.exe' : 'claude'
    return path.join(basePath, claudeBinary)
  }

  /**
   * Check if Claude Code CLI is available (bundled or system)
   */
  isClaudeAvailable(): boolean {
    // First check bundled path
    console.log('[BundledBinaries] Checking bundled Claude path:', this.claudePath)
    if (fs.existsSync(this.claudePath)) {
      console.log('[BundledBinaries] Found bundled Claude')
      return true
    }

    // Check common installation locations
    const systemClaudePath = this.findSystemClaudePath()
    if (systemClaudePath) {
      console.log('[BundledBinaries] Found Claude at:', systemClaudePath)
      return true
    }

    console.log('[BundledBinaries] Claude not found')
    return false
  }

  /**
   * Find Claude CLI in common system locations
   */
  private findSystemClaudePath(): string | null {
    const homeDir = os.homedir()
    const possiblePaths: string[] = []

    if (process.platform === 'win32') {
      // Official Windows installation paths (from docs.claude.com)
      possiblePaths.push(
        // Native installer location
        path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'claude.exe'),
        path.join(homeDir, 'AppData', 'Local', 'Programs', 'claude-code', 'claude.exe'),
        // npm global installations
        path.join(homeDir, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
        path.join(homeDir, 'AppData', 'Roaming', 'npm', 'claude'),
        path.join(homeDir, 'AppData', 'Local', 'pnpm', 'claude.cmd'),
        // Program Files
        'C:\\Program Files\\nodejs\\claude.cmd',
        'C:\\Program Files\\ClaudeCode\\claude.exe',
      )

      // Check nvm-windows installations
      const nvmWindowsDir = path.join(homeDir, 'AppData', 'Roaming', 'nvm')
      if (fs.existsSync(nvmWindowsDir)) {
        try {
          const nodeVersions = fs.readdirSync(nvmWindowsDir).filter(v => v.startsWith('v'))
          for (const version of nodeVersions) {
            possiblePaths.push(path.join(nvmWindowsDir, version, 'claude.cmd'))
            possiblePaths.push(path.join(nvmWindowsDir, version, 'claude'))
          }
        } catch {}
      }
    } else {
      // macOS / Linux
      possiblePaths.push(
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        path.join(homeDir, '.local', 'bin', 'claude'),
        // npm global locations
        '/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js',
        path.join(homeDir, '.npm-global', 'bin', 'claude'),
      )

      // Check nvm installations (macOS/Linux)
      const nvmDir = path.join(homeDir, '.nvm', 'versions', 'node')
      if (fs.existsSync(nvmDir)) {
        try {
          const nodeVersions = fs.readdirSync(nvmDir)
          for (const version of nodeVersions) {
            possiblePaths.push(path.join(nvmDir, version, 'bin', 'claude'))
          }
        } catch {}
      }

      // Check fnm installations (macOS)
      const fnmDir = path.join(homeDir, 'Library', 'Application Support', 'fnm', 'node-versions')
      if (fs.existsSync(fnmDir)) {
        try {
          const nodeVersions = fs.readdirSync(fnmDir)
          for (const version of nodeVersions) {
            possiblePaths.push(path.join(fnmDir, version, 'installation', 'bin', 'claude'))
          }
        } catch {}
      }
    }

    for (const claudePath of possiblePaths) {
      if (fs.existsSync(claudePath)) {
        return claudePath
      }
    }

    return null
  }

  /**
   * Get the effective Claude CLI path (bundled or system)
   */
  getEffectiveClaudePath(): string {
    if (fs.existsSync(this.claudePath)) {
      return this.claudePath
    }
    // Check common installation locations
    const systemPath = this.findSystemClaudePath()
    if (systemPath) {
      return systemPath
    }
    // Fallback to system claude (will be found via PATH)
    return 'claude'
  }

  /**
   * Get environment variables with bundled binaries in PATH
   * This ensures child processes can find node/npm
   */
  getEnvWithBundledPath(): NodeJS.ProcessEnv {
    const basePath = this.getBasePath()
    return {
      ...process.env,
      PATH: `${basePath}${path.delimiter}${process.env.PATH}`,
    }
  }

  /**
   * Get node command and args for spawning npm
   * Returns { command, args } where command is node and args include npm-cli.js path
   */
  getNpmSpawnConfig(npmArgs: string[]): { command: string; args: string[] } {
    const basePath = this.getBasePath()
    const npmCliJs = path.join(basePath, 'npm', 'bin', 'npm-cli.js')

    return {
      command: this.nodePath,
      args: [npmCliJs, ...npmArgs],
    }
  }

  /**
   * Get node command and args for spawning npx
   */
  getNpxSpawnConfig(npxArgs: string[]): { command: string; args: string[] } {
    const basePath = this.getBasePath()
    const npxCliJs = path.join(basePath, 'npm', 'bin', 'npx-cli.js')

    return {
      command: this.nodePath,
      args: [npxCliJs, ...npxArgs],
    }
  }
}

export const bundledBinaries = new BundledBinaries()
