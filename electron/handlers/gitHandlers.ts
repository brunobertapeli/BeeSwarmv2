import { ipcMain, WebContents } from 'electron';
import { spawn, execSync } from 'child_process';
import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
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
  // Check if GitHub CLI is installed and authenticated
  ipcMain.handle('git:check-gh-cli', async () => {
    try {
      // Check if gh is installed
      try {
        execSync('gh --version', { stdio: 'pipe' });
      } catch {
        return { success: true, installed: false, authenticated: false };
      }

      // Check if gh is authenticated
      try {
        execSync('gh auth status', { stdio: 'pipe' });
        return { success: true, installed: true, authenticated: true };
      } catch {
        return { success: true, installed: true, authenticated: false };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get git status (uncommitted files)
  ipcMain.handle('git:get-status', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);
      const status: StatusResult = await git.status();

      // Format files with their status
      const files = [
        ...status.created.map(f => ({ path: f, status: 'added' as const })),
        ...status.modified.map(f => ({ path: f, status: 'modified' as const })),
        ...status.deleted.map(f => ({ path: f, status: 'deleted' as const })),
        ...status.not_added.map(f => ({ path: f, status: 'untracked' as const })),
      ];

      return {
        success: true,
        files,
        hasChanges: files.length > 0,
        ahead: status.ahead,
        behind: status.behind,
        branch: status.current || 'main',
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get remote origin URL
  ipcMain.handle('git:get-remote', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      try {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');

        if (origin && origin.refs.push) {
          // Extract repo URL for GitHub link
          let repoUrl = origin.refs.push;
          // Convert SSH to HTTPS for browser
          if (repoUrl.startsWith('git@github.com:')) {
            repoUrl = repoUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '');
          } else if (repoUrl.endsWith('.git')) {
            repoUrl = repoUrl.replace('.git', '');
          }

          // Try to get repo visibility using gh CLI
          let isPrivate = true; // Default to private
          try {
            const repoInfo = execSync('gh repo view --json isPrivate', {
              cwd: project.path,
              stdio: 'pipe',
            }).toString();
            const parsed = JSON.parse(repoInfo);
            isPrivate = parsed.isPrivate ?? true;
          } catch {
            // If gh fails, assume private
          }

          return { success: true, hasRemote: true, url: origin.refs.push, repoUrl, isPrivate };
        }

        return { success: true, hasRemote: false };
      } catch {
        return { success: true, hasRemote: false };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get unpushed commits (commits ahead of origin)
  ipcMain.handle('git:get-unpushed', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      try {
        // Get current branch
        const status = await git.status();
        const branch = status.current || 'main';

        // Get commits that are ahead of origin
        const log: LogResult = await git.log([`origin/${branch}..HEAD`]);

        const commits = log.all.map(commit => ({
          hash: commit.hash,
          shortHash: commit.hash.substring(0, 7),
          message: commit.message,
          date: commit.date,
          author: commit.author_name,
        }));

        return { success: true, commits, ahead: status.ahead };
      } catch {
        // No remote tracking or no commits
        return { success: true, commits: [], ahead: 0 };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get commit history
  ipcMain.handle('git:get-log', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      try {
        const log: LogResult = await git.log({ maxCount: 50 });

        const commits = log.all.map(commit => ({
          hash: commit.hash,
          shortHash: commit.hash.substring(0, 7),
          message: commit.message,
          date: commit.date,
          author: commit.author_name,
        }));

        return { success: true, commits };
      } catch {
        // No commits yet
        return { success: true, commits: [] };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Push only (no commit needed since app auto-commits)
  ipcMain.handle('git:push', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);
      const status = await git.status();
      const branch = status.current || 'main';

      await git.push('origin', branch);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Commit and push
  ipcMain.handle('git:commit-and-push', async (_event, projectId: string, message: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      // Stage all changes
      await git.add('.');

      // Commit
      await git.commit(message);

      // Push
      await git.push('origin', 'main');

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create GitHub repo using gh CLI
  ipcMain.handle('git:create-repo', async (_event, projectId: string, repoName: string, description: string, isPrivate: boolean) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      // Check if there are any commits, if not create an initial commit
      try {
        await git.log({ maxCount: 1 });
      } catch {
        // No commits yet - create initial commit
        await git.add('.');
        await git.commit('Initial commit');
      }

      const visibility = isPrivate ? '--private' : '--public';
      const descFlag = description ? `--description "${description}"` : '';

      // Use gh CLI to create repo and push
      const command = `gh repo create "${repoName}" ${visibility} ${descFlag} --source=. --remote=origin --push`;

      execSync(command, {
        cwd: project.path,
        stdio: 'pipe',
      });

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      // Check for common errors
      if (errorMsg.includes('already exists')) {
        return { success: false, error: 'Repository name already exists on GitHub' };
      }
      return { success: false, error: errorMsg };
    }
  });

  // Revert to commit and force push
  ipcMain.handle('git:revert-and-push', async (_event, projectId: string, commitHash: string) => {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const git: SimpleGit = simpleGit(project.path);

      // Hard reset to commit
      await git.reset(['--hard', commitHash]);

      // Force push
      await git.push('origin', 'main', ['--force']);

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Restore to checkpoint (commit hash)
  ipcMain.handle('git:restore-checkpoint', async (_event, projectId: string, commitHash: string) => {
    try {

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

        terminalAggregator.addSystemLine(projectId, `❌ Commit ${commitHash} does not exist in this repository\n`);
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

        terminalAggregator.addSystemLine(projectId, `❌ ${checkoutResult.error}\n`);
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
 * Reset ephemeral files before checkout (logs that shouldn't block restore)
 */
async function resetEphemeralFiles(projectPath: string): Promise<void> {
  return new Promise((resolve) => {
    // Reset .codedeck/ directory - these are ephemeral logging files
    // that shouldn't block checkpoint restoration
    const resetProcess = spawn('git', ['checkout', 'HEAD', '--', '.codedeck/'], {
      cwd: projectPath,
    });

    resetProcess.on('close', () => {
      // Ignore errors - files might not exist in HEAD or might not be tracked
      resolve();
    });
  });
}

/**
 * Get the current branch name, or default to 'main' if in detached HEAD
 */
async function getCurrentBranch(projectPath: string): Promise<string> {
  return new Promise((resolve) => {
    // Try to get current branch name
    const branchProcess = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectPath,
    });

    let output = '';
    branchProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    branchProcess.on('close', (code) => {
      const branch = output.trim();
      // If HEAD (detached) or error, default to 'main'
      if (code !== 0 || branch === 'HEAD' || !branch) {
        resolve('main');
      } else {
        resolve(branch);
      }
    });
  });
}

/**
 * Perform git checkout to a specific commit
 * Uses -B to ensure we stay on a proper branch (not detached HEAD)
 */
async function performGitCheckout(
  projectId: string,
  projectPath: string,
  commitHash: string
): Promise<{ success: boolean; error?: string }> {
  // First, reset ephemeral files that shouldn't block checkout
  await resetEphemeralFiles(projectPath);

  // Get current branch name to maintain branch context
  const branchName = await getCurrentBranch(projectPath);

  return new Promise((resolve) => {
    // Use -B to create/reset branch at the target commit
    // This avoids detached HEAD state and keeps history clean
    const checkoutProcess = spawn('git', ['checkout', '-B', branchName, commitHash], {
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
  if (processState === 'running' || processState === 'error') {
    const devServerStartTime = Date.now();


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
      // Force stop - this is an intentional restart after checkpoint restore
      await processManager.stopDevServer(projectId, true);

      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '✅ Stopped | ⏳ Starting...\n',
        raw: '✅ Stopped | ⏳ Starting...\n',
      });

      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s

      // Get deployServices from project for correct strategy (Railway vs Netlify)
      const project = databaseService.getProjectById(projectId);
      const deployServices = project?.deployServices
        ? JSON.parse(project.deployServices)
        : ['netlify'];

      const port = await processManager.startDevServer(projectId, projectPath, deployServices);

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
  }
}
