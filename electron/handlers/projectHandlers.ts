import { ipcMain, WebContents } from 'electron'
import { projectService } from '../services/ProjectService'
import { backendService } from '../services/BackendService'
import { databaseService } from '../services/DatabaseService'
import { envService } from '../services/EnvService'
import { dependencyService } from '../services/DependencyService'
import { getCurrentUserId, getCurrentUserEmail } from '../main'
import { requireAuth, validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware'
import { claudeService } from '../services/ClaudeService'
import fs from 'fs'
import path from 'path'
import sizeOf from 'image-size'

export function registerProjectHandlers() {
  // Create new project from template
  ipcMain.handle('project:create', async (_event, templateId: string, projectName: string, tempImportProjectId?: string, screenshotData?: string, importType?: 'template' | 'screenshot' | 'ai') => {
    try {
      // SECURITY: Ensure user is authenticated
      const userId = requireAuth()
      const userEmail = getCurrentUserEmail()

      if (!userEmail) {
        return {
          success: false,
          error: 'User email not found. Please log in again.'
        }
      }

      if (tempImportProjectId) {
      }
      if (screenshotData) {
      }
      if (importType) {
      }

      // Fetch template details from backend
      const template = await backendService.getTemplateById(templateId)

      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      // Create the project with userId and userEmail (and optional tempImportProjectId/screenshot/importType for import)
      const project = await projectService.createProject(userId, templateId, projectName, template, userEmail, tempImportProjectId, screenshotData, importType)

      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error creating project:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project'
      }
    }
  })

  // Get all projects
  ipcMain.handle('project:get-all', async () => {
    try {

      // Check if user is logged in
      const userId = getCurrentUserId()
      if (!userId) {
        return {
          success: true,
          projects: []
        }
      }

      const projects = projectService.getAllProjects()

      return {
        success: true,
        projects
      }
    } catch (error) {
      console.error('❌ Error fetching projects:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch projects'
      }
    }
  })

  // Get project by ID
  ipcMain.handle('project:get-by-id', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)


      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error fetching project:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch project'
      }
    }
  })

  // Delete project
  ipcMain.handle('project:delete', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)


      // IMPORTANT: Clean up sessions BEFORE deleting project
      // This prevents errors when cleanup operations try to validate project ownership
      try {
        // Stop any running processes (force=true to bypass active project check)
        const processManager = (await import('../services/ProcessManager')).processManager
        const status = processManager.getProcessStatus(projectId)
        if (status === 'running') {
          await processManager.stopDevServer(projectId, true)
        }

        // Destroy Claude session (if any)
        const claudeService = (await import('../services/ClaudeService')).claudeService
        claudeService.destroySession(projectId)

        // Destroy terminal session (if any)
        const terminalService = (await import('../services/TerminalService')).terminalService
        const terminalAggregator = (await import('../services/TerminalAggregator')).terminalAggregator
        terminalService.destroySession(projectId)
        terminalAggregator.deleteBuffer(projectId)
      } catch (cleanupError) {
        // Log but don't fail deletion if cleanup fails
        console.warn('⚠️ Error during cleanup (continuing with deletion):', cleanupError)
      }

      // Now delete the project
      projectService.deleteProject(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error deleting project:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      }
    }
  })

  // Toggle project favorite
  ipcMain.handle('project:toggle-favorite', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const isFavorite = projectService.toggleFavorite(projectId)

      return {
        success: true,
        isFavorite
      }
    } catch (error) {
      console.error('❌ Error toggling favorite:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle favorite'
      }
    }
  })

  // Update last opened timestamp
  ipcMain.handle('project:update-last-opened', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      projectService.updateLastOpened(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error updating last opened:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update last opened'
      }
    }
  })

  // Rename project
  ipcMain.handle('project:rename', async (_event, projectId: string, newName: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      // RACE CONDITION FIX: Check if Claude is actively working on this project
      const claudeStatus = claudeService.getStatus(projectId)
      if (claudeStatus === 'starting' || claudeStatus === 'running') {
        console.warn(`⚠️ Cannot rename project ${projectId} - Claude is ${claudeStatus}`)
        return {
          success: false,
          error: 'Cannot rename project while Claude is working. Please wait for Claude to complete or stop the session first.',
          reason: 'claude_active',
          claudeStatus
        }
      }


      // NOTE: No need to stop services! Folder path is based on immutable project ID,
      // so renaming only updates the display name in the database. All services keep working.
      const project = projectService.renameProject(projectId, newName)

      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error renaming project:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename project'
      }
    }
  })

  // Show project in Finder/Explorer
  ipcMain.handle('project:show-in-finder', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      projectService.showInFinder(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error showing in Finder:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open in Finder'
      }
    }
  })

  // Save environment configuration
  ipcMain.handle('project:save-env-config', async (_event, projectId: string, envVars: Record<string, string>) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)


      // Save to database
      databaseService.saveEnvConfig(projectId, envVars)

      // Write .env file to project directory
      envService.writeEnvFile(project.path, envVars)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving env config:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save environment configuration'
      }
    }
  })

  // Get environment configuration
  ipcMain.handle('project:get-env-config', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const envVars = databaseService.getEnvConfig(projectId)

      return {
        success: true,
        envVars
      }
    } catch (error) {
      console.error('❌ Error getting env config:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get environment configuration'
      }
    }
  })

  // Install dependencies
  ipcMain.handle('project:install-dependencies', async (event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)


      // Install dependencies with progress streaming
      const result = await dependencyService.installFullstackDependencies(
        project.path,
        (data: string) => {
          // Stream output to renderer
          event.sender.send('dependency-install-progress', data)
        },
        projectId // Pass projectId for terminal output
      )

      if (result.success) {
        // Mark as installed in database
        databaseService.markDependenciesInstalled(projectId)
      }

      return result
    } catch (error) {
      console.error('❌ Error installing dependencies:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install dependencies'
      }
    }
  })

  // Read project env files
  ipcMain.handle('project:read-env-files', async (_event, projectId: string) => {
    try {
      console.log('🔍 Reading env files for project:', projectId)

      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)
      console.log('🔍 Project validated:', { id: project.id, path: project.path, envFiles: project.envFiles })

      // Get envFiles configuration from project
      const envFilesConfig = project.envFiles ? JSON.parse(project.envFiles) : []
      console.log('🔍 EnvFiles config:', envFilesConfig)

      if (envFilesConfig.length === 0) {
        console.log('⚠️ No envFiles configured for this project')
        return {
          success: true,
          envFiles: []
        }
      }

      // Read all env files
      const envFiles = envService.readProjectEnvFiles(project.path, envFilesConfig)
      console.log('🔍 Env files read from disk:', envFiles)

      return {
        success: true,
        envFiles
      }
    } catch (error) {
      console.error('❌ Error reading env files:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read env files'
      }
    }
  })

  // Write project env file
  ipcMain.handle('project:write-env-file', async (_event, projectId: string, filePath: string, variables: Record<string, string>) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)

      // Write env file
      envService.writeProjectEnvFile(project.path, filePath, variables)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error writing env file:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write env file'
      }
    }
  })

  // Save Kanban widget state
  ipcMain.handle('project:save-kanban-state', async (_event, projectId: string, kanbanState: { enabled: boolean; position: { x: number; y: number }; size: { width: number; height: number } }) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveKanbanState(projectId, kanbanState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Kanban state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Kanban state'
      }
    }
  })

  // Get Kanban widget state
  ipcMain.handle('project:get-kanban-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const kanbanState = databaseService.getKanbanState(projectId)

      return {
        success: true,
        kanbanState
      }
    } catch (error) {
      console.error('❌ Error getting Kanban state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Kanban state'
      }
    }
  })

  // Save sticky notes state
  ipcMain.handle('project:save-sticky-notes-state', async (_event, projectId: string, stickyNotesState: { notes: Array<{ id: string; position: { x: number; y: number }; content: string; color: string; stickyText: boolean; zIndex: number }> }) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveStickyNotesState(projectId, stickyNotesState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving sticky notes state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save sticky notes state'
      }
    }
  })

  // Get sticky notes state
  ipcMain.handle('project:get-sticky-notes-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const stickyNotesState = databaseService.getStickyNotesState(projectId)

      return {
        success: true,
        stickyNotesState
      }
    } catch (error) {
      console.error('❌ Error getting sticky notes state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sticky notes state'
      }
    }
  })

  // Save Analytics widget state
  ipcMain.handle('project:save-analytics-widget-state', async (_event, projectId: string, widgetState: { enabled: boolean; position: { x: number; y: number }; size: { width: number; height: number } }) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveAnalyticsWidgetState(projectId, widgetState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Analytics widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Analytics widget state'
      }
    }
  })

  // Get Analytics widget state
  ipcMain.handle('project:get-analytics-widget-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const widgetState = databaseService.getAnalyticsWidgetState(projectId)

      return {
        success: true,
        widgetState
      }
    } catch (error) {
      console.error('❌ Error getting Analytics widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Analytics widget state'
      }
    }
  })

  // Save Project Assets widget state
  ipcMain.handle('project:save-project-assets-widget-state', async (_event, projectId: string, widgetState: any) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveProjectAssetsWidgetState(projectId, widgetState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Project Assets widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Project Assets widget state'
      }
    }
  })

  // Get Project Assets widget state
  ipcMain.handle('project:get-project-assets-widget-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const widgetState = databaseService.getProjectAssetsWidgetState(projectId)

      return {
        success: true,
        widgetState
      }
    } catch (error) {
      console.error('❌ Error getting Project Assets widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Project Assets widget state'
      }
    }
  })

  // Save Whiteboard widget state
  ipcMain.handle('project:save-whiteboard-widget-state', async (_event, projectId: string, widgetState: { enabled: boolean; position: { x: number; y: number }; size: { width: number; height: number } }) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveWhiteboardWidgetState(projectId, widgetState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Whiteboard widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Whiteboard widget state'
      }
    }
  })

  // Get Whiteboard widget state
  ipcMain.handle('project:get-whiteboard-widget-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const widgetState = databaseService.getWhiteboardWidgetState(projectId)

      return {
        success: true,
        widgetState
      }
    } catch (error) {
      console.error('❌ Error getting Whiteboard widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Whiteboard widget state'
      }
    }
  })

  // Save Icons widget state
  ipcMain.handle('project:save-icons-widget-state', async (_event, projectId: string, widgetState: { enabled: boolean; position: { x: number; y: number }; size: { width: number; height: number }; zIndex: number }) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      databaseService.saveIconsWidgetState(projectId, widgetState)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Icons widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Icons widget state'
      }
    }
  })

  // Get Icons widget state
  ipcMain.handle('project:get-icons-widget-state', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const widgetState = databaseService.getIconsWidgetState(projectId)

      return {
        success: true,
        widgetState
      }
    } catch (error) {
      console.error('❌ Error getting Icons widget state:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Icons widget state'
      }
    }
  })

  // Save Whiteboard drawing data (Excalidraw elements/files)
  ipcMain.handle('project:save-whiteboard-data', async (_event, projectId: string, data: any) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)

      // Save whiteboard data as JSON file in project folder
      const whiteboardPath = path.join(project.path, 'whiteboard.json')
      fs.writeFileSync(whiteboardPath, JSON.stringify(data, null, 2))

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving Whiteboard data:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save Whiteboard data'
      }
    }
  })

  // Get Whiteboard drawing data (Excalidraw elements/files)
  ipcMain.handle('project:get-whiteboard-data', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId)

      const whiteboardPath = path.join(project.path, 'whiteboard.json')

      if (!fs.existsSync(whiteboardPath)) {
        return {
          success: true,
          data: null
        }
      }

      const data = JSON.parse(fs.readFileSync(whiteboardPath, 'utf-8'))

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('❌ Error getting Whiteboard data:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get Whiteboard data'
      }
    }
  })

  // Get project assets folder structure
  ipcMain.handle('project:get-assets-structure', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const project = databaseService.getProjectById(projectId)

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      // Get imagePath and extract assets folder (go one level up from images)
      if (!project.imagePath) {
        return {
          success: true,
          assets: [] // No assets path configured
        }
      }

      // imagePath is like "frontend/public/assets/images"
      // We want "frontend/public/assets"
      const assetsPath = path.join(project.path, path.dirname(project.imagePath))

      // Check if assets folder exists
      if (!fs.existsSync(assetsPath)) {
        return {
          success: true,
          assets: [] // Assets folder doesn't exist
        }
      }

      // Recursively read folder structure
      const readFolderStructure = (folderPath: string): any[] => {
        try {
          const items = fs.readdirSync(folderPath, { withFileTypes: true })
          const result: any[] = []

          for (const item of items) {
            // Skip hidden files, node_modules, and manifest.json
            if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'manifest.json') {
              continue
            }

            const itemPath = path.join(folderPath, item.name)
            const relativePath = path.relative(project.path, itemPath)

            if (item.isDirectory()) {
              // It's a folder
              const children = readFolderStructure(itemPath)
              result.push({
                name: item.name,
                type: 'folder',
                children,
                path: itemPath, // Full absolute path for folder operations
                relativePath // Relative path from project root
              })
            } else {
              // It's a file
              const stats = fs.statSync(itemPath)
              const ext = path.extname(item.name).toLowerCase()

              // Determine file type
              let fileType = 'other'
              if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
                fileType = 'image'
              } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
                fileType = 'audio'
              } else if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
                fileType = 'font'
              }

              // Format file size
              const formatSize = (bytes: number): string => {
                if (bytes < 1024) return `${bytes} B`
                if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
                return `${Math.round(bytes / (1024 * 1024))} MB`
              }

              // Get image dimensions if it's an image
              let dimensions: string | undefined
              if (fileType === 'image') {
                try {
                  // Read file as buffer for image-size
                  const buffer = fs.readFileSync(itemPath)
                  const size = sizeOf(buffer)
                  if (size.width && size.height) {
                    dimensions = `${size.width}x${size.height}`
                  }
                } catch (error) {
                  // Silently ignore errors reading dimensions
                  console.log(`⚠️ Could not read dimensions for ${item.name}`)
                }
              }

              result.push({
                name: item.name,
                type: 'file',
                fileType,
                size: formatSize(stats.size),
                dimensions,
                path: itemPath, // Full absolute path for file operations
                relativePath // Relative path from project root
              })
            }
          }

          return result
        } catch (error) {
          console.error('Error reading folder:', folderPath, error)
          return []
        }
      }

      const assets = readFolderStructure(assetsPath)

      return {
        success: true,
        assets
      }
    } catch (error) {
      console.error('❌ Error getting assets structure:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get assets structure'
      }
    }
  })
}
