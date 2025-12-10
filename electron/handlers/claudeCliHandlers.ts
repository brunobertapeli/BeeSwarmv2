/**
 * Claude CLI IPC Handlers
 *
 * Exposes Claude Code CLI operations to the renderer process.
 */

import { ipcMain, shell } from 'electron'
import { claudeCliService, type ClaudeCliStatus } from '../services/ClaudeCliService.js'

export function registerClaudeCliHandlers(): void {
  /**
   * Check Claude CLI installation and authentication status
   */
  ipcMain.handle(
    'claude-cli:check-status',
    async (): Promise<{
      success: boolean
      status?: ClaudeCliStatus
      error?: string
    }> => {
      console.log('[ClaudeCli] check-status handler called')
      try {
        const status = await claudeCliService.checkAuthentication()
        console.log('[ClaudeCli] check-status result:', status)
        return { success: true, status }
      } catch (error: any) {
        console.error('[ClaudeCli] Error checking status:', error)
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Quick check if Claude CLI is installed (no auth verification)
   */
  ipcMain.handle(
    'claude-cli:is-installed',
    async (): Promise<{
      success: boolean
      installed: boolean
    }> => {
      return {
        success: true,
        installed: claudeCliService.isInstalled()
      }
    }
  )

  /**
   * Launch Claude login flow (opens browser)
   */
  ipcMain.handle(
    'claude-cli:login',
    async (): Promise<{
      success: boolean
      error?: string
    }> => {
      try {
        const result = await claudeCliService.launchLogin()
        return result
      } catch (error: any) {
        console.error('[ClaudeCli] Error launching login:', error)
        return { success: false, error: error.message }
      }
    }
  )

  /**
   * Open Claude Code installation tutorial URL
   */
  ipcMain.handle(
    'claude-cli:open-install-url',
    async (): Promise<{
      success: boolean
    }> => {
      // Placeholder URL - update with actual tutorial when available
      await shell.openExternal('https://docs.anthropic.com/en/docs/claude-code/getting-started')
      return { success: true }
    }
  )
}
