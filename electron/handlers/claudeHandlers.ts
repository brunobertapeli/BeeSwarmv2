import { ipcMain, WebContents } from 'electron';
import { claudeService, ClaudeStatus, ClaudeEvent } from '../services/ClaudeService';
import { terminalAggregator } from '../services/TerminalAggregator';
import { databaseService } from '../services/DatabaseService';
import { processManager } from '../services/ProcessManager';
import { spawn } from 'child_process';
import * as path from 'path';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setClaudeHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register Claude Code IPC handlers
 */
export function registerClaudeHandlers(): void {
  // Start Claude Code session
  ipcMain.handle('claude:start-session', async (_event, projectId: string, prompt?: string) => {
    try {
      console.log(`🤖 Starting Claude session for project: ${projectId}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Only start if we have a prompt - prevents auto-start on project load
      if (!prompt) {
        console.log('⏭️ Skipping Claude start - no prompt provided (lazy init)');
        return {
          success: true,
        };
      }

      // Start Claude session
      await claudeService.startSession(projectId, project.path, prompt);

      // Add system message to terminal
      terminalAggregator.addSystemLine(
        projectId,
        '🤖 Claude Code session started\n'
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error starting Claude session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start Claude session',
      };
    }
  });

  // Send prompt to Claude
  ipcMain.handle('claude:send-prompt', async (_event, projectId: string, prompt: string) => {
    try {
      console.log(`📤 Sending prompt to Claude for project: ${projectId}`);

      // Get project details
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return {
          success: false,
          error: 'Project not found',
        };
      }

      // Add user message to terminal
      terminalAggregator.addClaudeLine(
        projectId,
        `\n💬 User: ${prompt}\n\n`
      );

      // Send prompt using session resume pattern
      await claudeService.sendPrompt(projectId, project.path, prompt);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error sending prompt to Claude:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send prompt',
      };
    }
  });

  // Get Claude session status
  ipcMain.handle('claude:get-status', async (_event, projectId: string) => {
    try {
      const status = claudeService.getStatus(projectId);
      const sessionId = claudeService.getSessionId(projectId);

      return {
        success: true,
        status,
        sessionId,
      };
    } catch (error) {
      console.error('❌ Error getting Claude status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
        status: 'idle' as ClaudeStatus,
        sessionId: null,
      };
    }
  });

  // Clear Claude session (start fresh, no --resume)
  ipcMain.handle('claude:clear-session', async (_event, projectId: string) => {
    try {
      console.log(`🗑️ Clearing Claude session for project: ${projectId}`);

      claudeService.clearSession(projectId);

      // Add system message to terminal
      terminalAggregator.addSystemLine(
        projectId,
        '🗑️ Claude session cleared - next session will start fresh\n'
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error clearing Claude session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear session',
      };
    }
  });

  // Destroy Claude session
  ipcMain.handle('claude:destroy-session', async (_event, projectId: string) => {
    try {
      console.log(`🗑️ Destroying Claude session for project: ${projectId}`);

      claudeService.destroySession(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error destroying Claude session:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to destroy session',
      };
    }
  });

  // Forward Claude events to renderer
  setupClaudeEventForwarding();
}

/**
 * Setup event forwarding from ClaudeService to renderer
 */
function setupClaudeEventForwarding(): void {
  // Forward Claude events (filtered for terminal display)
  claudeService.on('claude-event', ({ projectId, event }: { projectId: string; event: ClaudeEvent }) => {
    // Only show meaningful messages in terminal (filter out verbose streaming)
    if (!event.type || event.type === 'partial') {
      // Skip partial/streaming messages to avoid terminal flooding
      return;
    }

    // Format message based on type
    let terminalOutput = '';

    if (event.type === 'assistant' && event.message?.message?.content) {
      // Extract text from assistant messages
      const content = event.message.message.content;
      if (Array.isArray(content)) {
        const textParts = content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
        if (textParts) {
          terminalOutput = `💬 ${textParts}\n\n`;
        }
      }
    } else if (event.type === 'result') {
      // Result message
      terminalOutput = '🎯 Task completed\n';
    } else if (event.type === 'system') {
      // System messages
      if (event.message?.message?.content) {
        const content = event.message.message.content;
        if (Array.isArray(content)) {
          const textParts = content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
          if (textParts) {
            terminalOutput = `⚙️ ${textParts}\n`;
          }
        }
      }
    }

    // Add to terminal if we have output
    if (terminalOutput) {
      terminalAggregator.addClaudeLine(projectId, terminalOutput);
    }
  });

  // Forward status changes to renderer
  claudeService.on('claude-status', ({ projectId, status }: { projectId: string; status: ClaudeStatus }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      console.log(`📡 Forwarding Claude status to renderer: ${projectId} -> ${status}`);
      mainWindowContents.send('claude:status-changed', projectId, status);
    }
  });

  // Handle Claude completion
  claudeService.on('claude-complete', async ({ projectId }: { projectId: string }) => {
    console.log(`✅ Claude completed for project: ${projectId}`);

    // Add completion message to terminal
    terminalAggregator.addClaudeLine(projectId, '\n✅ Claude Code completed successfully\n\n');

    // Get project details
    const project = databaseService.getProjectById(projectId);
    if (!project) {
      console.error(`❌ Project not found: ${projectId}`);
      return;
    }

    // Post-completion workflow
    await handleClaudeCompletion(projectId, project.path);

    // Notify renderer
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:completed', projectId);
    }
  });

  // Handle Claude errors
  claudeService.on('claude-error', ({ projectId, error }: { projectId: string; error: string }) => {
    console.error(`❌ Claude error for project: ${projectId}`, error);

    // Add error message to terminal
    terminalAggregator.addClaudeLine(
      projectId,
      `\n❌ Claude Code error: ${error}\n\n`,
      'stderr'
    );

    // Notify renderer
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:error', projectId, error);
    }
  });

  // Handle Claude exit
  claudeService.on('claude-exit', ({ projectId, exitCode }: { projectId: string; exitCode: number }) => {
    console.log(`🤖 Claude exited for ${projectId} with code ${exitCode}`);

    // Notify renderer
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:exited', projectId, exitCode);
    }
  });
}

/**
 * Handle post-completion workflow
 * - Git commit
 * - Context update (placeholder)
 * - Dev server restart
 */
async function handleClaudeCompletion(projectId: string, projectPath: string): Promise<void> {
  try {
    console.log(`🔄 Starting post-completion workflow for ${projectId}`);

    // 1. Git commit
    await gitCommitChanges(projectId, projectPath);

    // 2. Context update (placeholder for future implementation)
    console.log(`📋 TODO: Update context for ${projectId} (placeholder)`);
    terminalAggregator.addSystemLine(
      projectId,
      '📋 Context update - TODO (placeholder)\n'
    );

    // 3. Restart dev server (if running)
    const processState = processManager.getProcessStatus(projectId);
    if (processState === 'running') {
      console.log(`🔄 Restarting dev server for ${projectId}`);
      terminalAggregator.addSystemLine(
        projectId,
        '🔄 Restarting dev server...\n'
      );

      await processManager.stopDevServer(projectId);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
      await processManager.startDevServer(projectId, projectPath);

      terminalAggregator.addSystemLine(
        projectId,
        '✅ Dev server restarted\n'
      );
    } else {
      console.log(`ℹ️ Dev server not running for ${projectId}, skipping restart`);
    }

    console.log(`✅ Post-completion workflow finished for ${projectId}`);
  } catch (error) {
    console.error(`❌ Error in post-completion workflow for ${projectId}:`, error);
    terminalAggregator.addSystemLine(
      projectId,
      `❌ Post-completion workflow error: ${error instanceof Error ? error.message : 'Unknown error'}\n`,
    );
  }
}

/**
 * Git commit changes after Claude completion
 */
async function gitCommitChanges(projectId: string, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📦 Committing changes for ${projectId}`);

    // Check if there are any changes to commit
    const statusProcess = spawn('git', ['status', '--porcelain'], {
      cwd: projectPath,
    });

    let statusOutput = '';
    statusProcess.stdout.on('data', (data) => {
      statusOutput += data.toString();
    });

    statusProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Git status failed for ${projectId}`);
        reject(new Error('Git status failed'));
        return;
      }

      // No changes to commit
      if (statusOutput.trim().length === 0) {
        console.log(`ℹ️ No changes to commit for ${projectId}`);
        terminalAggregator.addGitLine(projectId, 'ℹ️ No changes to commit\n');
        resolve();
        return;
      }

      // Add all changes
      terminalAggregator.addGitLine(projectId, '📦 Adding changes to git...\n');

      const addProcess = spawn('git', ['add', '.'], {
        cwd: projectPath,
      });

      addProcess.on('close', (addCode) => {
        if (addCode !== 0) {
          console.error(`❌ Git add failed for ${projectId}`);
          terminalAggregator.addGitLine(projectId, '❌ Git add failed\n', 'stderr');
          reject(new Error('Git add failed'));
          return;
        }

        // Commit with Claude-generated message
        const commitMessage = 'feat: updates via Claude Code\n\n🤖 Generated with Claude Code';
        const commitProcess = spawn('git', ['commit', '-m', commitMessage], {
          cwd: projectPath,
        });

        let commitOutput = '';
        commitProcess.stdout.on('data', (data) => {
          const output = data.toString();
          commitOutput += output;
          terminalAggregator.addGitLine(projectId, output);
        });

        commitProcess.stderr.on('data', (data) => {
          terminalAggregator.addGitLine(projectId, data.toString(), 'stderr');
        });

        commitProcess.on('close', (commitCode) => {
          if (commitCode !== 0) {
            console.error(`❌ Git commit failed for ${projectId}`);
            terminalAggregator.addGitLine(projectId, '❌ Git commit failed\n', 'stderr');
            reject(new Error('Git commit failed'));
            return;
          }

          console.log(`✅ Changes committed for ${projectId}`);
          terminalAggregator.addGitLine(projectId, '✅ Changes committed successfully\n');
          resolve();
        });
      });
    });
  });
}
