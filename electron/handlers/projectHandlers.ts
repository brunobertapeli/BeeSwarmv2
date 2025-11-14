import { ipcMain, WebContents } from 'electron'
import { projectService } from '../services/ProjectService'
import { backendService } from '../services/BackendService'
import { databaseService } from '../services/DatabaseService'
import { envService } from '../services/EnvService'
import { dependencyService } from '../services/DependencyService'
import { getCurrentUserId, getCurrentUserEmail } from '../main'
import { requireAuth, validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware'
import { claudeService } from '../services/ClaudeService'

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
}
