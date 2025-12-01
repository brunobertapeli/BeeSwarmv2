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

    shell.showItemInFolder(validatedPath)
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
