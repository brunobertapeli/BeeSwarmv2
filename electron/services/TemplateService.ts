import { simpleGit, SimpleGit, CleanOptions } from 'simple-git'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

class TemplateService {
  private git: SimpleGit

  constructor() {
    this.git = simpleGit()
  }

  /**
   * Get the base directory for projects
   * ~/Documents/BeeSwarm/Projects/
   */
  private getProjectsBaseDir(): string {
    const homeDir = app.getPath('home')
    return path.join(homeDir, 'Documents', 'BeeSwarm', 'Projects')
  }

  /**
   * Ensure the projects base directory exists
   */
  private ensureProjectsDir(): void {
    const baseDir = this.getProjectsBaseDir()
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
      console.log('✅ Created projects directory:', baseDir)
    }
  }

  /**
   * Clone a template from GitHub
   * @param githubUrl - GitHub repository URL
   * @param projectName - Name of the project (will be sanitized for directory name)
   * @returns Full path to the cloned project
   */
  async cloneTemplate(githubUrl: string, projectName: string): Promise<string> {
    try {
      // Ensure projects directory exists
      this.ensureProjectsDir()

      // Sanitize project name for directory
      const dirName = this.sanitizeProjectName(projectName)
      const projectPath = path.join(this.getProjectsBaseDir(), dirName)

      // Check if directory already exists
      if (fs.existsSync(projectPath)) {
        throw new Error(`Project directory already exists: ${dirName}`)
      }

      console.log('📦 Cloning template...')
      console.log('   GitHub URL:', githubUrl)
      console.log('   Destination:', projectPath)

      // Clone the repository
      await this.git.clone(githubUrl, projectPath, {
        '--depth': 1 // Shallow clone for faster cloning
      })

      console.log('✅ Template cloned successfully')

      // Remove .git directory to detach from template repo
      const gitDir = path.join(projectPath, '.git')
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true })
        console.log('✅ Removed .git directory')
      }

      // Initialize new git repository
      const projectGit = simpleGit(projectPath)
      await projectGit.init()
      console.log('✅ Initialized new git repository')

      return projectPath
    } catch (error) {
      console.error('❌ Failed to clone template:', error)
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
   * Check if a project directory exists
   */
  projectExists(projectName: string): boolean {
    const dirName = this.sanitizeProjectName(projectName)
    const projectPath = path.join(this.getProjectsBaseDir(), dirName)
    return fs.existsSync(projectPath)
  }

  /**
   * Get full project path
   */
  getProjectPath(projectName: string): string {
    const dirName = this.sanitizeProjectName(projectName)
    return path.join(this.getProjectsBaseDir(), dirName)
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
      console.log(`✅ Updated vite.config.ts with port ${vitePort}`)
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
      console.log(`✅ Updated netlify.toml with targetPort ${vitePort}`)
    } catch (error) {
      console.error('❌ Failed to update netlify.toml:', error)
      throw error
    }
  }
}

export const templateService = new TemplateService()
