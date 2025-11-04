import { ipcMain, WebContents } from 'electron';
import { spawn } from 'child_process';
import { databaseService } from '../services/DatabaseService';
import { terminalAggregator } from '../services/TerminalAggregator';
import { chatHistoryManager } from '../services/ChatHistoryManager';
import { processManager } from '../services/ProcessManager';
import { emitChatEvent } from './chatHandlers';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setGitHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register Git IPC handlers
 */
export function registerGitHandlers(): void {
  // Restore to checkpoint (commit hash)
  ipcMain.handle('git:restore-checkpoint', async (_event, projectId: string, commitHash: string) => {
    try {
      console.log(`🔄 Restoring ${projectId} to checkpoint ${commitHash}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      const projectPath = project.path;
      const restoreStartTime = Date.now();

      // Validate commit hash
      if (!commitHash || commitHash === 'unknown' || commitHash.length < 7) {
        console.error(`❌ Invalid commit hash: ${commitHash}`);
        return {
          success: false,
          error: 'Invalid commit hash',
        };
      }

      // Create a new chat block for this restore operation
      const restoreBlock = databaseService.createChatBlock(
        projectId,
        `Restore to checkpoint #${commitHash}`
      );
      chatHistoryManager.startBlock(projectId, restoreBlock.id);

      // Emit block created event to UI immediately
      emitChatEvent('chat:block-created', projectId, restoreBlock);

      // Add restore action (in progress)
      chatHistoryManager.addAction(projectId, {
        type: 'checkpoint_restore',
        status: 'in_progress',
        data: {
          commitHash,
        },
      });

      // Add terminal output
      terminalAggregator.addSystemLine(projectId, '\n');
      terminalAggregator.addSystemLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      terminalAggregator.addSystemLine(projectId, '🔄 CHECKPOINT RESTORE\n');
      terminalAggregator.addSystemLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      terminalAggregator.addSystemLine(projectId, `📍 Target: #${commitHash} | ⏳ Restoring...\n`);

      // Verify commit exists in this repository first
      const commitExists = await verifyCommitExists(projectPath, commitHash);
      if (!commitExists) {
        console.error(`❌ Commit ${commitHash} not found in project ${projectId}`);

        chatHistoryManager.updateLastAction(projectId, {
          status: 'error',
          message: `Commit ${commitHash} not found in this repository`,
        });

        terminalAggregator.addSystemLine(projectId, `❌ Commit ${commitHash} does not exist in this repository\n`, 'stderr');
        terminalAggregator.addSystemLine(projectId, '\n');

        // Complete the block with error in database
        databaseService.completeChatBlock(restoreBlock.id);

        // Emit block completed event
        const errorBlock = databaseService.getChatBlock(restoreBlock.id);
        if (errorBlock) {
          emitChatEvent('chat:block-completed', projectId, errorBlock);
        }

        return {
          success: false,
          error: `Commit ${commitHash} does not exist in this repository`,
        };
      }

      // Perform git checkout
      const checkoutResult = await performGitCheckout(projectId, projectPath, commitHash);

      if (!checkoutResult.success) {
        // Update action to error
        chatHistoryManager.updateLastAction(projectId, {
          status: 'error',
          message: checkoutResult.error || 'Failed to restore checkpoint',
        });

        terminalAggregator.addSystemLine(projectId, `❌ ${checkoutResult.error}\n`, 'stderr');
        terminalAggregator.addSystemLine(projectId, '\n');

        // Complete the block with error in database
        databaseService.completeChatBlock(restoreBlock.id);

        // Emit block completed event
        const errorBlock = databaseService.getChatBlock(restoreBlock.id);
        if (errorBlock) {
          emitChatEvent('chat:block-completed', projectId, errorBlock);
        }

        return {
          success: false,
          error: checkoutResult.error,
        };
      }

      const restoreElapsed = ((Date.now() - restoreStartTime) / 1000).toFixed(1);

      terminalAggregator.addSystemLine(projectId, `✅ Restored to #${commitHash} | ⏱️  ${restoreElapsed}s\n`);
      terminalAggregator.addSystemLine(projectId, '\n');

      // Update action to success
      chatHistoryManager.updateLastAction(projectId, {
        status: 'success',
        data: {
          commitHash,
          restoreTime: parseFloat(restoreElapsed),
        },
      });

      // Restart dev server if running
      await restartDevServer(projectId, projectPath);

      // Complete the block in database
      databaseService.completeChatBlock(restoreBlock.id);

      // Emit block completed event
      const completedBlock = databaseService.getChatBlock(restoreBlock.id);
      if (completedBlock) {
        emitChatEvent('chat:block-completed', projectId, completedBlock);
      }

      console.log(`✅ Checkpoint restored for ${projectId}`);

      return {
        success: true,
        commitHash,
      };
    } catch (error) {
      console.error(`❌ Error restoring checkpoint for ${projectId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });
}

/**
 * Verify that a commit exists in the repository
 */
async function verifyCommitExists(
  projectPath: string,
  commitHash: string
): Promise<boolean> {
  return new Promise((resolve) => {
    // Use git cat-file to check if commit exists
    const verifyProcess = spawn('git', ['cat-file', '-e', `${commitHash}^{commit}`], {
      cwd: projectPath,
    });

    verifyProcess.on('close', (code) => {
      // Exit code 0 means commit exists, non-zero means it doesn't
      resolve(code === 0);
    });
  });
}

/**
 * Perform git checkout to a specific commit
 */
async function performGitCheckout(
  projectId: string,
  projectPath: string,
  commitHash: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const checkoutProcess = spawn('git', ['checkout', commitHash], {
      cwd: projectPath,
    });

    let errorOutput = '';
    checkoutProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    checkoutProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Git checkout failed for ${projectId}:`, errorOutput);
        resolve({
          success: false,
          error: 'Failed to checkout commit',
        });
        return;
      }

      resolve({ success: true });
    });
  });
}

/**
 * Restart dev server after restore
 */
async function restartDevServer(projectId: string, projectPath: string): Promise<void> {
  const processState = processManager.getProcessStatus(projectId);
  if (processState === 'running') {
    const devServerStartTime = Date.now();

    console.log(`🔄 Restarting dev server for ${projectId}`);

    // Add dev server action (in progress)
    chatHistoryManager.addAction(projectId, {
      type: 'dev_server',
      status: 'in_progress',
    });

    // Dev server restart block
    terminalAggregator.addDevServerLine(projectId, {
      timestamp: new Date(),
      type: 'stdout',
      message: '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      raw: '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    });
    terminalAggregator.addDevServerLine(projectId, {
      timestamp: new Date(),
      type: 'stdout',
      message: '🔄 DEV SERVER RESTART\n',
      raw: '🔄 DEV SERVER RESTART\n',
    });
    terminalAggregator.addDevServerLine(projectId, {
      timestamp: new Date(),
      type: 'stdout',
      message: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      raw: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
    });
    terminalAggregator.addDevServerLine(projectId, {
      timestamp: new Date(),
      type: 'stdout',
      message: '⏳ Stopping...\n',
      raw: '⏳ Stopping...\n',
    });

    try {
      await processManager.stopDevServer(projectId);

      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '✅ Stopped | ⏳ Starting...\n',
        raw: '✅ Stopped | ⏳ Starting...\n',
      });

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s

      const port = await processManager.startDevServer(projectId, projectPath);

      const devServerElapsed = ((Date.now() - devServerStartTime) / 1000).toFixed(1);

      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: `✅ Restarted on port ${port} | ⏱️  ${devServerElapsed}s\n`,
        raw: `✅ Restarted on port ${port} | ⏱️  ${devServerElapsed}s\n`,
      });
      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '\n',
        raw: '\n',
      });

      // Update action to success
      chatHistoryManager.updateLastAction(projectId, {
        status: 'success',
        data: {
          url: `http://localhost:${port}`,
          restartTime: parseFloat(devServerElapsed),
        },
      });
    } catch (error) {
      console.error(`❌ Dev server restart failed for ${projectId}:`, error);
      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stderr',
        message: '❌ Failed to restart dev server\n',
        raw: '❌ Failed to restart dev server\n',
      });

      // Update action to error
      chatHistoryManager.updateLastAction(projectId, {
        status: 'error',
        message: 'Failed to restart dev server',
      });
    }
  } else {
    console.log(`ℹ️ Dev server not running for ${projectId}, skipping restart`);
  }
}
