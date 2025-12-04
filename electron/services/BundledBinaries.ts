/**
 * Helper to get paths to bundled Node.js and npm binaries
 * These are bundled with the app so users don't need Node installed
 */

import path from 'path'
import fs from 'fs'
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
