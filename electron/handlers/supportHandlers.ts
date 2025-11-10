import { ipcMain } from 'electron'
import { supportService } from '../services/SupportService'

export function registerSupportHandlers() {
  /**
   * Check if human support is currently available
   */
  ipcMain.handle('support:checkAvailability', async () => {
    try {
      const available = await supportService.checkAvailability()
      return { success: true, available }
    } catch (error: any) {
      console.error('Error checking support availability:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Save message to session (real-time chat)
   */
  ipcMain.handle('support:saveMessage', async (event, data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    type: 'user' | 'support'
    content: string
  }) => {
    try {
      const message = await supportService.saveMessage(data)
      return { success: true, message }
    } catch (error: any) {
      console.error('Error saving support message:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get user's active session
   */
  ipcMain.handle('support:getSession', async (event, userId: string) => {
    try {
      const session = await supportService.getSession(userId)
      return { success: true, session }
    } catch (error: any) {
      console.error('Error getting support session:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Add to human support queue (when available)
   */
  ipcMain.handle('support:addToQueue', async (event, data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    lastMessage: string
  }) => {
    try {
      const queueEntry = await supportService.addToQueue(data)
      return { success: true, queueEntry }
    } catch (error: any) {
      console.error('Error adding to support queue:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Send offline message (when unavailable)
   */
  ipcMain.handle('support:sendOfflineMessage', async (event, data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    subject: string
    message: string
  }) => {
    try {
      const offlineMessage = await supportService.sendOfflineMessage(data)
      return { success: true, offlineMessage }
    } catch (error: any) {
      console.error('Error sending offline message:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Submit bug report
   */
  ipcMain.handle('support:submitBugReport', async (event, report: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
    title: string
    description: string
    stepsToReproduce?: string
  }) => {
    try {
      const bugReport = await supportService.submitBugReport(report)
      return { success: true, bugReport }
    } catch (error: any) {
      console.error('Error submitting bug report:', error)
      return { success: false, error: error.message }
    }
  })

}
