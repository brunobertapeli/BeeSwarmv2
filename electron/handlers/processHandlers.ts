import { ipcMain, WebContents } from 'electron';
import { processManager, ProcessState } from '../services/ProcessManager';
import { databaseService } from '../services/DatabaseService';
import { terminalAggregator } from '../services/TerminalAggregator';
import { claudeService } from '../services/ClaudeService';
import { logPersistenceService } from '../services/LogPersistenceService';

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

      // Initialize log persistence for this project
      logPersistenceService.initializeProject(projectId);

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

      // Reinitialize log persistence after restart
      logPersistenceService.initializeProject(projectId);

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

  // Get health status
  ipcMain.handle('process:get-health-status', async (_event, projectId: string) => {
    try {
      const healthStatus = processManager.getHealthStatus(projectId);

      return {
        success: true,
        healthStatus: healthStatus || null,
      };
    } catch (error) {
      console.error('❌ Error getting health status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get health status',
      };
    }
  });

  // Trigger manual health check
  ipcMain.handle('process:trigger-health-check', async (_event, projectId: string) => {
    try {
      const healthStatus = await processManager.triggerHealthCheck(projectId);

      return {
        success: true,
        healthStatus: healthStatus || null,
      };
    } catch (error) {
      console.error('❌ Error triggering health check:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger health check',
      };
    }
  });

  // Set current project (to prevent stopping active project)
  ipcMain.handle('process:set-current-project', async (_event, projectId: string | null) => {
    try {
      processManager.setCurrentProject(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error setting current project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set current project',
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
    // Persist ALL process output to disk (before filtering)
    logPersistenceService.handleProcessOutput(projectId, output);

    // Filter out Vite HMR noise during Claude operations
    const isClaudeRunning = claudeService.isRunning(projectId);

    if (isClaudeRunning && output.message) {
      const msg = output.message.toLowerCase();

      // Filter out Vite HMR updates during Claude work
      if (msg.includes('[vite]') &&
          (msg.includes('hmr update') ||
           msg.includes('page reload') ||
           msg.includes('hmr invalidate') ||
           msg.includes('hmr propagate') ||
           msg.includes('hmr connected'))) {
        // Skip - these are automatic updates during Claude's edits
        // User will see the final restart after Claude completes
        return;
      }

      // Filter out common build noise during Claude work
      if (msg.includes('client updated') ||
          msg.includes('page reloaded') ||
          msg.includes('rebuilding...')) {
        return;
      }
    }

    // Filter out empty/whitespace-only messages
    if (!output.message || output.message.trim().length === 0) {
      return;
    }

    // Forward to terminal aggregator
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

  // Health check status changed
  processManager.on('process-health-changed', (projectId: string, healthStatus: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-health-changed', projectId, healthStatus);
    }
  });

  // Health check critical (multiple failures)
  processManager.on('process-health-critical', (projectId: string, healthStatus: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('process-health-critical', projectId, healthStatus);
    }
  });
}
