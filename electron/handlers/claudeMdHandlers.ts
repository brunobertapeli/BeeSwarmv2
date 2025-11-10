import { ipcMain } from 'electron'
import ClaudeMdService from '../services/ClaudeMdService'
import { databaseService } from '../services/DatabaseService'

/**
 * Register IPC handlers for CLAUDE.md management
 */
export function registerClaudeMdHandlers() {
  /**
   * Get the current addendum from CLAUDE.md
   */
  ipcMain.handle('claude-md:get-addendum', async (_event, projectId: string) => {
    try {
      // Get project from database
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      const addendum = ClaudeMdService.readAddendum(project.path)

      return {
        success: true,
        addendum
      }
    } catch (error) {
      console.error('Failed to get CLAUDE.md addendum:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Save/update the addendum in CLAUDE.md
   */
  ipcMain.handle('claude-md:save-addendum', async (_event, projectId: string, addendum: string) => {
    try {
      // Get project from database
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      ClaudeMdService.writeAddendum(project.path, addendum)

      return {
        success: true
      }
    } catch (error) {
      console.error('Failed to save CLAUDE.md addendum:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Remove the addendum from CLAUDE.md
   */
  ipcMain.handle('claude-md:remove-addendum', async (_event, projectId: string) => {
    try {
      // Get project from database
      const project = databaseService.getProjectById(projectId)
      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        }
      }

      ClaudeMdService.removeAddendum(project.path)

      return {
        success: true
      }
    } catch (error) {
      console.error('Failed to remove CLAUDE.md addendum:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

}
