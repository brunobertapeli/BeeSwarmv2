import { ipcMain, WebContents } from 'electron';
import { processManager, ProcessState } from '../services/ProcessManager';
import { databaseService } from '../services/DatabaseService';
import { terminalAggregator } from '../services/TerminalAggregator';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setProcessHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register process-related IPC handlers
 */
export function registerProcessHandlers(): void {
  // Start dev server
  ipcMain.handle('process:start-dev-server', async (_event, projectId: string) => {
    try {
      console.log(`🚀 Starting dev server for project: ${projectId}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Start the server
      const port = await processManager.startDevServer(projectId, project.path);

      return {
        success: true,
        port,
      };
    } catch (error) {
      console.error('❌ Error starting dev server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start dev server',
      };
    }
  });

  // Stop dev server
  ipcMain.handle('process:stop-dev-server', async (_event, projectId: string) => {
    try {
      console.log(`🛑 Stopping dev server for project: ${projectId}`);
      await processManager.stopDevServer(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error stopping dev server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop dev server',
      };
    }
  });

  // Restart dev server
  ipcMain.handle('process:restart-dev-server', async (_event, projectId: string) => {
    try {
      console.log(`🔄 Restarting dev server for project: ${projectId}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Restart the server
      const port = await processManager.restartDevServer(projectId, project.path);

      return {
        success: true,
        port,
      };
    } catch (error) {
      console.error('❌ Error restarting dev server:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restart dev server',
      };
    }
  });

  // Get process status
  ipcMain.handle('process:get-status', async (_event, projectId: string) => {
    try {
      const status = processManager.getProcessStatus(projectId);
      const port = processManager.getPort(projectId);

      return {
        success: true,
        status,
        port,
      };
    } catch (error) {
      console.error('❌ Error getting process status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get process status',
      };
    }
  });

  // Get process output
  ipcMain.handle('process:get-output', async (_event, projectId: string, limit?: number) => {
    try {
      const output = processManager.getProcessOutput(projectId, limit);

      return {
        success: true,
        output,
      };
    } catch (error) {
      console.error('❌ Error getting process output:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get process output',
      };
    }
  });

  // Setup event listeners to forward to renderer
  setupProcessEventForwarding();
}

/**
 * Setup event forwarding from ProcessManager to renderer
 */
function setupProcessEventForwarding(): void {
  // Process status changed
  processManager.on('process-status-changed', (projectId: string, status: ProcessState) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-status-changed', projectId, status);
    }
  });

  // Process output
  processManager.on('process-output', (projectId: string, output: any) => {
    // Forward to terminal aggregator
    console.log(`📡 Forwarding dev server output to aggregator for ${projectId}`);
    terminalAggregator.addDevServerLine(projectId, output);

    // Still send to renderer for backward compatibility
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-output', projectId, output);
    }
  });

  // Process ready
  processManager.on('process-ready', (projectId: string, port: number) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-ready', projectId, port);
    }
  });

  // Process error
  processManager.on('process-error', (projectId: string, error: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-error', projectId, error);
    }
  });

  // Process crashed
  processManager.on('process-crashed', (projectId: string, details: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-crashed', projectId, details);
    }
  });
}
