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
      // First, add the user's command to the terminal output (we know what they typed)
      terminalAggregator.addShellLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: input + '\n',
      });

      // Ensure input ends with newline for command execution
      const command = input.endsWith('\n') ? input : input + '\n';

      // Then execute the command
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

      terminalService.destroySession(projectId);
      terminalAggregator.deleteBuffer(projectId);

      return {
        success: true,
      };
    } catch (error) {
      // Terminal destroy should always succeed - sessions may not exist
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

  // Forward interactive terminal output to renderer
  terminalService.on('interactive-output', ({ projectId, terminalId, data }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('terminal:interactive-output', projectId, terminalId, data);
    }
  });

  // Forward interactive terminal exit
  terminalService.on('interactive-exit', ({ projectId, terminalId, exitCode, signal }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('terminal:interactive-exit', projectId, terminalId, exitCode, signal);
    }
  });
}

/**
 * Register interactive terminal IPC handlers
 */
export function registerInteractiveTerminalHandlers(): void {
  // Create interactive session
  ipcMain.handle('terminal:create-interactive-session', async (_event, projectId: string, terminalId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      terminalService.createInteractiveSession(projectId, terminalId, project.path);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error creating interactive terminal session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create interactive session',
      };
    }
  });

  // Write input to interactive session
  ipcMain.handle('terminal:write-interactive-input', async (_event, projectId: string, terminalId: string, input: string) => {
    try {
      terminalService.writeInteractiveInput(projectId, terminalId, input);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error writing to interactive terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to write to interactive terminal',
      };
    }
  });

  // Resize interactive session
  ipcMain.handle('terminal:resize-interactive', async (_event, projectId: string, terminalId: string, cols: number, rows: number) => {
    try {
      terminalService.resizeInteractive(projectId, terminalId, cols, rows);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error resizing interactive terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resize interactive terminal',
      };
    }
  });

  // Destroy interactive session
  ipcMain.handle('terminal:destroy-interactive-session', async (_event, projectId: string, terminalId: string) => {
    try {
      terminalService.destroyInteractiveSession(projectId, terminalId);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: true, // Always succeed
      };
    }
  });
}
