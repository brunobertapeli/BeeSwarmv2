import { ipcMain, WebContents } from 'electron'
import { projectService } from '../services/ProjectService'
import { mongoService } from '../services/MongoService'
import { databaseService } from '../services/DatabaseService'
import { envService } from '../services/EnvService'
import { dependencyService } from '../services/DependencyService'
import { getCurrentUserId } from '../main'

export function registerProjectHandlers() {
  // Create new project from template
  ipcMain.handle('project:create', async (_event, templateId: string, projectName: string) => {
    try {
      console.log(`🚀 Creating project: "${projectName}" from template: ${templateId}`)

      // Fetch template details from MongoDB
      const template = await mongoService.getTemplateById(templateId)

      if (!template) {
        return {
          success: false,
          error: 'Template not found'
        }
      }

      // Create the project
      const project = await projectService.createProject(templateId, projectName, template)

      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error creating project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create project'
      }
    }
  })

  // Get all projects
  ipcMain.handle('project:get-all', async () => {
    try {
      console.log('📋 Fetching all projects...')

      // Check if user is logged in
      const userId = getCurrentUserId()
      if (!userId) {
        return {
          success: true,
          projects: []
        }
      }

      const projects = projectService.getAllProjects()
      console.log('✅ Fetched', projects.length, 'projects from database')

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
      console.log(`📋 Fetching project: ${projectId}`)
      const project = projectService.getProjectById(projectId)

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error fetching project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch project'
      }
    }
  })

  // Delete project
  ipcMain.handle('project:delete', async (_event, projectId: string) => {
    try {
      console.log(`🗑️  Deleting project: ${projectId}`)
      projectService.deleteProject(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error deleting project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete project'
      }
    }
  })

  // Toggle project favorite
  ipcMain.handle('project:toggle-favorite', async (_event, projectId: string) => {
    try {
      console.log(`⭐ Toggling favorite: ${projectId}`)
      const isFavorite = projectService.toggleFavorite(projectId)

      return {
        success: true,
        isFavorite
      }
    } catch (error) {
      console.error('❌ Error toggling favorite:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle favorite'
      }
    }
  })

  // Update last opened timestamp
  ipcMain.handle('project:update-last-opened', async (_event, projectId: string) => {
    try {
      console.log(`🕐 Updating last opened: ${projectId}`)
      projectService.updateLastOpened(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error updating last opened:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update last opened'
      }
    }
  })

  // Rename project
  ipcMain.handle('project:rename', async (_event, projectId: string, newName: string) => {
    try {
      console.log(`✏️ Renaming project: ${projectId} → ${newName}`)
      const project = projectService.renameProject(projectId, newName)

      return {
        success: true,
        project
      }
    } catch (error) {
      console.error('❌ Error renaming project:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rename project'
      }
    }
  })

  // Show project in Finder/Explorer
  ipcMain.handle('project:show-in-finder', async (_event, projectId: string) => {
    try {
      console.log(`📁 Opening in Finder/Explorer: ${projectId}`)
      projectService.showInFinder(projectId)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error showing in Finder:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open in Finder'
      }
    }
  })

  // Save environment configuration
  ipcMain.handle('project:save-env-config', async (_event, projectId: string, envVars: Record<string, string>) => {
    try {
      console.log(`🔑 Saving environment configuration for: ${projectId}`)

      // Get project details
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      // Save to database
      databaseService.saveEnvConfig(projectId, envVars)

      // Write .env file to project directory
      envService.writeEnvFile(project.path, envVars)

      return {
        success: true
      }
    } catch (error) {
      console.error('❌ Error saving env config:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save environment configuration'
      }
    }
  })

  // Get environment configuration
  ipcMain.handle('project:get-env-config', async (_event, projectId: string) => {
    try {
      console.log(`🔑 Getting environment configuration for: ${projectId}`)
      const envVars = databaseService.getEnvConfig(projectId)

      return {
        success: true,
        envVars
      }
    } catch (error) {
      console.error('❌ Error getting env config:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get environment configuration'
      }
    }
  })

  // Install dependencies
  ipcMain.handle('project:install-dependencies', async (event, projectId: string) => {
    try {
      console.log(`📦 Installing dependencies for: ${projectId}`)

      // Get project details
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to install dependencies'
      }
    }
  })
}
