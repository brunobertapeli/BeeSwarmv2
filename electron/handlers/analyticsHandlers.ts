import { ipcMain } from 'electron'
import { analyticsService } from '../services/AnalyticsService'
import { requireAuth, validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware'

export function registerAnalyticsHandlers() {
  // Get all analytics data for a project
  ipcMain.handle('analytics:get-data', async (_event, projectId: string, timeRange: 'today' | 'week' | 'month') => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const data = await analyticsService.getAllAnalytics(projectId, timeRange)

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('❌ Error fetching analytics data:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics data'
      }
    }
  })

  // Get real-time active users only (for quick updates)
  ipcMain.handle('analytics:get-active-users', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId)

      const activeUsers = await analyticsService.getActiveUsers(projectId)

      return {
        success: true,
        activeUsers
      }
    } catch (error) {
      console.error('❌ Error fetching active users:', error)

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch active users'
      }
    }
  })
}
