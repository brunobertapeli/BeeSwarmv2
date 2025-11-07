import { ipcMain, WebContents } from 'electron';
import { terminalService } from '../services/TerminalService';
import { terminalAggregator, TerminalLine } from '../services/TerminalAggregator';
import { databaseService } from '../services/DatabaseService';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setTerminalHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register terminal-related IPC handlers
 */
export function registerTerminalHandlers(): void {
  // Create terminal session
  ipcMain.handle('terminal:create-session', async (_event, projectId: string) => {
    try {
      console.log(`📟 Creating terminal session for project: ${projectId}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Create terminal session
      terminalService.createSession(projectId, project.path);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error creating terminal session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create terminal session',
      };
    }
  });

  // Write input to terminal (user command)
  ipcMain.handle('terminal:write-input', async (_event, projectId: string, input: string) => {
    try {
      // Ensure input ends with newline for command execution
      const command = input.endsWith('\n') ? input : input + '\n';

      terminalService.writeInput(projectId, command);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error writing to terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write to terminal',
      };
    }
  });

  // Resize terminal
  ipcMain.handle('terminal:resize', async (_event, projectId: string, cols: number, rows: number) => {
    try {
      terminalService.resize(projectId, cols, rows);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error resizing terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resize terminal',
      };
    }
  });

  // Get terminal history (aggregated from all sources)
  ipcMain.handle('terminal:get-history', async (_event, projectId: string, limit?: number) => {
    try {
      const lines = terminalAggregator.getLines(projectId, limit);

      return {
        success: true,
        lines,
      };
    } catch (error) {
      console.error('❌ Error getting terminal history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get terminal history',
        lines: [],
      };
    }
  });

  // Clear terminal buffer
  ipcMain.handle('terminal:clear', async (_event, projectId: string) => {
    try {
      terminalAggregator.clearBuffer(projectId);

      // Also clear the shell session history
      terminalService.clearHistory(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error clearing terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear terminal',
      };
    }
  });

  // Destroy terminal session (when project closes)
  ipcMain.handle('terminal:destroy-session', async (_event, projectId: string) => {
    try {
      console.log(`🗑️ Destroying terminal session for project: ${projectId}`);

      terminalService.destroySession(projectId);
      terminalAggregator.deleteBuffer(projectId);

      return {
        success: true,
      };
    } catch (error) {
      // Terminal destroy should always succeed - sessions may not exist
      console.log(`ℹ️ Terminal destroy for ${projectId}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        success: true,
      };
    }
  });

  // Forward terminal events to renderer
  setupTerminalEventForwarding();
}

/**
 * Setup event forwarding from services to renderer
 */
function setupTerminalEventForwarding(): void {
  // Forward aggregated terminal lines to renderer
  terminalAggregator.on('terminal-line', ({ projectId, line }: { projectId: string; line: TerminalLine }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('terminal:line', projectId, line);
    }
  });

  // Forward terminal cleared event
  terminalAggregator.on('terminal-cleared', ({ projectId }: { projectId: string }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('terminal:cleared', projectId);
    }
  });

  // Forward terminal exit event
  terminalService.on('terminal-exit', ({ projectId, exitCode, signal }: { projectId: string; exitCode: number; signal?: number }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('terminal:exit', projectId, exitCode, signal);
    }
  });

  // Forward shell output to aggregator
  terminalService.on('terminal-output', ({ projectId, output }) => {
    terminalAggregator.addShellLine(projectId, output);
  });
}
