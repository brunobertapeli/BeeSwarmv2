import { databaseService, Project } from './DatabaseService'
import { templateService } from './TemplateService'
import { templateValidator } from './TemplateValidator'
import { Template } from './BackendService'
import { getCurrentUserId } from '../main'
import { pathValidator } from '../utils/PathValidator'
import { DeploymentStrategyFactory } from './deployment'
import fs from 'fs'
import path from 'path'
import { shell, app } from 'electron'

class ProjectService {
  /**
   * Create a new project from a template
   * @param userId - User ID who owns this project (SECURITY: passed from authenticated handler)
   * @param templateId - Template ID
   * @param projectName - Name for the new project
   * @param template - Full template object from MongoDB
   * @param userEmail - User email for backend plan validation
   * @returns Created project metadata
   */
  async createProject(
    userId: string,
    templateId: string,
    projectName: string,
    template: Template,
    userEmail: string,
    tempImportProjectId?: string,
    screenshotData?: string,
    importType?: 'template' | 'screenshot' | 'ai'
  ): Promise<Project> {
    try {
      if (tempImportProjectId) {
      }
      if (screenshotData) {
      }

      // Step 1: Check if project name already exists for this user
      if (databaseService.projectNameExists(projectName, userId)) {
        throw new Error(`A project with the name "${projectName}" already exists`)
      }

      // Step 2: Create project in database with 'creating' status
      // Generate project record first to get ID (used as immutable folder name)
      const tempPath = 'temp' // Temporary, will be updated after we have the ID

      const project = databaseService.createProject({
        userId: userId, // SECURITY: Store userId with project
        name: projectName,
        path: tempPath, // Will be updated to use project ID
        templateId: templateId,
        templateName: template.name,
        techStack: template.techStack ? JSON.stringify(template.techStack) : null,
        status: 'creating',
        deployServices: template.deployServices ? JSON.stringify(template.deployServices) : null,
        envFiles: template.envFiles ? JSON.stringify(template.envFiles) : null,
        imagePath: template.imagePath || null,
        websiteImportAutoPromptSent: null,
        kanbanState: null,
        stickyNotesState: null,
        analyticsWidgetState: null,
        projectAssetsWidgetState: null,
        whiteboardWidgetState: null,
        iconsWidgetState: null
      })

      // Now that we have project ID, generate the real path using ID as folder name
      const projectPath = templateService.getProjectPath(project.id, userId)

      // Update project with correct path
      databaseService.renameProject(project.id, projectName, projectPath)


      try {
        // Step 3: Download and extract template from backend
        const clonedPath = await templateService.cloneTemplate(
          templateId, // Use template ID, not GitHub URL
          projectName,
          userId,
          project.id, // Pass projectId for terminal output
          userEmail // SECURITY: Pass user email for plan validation
        )


        // Step 4: Validate template structure based on deployment type
        const deployServices = template.deployServices || ['netlify']
        const validationResult = templateValidator.validate(clonedPath, deployServices)

        if (!validationResult.valid) {
          console.error('❌ Template validation failed:')
          validationResult.errors.forEach(error => console.error(`   • ${error}`))

          // Update status to error
          databaseService.updateProjectStatus(project.id, 'error')

          // Throw error with validation details
          throw new Error(
            `Template structure validation failed:\n${validationResult.errors.join('\n')}`
          )
        }

        // Log warnings but don't fail
        if (validationResult.warnings.length > 0) {
          console.warn('⚠️ Template validation warnings:')
          validationResult.warnings.forEach(warning => console.warn(`   • ${warning}`))
        }


        // Step 5: Allocate ports and update configuration files using deployment strategy
        const strategy = DeploymentStrategyFactory.create(deployServices)
        const ports = await strategy.allocatePorts(project.id)

        // Update project configs (vite.config.ts, netlify.toml, or backend .env depending on strategy)
        strategy.updateProjectConfigs(clonedPath, ports)


        // Step 6: Transfer website import data if this is an import project
        if (tempImportProjectId) {

          const tempDir = path.join(
            app.getPath('home'),
            'Documents',
            'CodeDeck',
            userId,
            'temp',
            tempImportProjectId
          )

          if (fs.existsSync(tempDir)) {
            // Create website-import folder in project
            const importDataDir = path.join(clonedPath, 'website-import')
            if (!fs.existsSync(importDataDir)) {
              fs.mkdirSync(importDataDir, { recursive: true })
            }

            // Copy manifest.json and add importType
            const manifestSrc = path.join(tempDir, 'manifest.json')
            const manifestDest = path.join(importDataDir, 'manifest.json')
            if (fs.existsSync(manifestSrc)) {
              // Read manifest, add config.importType, then save
              const manifestContent = JSON.parse(fs.readFileSync(manifestSrc, 'utf-8'))
              manifestContent.config = {
                importType: importType || 'template' // Default to 'template' if not specified
              }
              fs.writeFileSync(manifestDest, JSON.stringify(manifestContent, null, 2))
            }

            // Copy images folder
            const imagesSrc = path.join(tempDir, 'images')
            const imagesDest = path.join(importDataDir, 'images')
            if (fs.existsSync(imagesSrc)) {
              this.copyDirectory(imagesSrc, imagesDest)
            }

            // Clean up temp directory
            try {
              fs.rmSync(tempDir, { recursive: true, force: true })
            } catch (cleanupError) {
              console.warn('⚠️ [WEBSITE IMPORT] Failed to clean up temp directory:', cleanupError)
            }

          } else {
            console.warn('⚠️ [WEBSITE IMPORT] Temp directory not found:', tempDir)
          }
        }

        // Step 6b: Save screenshot if provided
        if (screenshotData) {

          // Extract extension from base64 data
          const matches = screenshotData.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/)
          const ext = matches ? matches[1] : 'png'

          // Remove data URL prefix
          const base64Data = screenshotData.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')

          // Save to project root
          const screenshotPath = path.join(clonedPath, `user-design-screenshot.${ext}`)
          fs.writeFileSync(screenshotPath, buffer)

        }

        // Step 7: Update project status to 'ready'
        databaseService.updateProjectStatus(project.id, 'ready')


        return {
          ...project,
          status: 'ready'
        }
      } catch (cloneError) {
        // If cloning fails, update status to 'error'
        databaseService.updateProjectStatus(project.id, 'error')
        throw cloneError
      }
    } catch (error) {
      console.error('❌ Project creation failed:', error)
      throw error
    }
  }

  /**
   * Get all projects
   */
  getAllProjects(): Project[] {
    return databaseService.getAllProjects()
  }

  /**
   * Get project by ID
   */
  getProjectById(id: string): Project | null {
    return databaseService.getProjectById(id)
  }

  /**
   * Delete project from database and filesystem
   * NOTE: This is a synchronous operation but may be called from async context
   */
  deleteProject(id: string): void {
    const project = databaseService.getProjectById(id)

    if (!project) {
      console.warn(`⚠️ Project ${id} not found in database, skipping deletion`)
      return
    }


    // SECURITY: Validate path to prevent deletion of files outside project directory
    const validatedPath = pathValidator.validateProjectPath(project.path, project.userId)

    // Delete from filesystem
    if (fs.existsSync(validatedPath)) {
      try {
        fs.rmSync(validatedPath, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100
        })
      } catch (error) {
        console.error('❌ Error deleting filesystem path:', error)
        throw error
      }
    } else {
    }

    // Delete from database (do this last so other services can still access project data)
    databaseService.deleteProject(id)
  }

  /**
   * Rename project (update name in database only - folder stays the same)
   *
   * NOTE: Folder name is based on project ID which is immutable.
   * This allows renaming without breaking Claude sessions, dev servers, etc.
   */
  renameProject(id: string, newName: string): Project {
    const project = databaseService.getProjectById(id)

    if (!project) {
      throw new Error('Project not found')
    }

    // Check if new project name already exists for this user (excluding current project)
    if (databaseService.projectNameExists(newName, project.userId, id)) {
      throw new Error(`A project with the name "${newName}" already exists`)
    }

    // Update database (path stays the same since it's based on immutable project ID)
    const updatedProject = databaseService.renameProject(id, newName, project.path)

    return updatedProject
  }

  /**
   * Open project folder in Finder (macOS) or Explorer (Windows)
   */
  showInFinder(id: string): void {
    const project = databaseService.getProjectById(id)

    if (!project) {
      throw new Error('Project not found')
    }

    // SECURITY: Validate path before opening in file explorer
    const validatedPath = pathValidator.validateProjectPath(project.path, project.userId)

    if (!fs.existsSync(validatedPath)) {
      throw new Error('Project folder not found')
    }

    shell.openPath(validatedPath)
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(id: string): boolean {
    return databaseService.toggleFavorite(id)
  }

  /**
   * Update last opened timestamp
   */
  updateLastOpened(id: string): void {
    databaseService.updateLastOpened(id)
  }

  /**
   * Fork an existing project - creates a complete copy with new ID and name
   * @param projectId - Source project ID to fork
   * @param userId - User ID who owns the project
   * @returns The newly created forked project
   */
  async forkProject(projectId: string, userId: string): Promise<Project> {
    // Get source project
    const sourceProject = databaseService.getProjectById(projectId)
    if (!sourceProject) {
      throw new Error('Source project not found')
    }

    // Validate source path exists
    const validatedSourcePath = pathValidator.validateProjectPath(sourceProject.path, userId)
    if (!fs.existsSync(validatedSourcePath)) {
      throw new Error('Source project folder not found')
    }

    // Generate unique fork name
    const forkName = this.generateForkName(sourceProject.name, userId)

    // Generate new project ID
    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Get new project path
    const newProjectPath = templateService.getProjectPath(newProjectId, userId)

    // Copy source directory to new path (excluding .git, node_modules, and build artifacts)
    this.copyDirectoryExcluding(validatedSourcePath, newProjectPath, [
      '.git',
      'node_modules',
      '.pnpm',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '.cache'
    ])

    // Extra safety: remove any node_modules that might have been copied (handles edge cases)
    this.removeNodeModulesRecursively(newProjectPath)

    // Also remove package-lock.json files to avoid lock file conflicts
    this.removeLockFilesRecursively(newProjectPath)

    // Initialize fresh git repository
    const { simpleGit } = await import('simple-git')
    const { bundledBinaries } = await import('./BundledBinaries')
    const git = simpleGit(newProjectPath, { binary: bundledBinaries.gitPath })
    await git.init()

    // Allocate new ports for the forked project
    const deployServices = sourceProject.deployServices ? JSON.parse(sourceProject.deployServices) : ['netlify']
    const strategy = DeploymentStrategyFactory.create(deployServices)
    const ports = await strategy.allocatePorts(newProjectId)

    // Update project configs with new ports (vite.config.ts, netlify.toml, etc.)
    strategy.updateProjectConfigs(newProjectPath, ports)

    // Create database record for forked project (basic fields only)
    const forkedProject = databaseService.createProject({
      userId: userId,
      name: forkName,
      path: newProjectPath,
      templateId: sourceProject.templateId,
      templateName: sourceProject.templateName,
      techStack: sourceProject.techStack,
      status: 'ready',
      deployServices: sourceProject.deployServices,
      envFiles: sourceProject.envFiles,
      imagePath: sourceProject.imagePath,
      websiteImportAutoPromptSent: null
    })

    // Copy widget states from source project (these aren't handled by createProject)
    if (sourceProject.kanbanState) {
      databaseService.saveKanbanState(forkedProject.id, JSON.parse(sourceProject.kanbanState))
    }
    if (sourceProject.stickyNotesState) {
      databaseService.saveStickyNotesState(forkedProject.id, JSON.parse(sourceProject.stickyNotesState))
    }
    if (sourceProject.analyticsWidgetState) {
      databaseService.saveAnalyticsWidgetState(forkedProject.id, JSON.parse(sourceProject.analyticsWidgetState))
    }
    if (sourceProject.projectAssetsWidgetState) {
      databaseService.saveProjectAssetsWidgetState(forkedProject.id, JSON.parse(sourceProject.projectAssetsWidgetState))
    }
    if (sourceProject.whiteboardWidgetState) {
      databaseService.saveWhiteboardWidgetState(forkedProject.id, JSON.parse(sourceProject.whiteboardWidgetState))
    }
    if (sourceProject.iconsWidgetState) {
      databaseService.saveIconsWidgetState(forkedProject.id, JSON.parse(sourceProject.iconsWidgetState))
    }

    // Copy env vars if source has them
    if (sourceProject.envVars) {
      const envVars = JSON.parse(sourceProject.envVars)
      databaseService.saveEnvConfig(forkedProject.id, envVars)
    }

    // Mark dependencies as NOT installed (since we excluded node_modules)
    // User will need to install them when opening the project

    // Create initial git commit
    await git.add('.')
    await git.commit('Initial commit (forked project)')

    return {
      ...forkedProject,
      envVars: sourceProject.envVars,
      dependenciesInstalled: false
    }
  }

  /**
   * Generate a unique fork name
   * Tries "Fork of X", then "Fork 2 of X", "Fork 3 of X", etc.
   */
  private generateForkName(originalName: string, userId: string): string {
    // Try "Fork of X" first
    let forkName = `Fork of ${originalName}`
    if (!databaseService.projectNameExists(forkName, userId)) {
      return forkName
    }

    // Try "Fork N of X" starting from 2
    let counter = 2
    while (true) {
      forkName = `Fork ${counter} of ${originalName}`
      if (!databaseService.projectNameExists(forkName, userId)) {
        return forkName
      }
      counter++
      // Safety limit
      if (counter > 100) {
        throw new Error('Too many forks of this project')
      }
    }
  }

  /**
   * Recursively find and remove all node_modules directories
   * @private
   */
  private removeNodeModulesRecursively(dir: string): void {
    if (!fs.existsSync(dir)) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.name === 'node_modules') {
        // Remove the entire node_modules directory
        console.log(`🗑️ Removing node_modules at: ${fullPath}`)
        try {
          fs.rmSync(fullPath, { recursive: true, force: true })
          console.log(`✓ Removed ${fullPath}`)
        } catch (err) {
          console.warn(`⚠️ Failed to remove ${fullPath}:`, err)
        }
      } else if (entry.isDirectory()) {
        // Recursively check subdirectories
        this.removeNodeModulesRecursively(fullPath)
      }
    }
  }

  /**
   * Remove lock files to ensure fresh npm install
   * @private
   */
  private removeLockFilesRecursively(dir: string): void {
    if (!fs.existsSync(dir)) return

    const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (lockFiles.includes(entry.name)) {
        try {
          fs.unlinkSync(fullPath)
          console.log(`🗑️ Removed lock file: ${fullPath}`)
        } catch (err) {
          console.warn(`⚠️ Failed to remove lock file ${fullPath}:`, err)
        }
      } else if (entry.isDirectory() && entry.name !== 'node_modules') {
        this.removeLockFilesRecursively(fullPath)
      }
    }
  }

  /**
   * Recursively copy a directory, excluding specified folders
   * @private
   */
  private copyDirectoryExcluding(src: string, dest: string, excludeFolders: string[]): void {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      // Skip excluded folders (check name first, regardless of type)
      if (excludeFolders.includes(entry.name)) {
        continue
      }

      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      // Use fs.statSync to properly resolve symlinks and check if it's a directory
      let isDir = false
      try {
        const stat = fs.statSync(srcPath)
        isDir = stat.isDirectory()
      } catch {
        // If we can't stat (broken symlink, etc.), skip
        continue
      }

      if (isDir) {
        // Recursively copy subdirectory
        this.copyDirectoryExcluding(srcPath, destPath, excludeFolders)
      } else {
        // Copy file (skip symlinks to avoid issues)
        if (!entry.isSymbolicLink()) {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }
  }

  /**
   * Recursively copy a directory
   * @private
   */
  private copyDirectory(src: string, dest: string): void {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        this.copyDirectory(srcPath, destPath)
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

export const projectService = new ProjectService()
