import { simpleGit, SimpleGit, CleanOptions } from 'simple-git'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { terminalAggregator } from './TerminalAggregator'

class TemplateService {
  private git: SimpleGit

  constructor() {
    this.git = simpleGit()
  }

  /**
   * Get the base directory for projects
   * ~/Documents/CodeDeck/{userId}/Projects/
   */
  private getProjectsBaseDir(userId: string): string {
    const homeDir = app.getPath('home')
    return path.join(homeDir, 'Documents', 'CodeDeck', userId, 'Projects')
  }

  /**
   * Ensure the projects base directory exists
   */
  private ensureProjectsDir(userId: string): void {
    const baseDir = this.getProjectsBaseDir(userId)
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
  }

  /**
   * Clone a template from GitHub
   * @param githubUrl - GitHub repository URL
   * @param projectName - Name of the project (will be sanitized for directory name)
   * @param userId - User ID for project isolation
   * @param projectId - Optional project ID for terminal output
   * @returns Full path to the cloned project
   */
  async cloneTemplate(githubUrl: string, projectName: string, userId: string, projectId?: string): Promise<string> {
    try {
      // Ensure projects directory exists
      this.ensureProjectsDir(userId)

      // Use project ID as folder name (immutable) instead of project name
      // This prevents issues when renaming projects - folder never changes
      if (!projectId) {
        throw new Error('Project ID is required for cloning template')
      }
      const dirName = projectId
      const projectPath = path.join(this.getProjectsBaseDir(userId), dirName)

      // Check if directory already exists
      if (fs.existsSync(projectPath)) {
        throw new Error(`Project directory already exists: ${dirName}`)
      }


      // Send to terminal if projectId provided
      if (projectId) {
        terminalAggregator.addGitLine(projectId, `Cloning template from ${githubUrl}...\n`)
      }

      // Clone the repository
      await this.git.clone(githubUrl, projectPath, {
        '--depth': 1 // Shallow clone for faster cloning
      })


      if (projectId) {
        terminalAggregator.addGitLine(projectId, `✓ Template cloned successfully to ${projectPath}\n`)
      }

      // Remove .git directory to detach from template repo
      const gitDir = path.join(projectPath, '.git')
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true })

        if (projectId) {
          terminalAggregator.addGitLine(projectId, `✓ Removed template .git directory\n`)
        }
      }

      // Initialize new git repository
      const projectGit = simpleGit(projectPath)
      await projectGit.init()

      if (projectId) {
        terminalAggregator.addGitLine(projectId, `✓ Initialized new git repository\n`)
      }

      return projectPath
    } catch (error) {
      console.error('❌ Failed to clone template:', error)

      if (projectId) {
        terminalAggregator.addGitLine(projectId, `✗ Failed to clone template: ${error instanceof Error ? error.message : 'Unknown error'}\n`, 'stderr')
      }

      throw error
    }
  }

  /**
   * Sanitize project name to be safe for directory names
   * Converts to lowercase, replaces spaces with dashes, removes special chars
   */
  private sanitizeProjectName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')           // Replace spaces with dashes
      .replace(/[^a-z0-9-_]/g, '')    // Remove special characters
      .replace(/-+/g, '-')            // Replace multiple dashes with single dash
      .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
  }

  /**
   * Check if a project directory exists by project ID
   */
  projectExists(projectId: string, userId: string): boolean {
    const projectPath = path.join(this.getProjectsBaseDir(userId), projectId)
    return fs.existsSync(projectPath)
  }

  /**
   * Get full project path from project ID
   * @param projectId - Project ID (used as folder name)
   * @param userId - User ID
   */
  getProjectPath(projectId: string, userId: string): string {
    return path.join(this.getProjectsBaseDir(userId), projectId)
  }

  /**
   * Update frontend vite.config.ts with allocated Vite port
   * @param projectPath - Absolute path to project root
   * @param vitePort - Allocated Vite port number
   */
  updateViteConfig(projectPath: string, vitePort: number): void {
    const viteConfigPath = path.join(projectPath, 'frontend', 'vite.config.ts')

    if (!fs.existsSync(viteConfigPath)) {
      console.warn('⚠️ vite.config.ts not found, skipping port update')
      return
    }

    try {
      let config = fs.readFileSync(viteConfigPath, 'utf-8')

      // Replace port configuration (handles both numeric and env var formats)
      // Match: port: 5174, port: 3000, port: parseInt(...), etc.
      config = config.replace(
        /port:\s*(?:\d+|parseInt\([^)]+\))/g,
        `port: ${vitePort}`
      )

      fs.writeFileSync(viteConfigPath, config, 'utf-8')
    } catch (error) {
      console.error('❌ Failed to update vite.config.ts:', error)
      throw error
    }
  }

  /**
   * Update netlify.toml with allocated Vite port (targetPort)
   * @param projectPath - Absolute path to project root
   * @param vitePort - Allocated Vite port number
   */
  updateNetlifyToml(projectPath: string, vitePort: number): void {
    const netlifyTomlPath = path.join(projectPath, 'netlify.toml')

    if (!fs.existsSync(netlifyTomlPath)) {
      console.warn('⚠️ netlify.toml not found, skipping port update')
      return
    }

    try {
      let config = fs.readFileSync(netlifyTomlPath, 'utf-8')

      // Replace targetPort configuration
      // Match: targetPort = 5174, targetPort = 3000, etc.
      config = config.replace(
        /targetPort\s*=\s*\d+/g,
        `targetPort = ${vitePort}`
      )

      fs.writeFileSync(netlifyTomlPath, config, 'utf-8')
    } catch (error) {
      console.error('❌ Failed to update netlify.toml:', error)
      throw error
    }
  }
}

export const templateService = new TemplateService()
