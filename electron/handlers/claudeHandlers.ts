import { ipcMain, WebContents } from 'electron';
import { claudeService, ClaudeStatus, ClaudeEvent, ClaudeContext, ClaudeAttachment } from '../services/ClaudeService';
import { terminalAggregator } from '../services/TerminalAggregator';
import { databaseService } from '../services/DatabaseService';
import { processManager } from '../services/ProcessManager';
import { chatHistoryManager } from '../services/ChatHistoryManager';
import { projectLockService } from '../services/ProjectLockService';
import { emitChatEvent } from './chatHandlers';
import { spawn } from 'child_process';
import * as path from 'path';
import { getCurrentUserId } from '../main';
import { validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware';

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
  ipcMain.handle('claude:start-session', async (_event, projectId: string, prompt?: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean) => {
    try {
      // SECURITY: Validate user owns this project
      const project = validateProjectOwnership(projectId);

      // Only start if we have a prompt - prevents auto-start on project load
      if (!prompt) {
        return {
          success: true,
        };
      }

      // Add user message block to terminal
      terminalAggregator.addUserLine(projectId, '\n\n');
      terminalAggregator.addUserLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      terminalAggregator.addUserLine(projectId, '👤 USER REQUEST\n');
      terminalAggregator.addUserLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      terminalAggregator.addUserLine(projectId, prompt + '\n');
      if (attachments && attachments.length > 0) {
        terminalAggregator.addUserLine(projectId, `📎 ${attachments.length} attachment(s)\n`);
      }
      if (thinkingEnabled) {
        terminalAggregator.addUserLine(projectId, `🧠 Extended thinking enabled\n`);
      }
      terminalAggregator.addUserLine(projectId, '\n');

      // Start Claude session with optional model, attachments, thinking, and plan mode
      // Don't await - let it run in background and return immediately
      claudeService.startSession(projectId, project.path, prompt, model, attachments, thinkingEnabled, planMode);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error starting Claude session:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start Claude session',
      };
    }
  });

  // Send prompt to Claude
  ipcMain.handle('claude:send-prompt', async (_event, projectId: string, prompt: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean) => {
    // CRITICAL FIX: Use project lock to prevent race conditions
    // Prevents multiple Claude operations from running concurrently on same project
    return await projectLockService.withLock(projectId, async () => {
      try {
        // SECURITY: Validate user owns this project
        const project = validateProjectOwnership(projectId);


        // CRITICAL FIX: Validate that any existing session's path matches current project
        // This prevents Claude from editing files in the wrong directory
        const existingSession = claudeService.getSession(projectId);
        if (existingSession && existingSession.projectPath && existingSession.projectPath !== project.path) {
          console.warn(`⚠️ Session path mismatch detected, destroying stale session`);
          console.warn(`   Session path: ${existingSession.projectPath}`);
          console.warn(`   Current path: ${project.path}`);
          claudeService.destroySession(projectId);

          // Add warning to terminal
          terminalAggregator.addSystemLine(
            projectId,
            '⚠️ Project path changed - starting fresh Claude session\n'
          );
        }

        // Add user message block to terminal
        terminalAggregator.addUserLine(projectId, '\n\n');
        terminalAggregator.addUserLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        terminalAggregator.addUserLine(projectId, '👤 USER REQUEST\n');
        terminalAggregator.addUserLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        terminalAggregator.addUserLine(projectId, prompt + '\n');
        if (attachments && attachments.length > 0) {
          terminalAggregator.addUserLine(projectId, `📎 ${attachments.length} attachment(s)\n`);
        }
        if (thinkingEnabled) {
          terminalAggregator.addUserLine(projectId, `🧠 Extended thinking enabled\n`);
        }
        terminalAggregator.addUserLine(projectId, '\n');

        // Send prompt using session resume pattern with optional model, attachments, thinking, and plan mode
        await claudeService.sendPrompt(projectId, project.path, prompt, model, attachments, thinkingEnabled, planMode);

        return {
          success: true,
        };
      } catch (error) {
        console.error('❌ Error sending prompt to Claude:', error);

        if (error instanceof UnauthorizedError) {
          return {
            success: false,
            error: 'Unauthorized'
          };
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send prompt',
        };
      }
    }, 'claude:send-prompt');
  });

  // Get Claude session status
  ipcMain.handle('claude:get-status', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      const status = claudeService.getStatus(projectId);
      const sessionId = claudeService.getSessionId(projectId);

      return {
        success: true,
        status,
        sessionId,
      };
    } catch (error) {
      console.error('❌ Error getting Claude status:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
          status: 'idle' as ClaudeStatus,
          sessionId: null,
        };
      }

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
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);


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

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear session',
      };
    }
  });

  // Destroy Claude session
  ipcMain.handle('claude:destroy-session', async (_event, projectId: string) => {
    try {

      // Try to get project - if it doesn't exist, session cleanup is a no-op
      let project;
      try {
        // Use silent mode since we expect this to fail for deleted projects
        project = validateProjectOwnership(projectId, true);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          // Project not found or unauthorized - session already cleaned up or doesn't exist
          return { success: true };
        }
        throw error;
      }

      // 1. Interrupt the Claude session (not destroy - keeps conversation history)
      claudeService.interrupt(projectId);

      // 2. Check if there were any file edits in the active block
      const activeBlock = chatHistoryManager.getActiveBlock(projectId);
      const hadFileEdits = activeBlock?.toolExecutions?.some(
        (tool) => tool.toolName === 'Edit' || tool.toolName === 'Write'
      ) || false;


      // 3. Cancel the active block and mark as interrupted
      if (activeBlock) {
        chatHistoryManager.cancelBlock(projectId);
      }

      // 4. Only revert if there were actual file changes
      if (hadFileEdits) {
        // Find last valid commit from chat history
        const history = databaseService.getChatHistory(projectId, 10);
        const lastValidBlock = history.find(
          (block) => block.commitHash && block.commitHash !== 'unknown' && block.commitHash.length >= 7
        );

        if (lastValidBlock?.commitHash) {

          // Import and call restore function directly (not via IPC)
          const gitHandlers = await import('./gitHandlers.js');

          // Small delay to ensure block is completed first
          setTimeout(async () => {
            try {
              // Call the restore function - we need to extract it from the module
              // Since registerGitHandlers wraps it, we'll create a new restore directly
              await performRestore(projectId, lastValidBlock.commitHash, project.path);
            } catch (error) {
              console.error(`❌ Error reverting to checkpoint:`, error);
            }
          }, 100);
        } else {
        }
      } else {
      }

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

  // Get context information
  ipcMain.handle('claude:get-context', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      const context = claudeService.getContext(projectId);

      return {
        success: true,
        context,
      };
    } catch (error) {
      console.error('❌ Error getting Claude context:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized',
          context: null,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get context',
        context: null,
      };
    }
  });

  // Change model
  ipcMain.handle('claude:change-model', async (_event, projectId: string, modelName: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);


      await claudeService.changeModel(projectId, modelName);

      // Add system message to terminal
      terminalAggregator.addSystemLine(
        projectId,
        `🔄 Model changed to ${modelName}\n`
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error changing model:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change model',
      };
    }
  });

  // Get available models
  ipcMain.handle('claude:get-models', async (_event) => {
    try {
      const models = await claudeService.getAvailableModels();

      return {
        success: true,
        models,
      };
    } catch (error) {
      console.error('❌ Error getting available models:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get models',
        models: [],
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
  // Track Claude operation timing per project
  const operationStartTimes = new Map<string, number>();
  const toolExecutions = new Map<string, { toolName: string; startTime: number }>();

  // Forward Claude events (with rich parsing for beautiful terminal output)
  claudeService.on('claude-event', ({ projectId, event }: { projectId: string; event: ClaudeEvent }) => {
    // Skip partial messages (they're for streaming UI, not terminal)
    if (event.type === 'partial') {
      return;
    }

    const msg = event.message;

    // ═══════════════════════════════════════════════════════════
    // SYSTEM MESSAGES - Session initialization
    // ═══════════════════════════════════════════════════════════
    if (event.type === 'system') {
      if (msg?.subtype === 'init') {
        const model = msg.model || 'unknown';
        const sessionId = msg.session_id || 'new';

        terminalAggregator.addClaudeLine(projectId, '\n');
        terminalAggregator.addClaudeLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        terminalAggregator.addClaudeLine(projectId, '🤖 CLAUDE CODE SESSION INITIALIZED\n');
        terminalAggregator.addClaudeLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        terminalAggregator.addClaudeLine(projectId, `Model: ${model} | Session: ${sessionId.substring(0, 12)}...\n`);
        terminalAggregator.addClaudeLine(projectId, '\n');

        // Start operation timer
        operationStartTimes.set(projectId, Date.now());
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // ASSISTANT MESSAGES - Claude's responses and tool usage
    // ═══════════════════════════════════════════════════════════
    if (event.type === 'assistant' && msg?.message?.content) {
      const content = msg.message.content;

      if (Array.isArray(content)) {
        for (const block of content) {
          // Thinking blocks - Claude's internal reasoning
          if (block.type === 'thinking' && block.thinking) {
            terminalAggregator.addClaudeLine(projectId, '\n');
            terminalAggregator.addClaudeLine(projectId, '### 🧠 Claude is thinking:\n');
            terminalAggregator.addClaudeLine(projectId, block.thinking + '\n');
            terminalAggregator.addClaudeLine(projectId, '###\n');
            terminalAggregator.addClaudeLine(projectId, '\n');
          }

          // Text blocks - Claude's explanations
          if (block.type === 'text' && block.text) {

            terminalAggregator.addClaudeLine(projectId, '\n');
            terminalAggregator.addClaudeLine(projectId, '### 💭 Claude:\n');
            terminalAggregator.addClaudeLine(projectId, block.text + '\n');
            terminalAggregator.addClaudeLine(projectId, '###\n');
            terminalAggregator.addClaudeLine(projectId, '\n');
          }

          // Tool use blocks - Claude executing tools
          if (block.type === 'tool_use') {
            const toolName = block.name || 'unknown';
            const toolId = block.id;

            // Store start time for this tool execution
            toolExecutions.set(toolId, { toolName, startTime: Date.now() });

            terminalAggregator.addClaudeLine(projectId, '\n');
            terminalAggregator.addClaudeLine(projectId, `### 🔧 Tool: ${toolName}\n`);

            // Show tool input in a readable format
            if (block.input && typeof block.input === 'object') {
              const input = block.input as any;

              // Special formatting for common tools
              if (toolName === 'Read') {
                terminalAggregator.addClaudeLine(projectId, `📖 Reading: ${input.file_path || 'unknown'}\n`);
              } else if (toolName === 'Write') {
                terminalAggregator.addClaudeLine(projectId, `✍️  Writing: ${input.file_path || 'unknown'}\n`);
                const lines = (input.content || '').split('\n').length;
                terminalAggregator.addClaudeLine(projectId, `   Lines: ${lines}\n`);
              } else if (toolName === 'Edit') {
                terminalAggregator.addClaudeLine(projectId, `✏️  Editing: ${input.file_path || 'unknown'}\n`);
              } else if (toolName === 'Bash') {
                terminalAggregator.addClaudeLine(projectId, `💻 Command: ${input.command || 'unknown'}\n`);
              } else if (toolName === 'Glob') {
                terminalAggregator.addClaudeLine(projectId, `🔍 Pattern: ${input.pattern || 'unknown'}\n`);
              } else if (toolName === 'Grep') {
                terminalAggregator.addClaudeLine(projectId, `🔎 Search: ${input.pattern || 'unknown'}\n`);
              } else if (toolName === 'WebSearch') {
                terminalAggregator.addClaudeLine(projectId, `🌐 Query: ${input.query || 'unknown'}\n`);
              } else {
                // Generic tool - show key inputs only
                for (const [key, value] of Object.entries(input)) {
                  const displayValue = typeof value === 'string' && value.length > 60
                    ? value.substring(0, 57) + '...'
                    : String(value);
                  terminalAggregator.addClaudeLine(projectId, `${key}: ${displayValue}\n`);
                }
              }
            }

            terminalAggregator.addClaudeLine(projectId, '⏳ Executing...\n');
            terminalAggregator.addClaudeLine(projectId, '###\n');
          }
        }
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // USER MESSAGES - User's prompts (echoed by SDK)
    // ═══════════════════════════════════════════════════════════
    if (event.type === 'user' && msg?.message?.content) {
      // User message is already shown in send-prompt handler
      // Skip to avoid duplication
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // TOOL RESULTS - Results from tool executions
    // ═══════════════════════════════════════════════════════════
    if (event.type === 'tool_result' && msg?.message?.content) {
      const toolId = msg.message.tool_use_id;
      const content = msg.message.content;

      // Get tool execution info
      const toolInfo = toolExecutions.get(toolId);
      const elapsed = toolInfo ? Date.now() - toolInfo.startTime : 0;
      const toolName = toolInfo?.toolName || 'unknown';

      // Clean up stored tool execution
      if (toolId) {
        toolExecutions.delete(toolId);
      }

      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            const isError = msg.message.is_error || block.text.includes('Error:') || block.text.includes('Failed');
            const icon = isError ? '❌' : '✅';

            terminalAggregator.addClaudeLine(projectId, `${icon} Result: ${toolName} (${elapsed}ms)\n`, isError ? 'stderr' : 'stdout');

            // Show a compact preview of the result
            const resultLines = block.text.split('\n');
            const totalLines = resultLines.length;

            if (totalLines <= 3) {
              // Short result - show all
              terminalAggregator.addClaudeLine(projectId, block.text + '\n', isError ? 'stderr' : 'stdout');
            } else {
              // Long result - show first 2 lines and summary
              for (let i = 0; i < 2; i++) {
                terminalAggregator.addClaudeLine(projectId, resultLines[i] + '\n', isError ? 'stderr' : 'stdout');
              }
              terminalAggregator.addClaudeLine(projectId, `... (${totalLines - 2} more lines)\n`);
            }

            terminalAggregator.addClaudeLine(projectId, '\n');
          }
        }
      }
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // RESULT MESSAGE - Operation complete
    // ═══════════════════════════════════════════════════════════
    if (event.type === 'result') {
      const startTime = operationStartTimes.get(projectId);
      const totalElapsed = startTime ? Date.now() - startTime : 0;
      const seconds = (totalElapsed / 1000).toFixed(1);

      // Show usage stats if available
      const usage = msg?.usage;
      const cost = msg?.total_cost_usd;

      terminalAggregator.addClaudeLine(projectId, '\n');
      terminalAggregator.addClaudeLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      terminalAggregator.addClaudeLine(projectId, '✨ CLAUDE CODE COMPLETED\n');
      terminalAggregator.addClaudeLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      let statsLine = `⏱️  ${seconds}s`;
      if (usage) {
        statsLine += ` | 📊 ${usage.input_tokens || 0}→${usage.output_tokens || 0} tokens`;
      }
      if (cost !== undefined) {
        statsLine += ` | 💰 $${cost.toFixed(4)}`;
      }
      terminalAggregator.addClaudeLine(projectId, statsLine + '\n');

      terminalAggregator.addClaudeLine(projectId, '\n');

      // Clean up
      operationStartTimes.delete(projectId);
      return;
    }
  });

  // Forward status changes to renderer
  claudeService.on('claude-status', ({ projectId, status }: { projectId: string; status: ClaudeStatus }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:status-changed', projectId, status);
    }
  });

  // Handle Claude completion
  claudeService.on('claude-complete', async ({ projectId }: { projectId: string }) => {

    // Check if project was interrupted - skip post-completion workflow
    if (chatHistoryManager.wasInterrupted(projectId)) {
      // Clear the interrupted flag now that we've handled it
      chatHistoryManager.clearInterrupted(projectId);
      return;
    }

    // Get project details
    const project = databaseService.getProjectById(projectId);
    if (!project) {
      console.error(`❌ Project not found: ${projectId}`);
      return;
    }

    // Post-completion workflow (git commit, dev server restart)
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

    // Notify renderer
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:exited', projectId, exitCode);
    }
  });

  // Forward context updates to renderer
  claudeService.on('claude-context-updated', ({ projectId, context }: { projectId: string; context: ClaudeContext }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:context-updated', projectId, context);
    }
  });

  // Forward model changes to renderer
  claudeService.on('claude-model-changed', ({ projectId, model }: { projectId: string; model: string }) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:model-changed', projectId, model);
    }
  });

  // Handle questions from Claude (plan mode)
  claudeService.on('claude-questions', ({ projectId, questions }: { projectId: string; questions: any }) => {

    // TODO: Forward to renderer for UI display
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('claude:questions', projectId, questions);
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

    // Check if there were any file-modifying tools used
    const blocks = databaseService.getChatHistory(projectId, 1);
    if (blocks.length > 0) {
      const lastBlock = blocks[0];
      let toolExecutions: any[] = [];

      try {
        if (lastBlock.toolExecutions) {
          toolExecutions = JSON.parse(lastBlock.toolExecutions);
        }
      } catch (e) {
        console.error('Failed to parse tool executions:', e);
      }

      // Check if any file-modifying tools were used
      // NOTE: Only Edit and Write actually modify files
      // Bash is excluded because it's often used for read-only operations (cat, ls, grep, etc.)
      const hasFileModifications = toolExecutions.some(
        (tool: any) => tool.toolName === 'Edit' || tool.toolName === 'Write'
      );

      if (!hasFileModifications) {
        terminalAggregator.addSystemLine(projectId, '\n');
        terminalAggregator.addSystemLine(projectId, 'ℹ️  No file changes detected - skipping commit and restart\n');
        terminalAggregator.addSystemLine(projectId, '\n');
        return;
      }
    }

    // 1. Git commit
    await gitCommitChanges(projectId, projectPath);

    // 2. Context update (placeholder for future implementation)
    terminalAggregator.addSystemLine(
      projectId,
      '📋 Context update - TODO (placeholder)\n'
    );

    // 3. Restart dev server (if running)
    const processState = processManager.getProcessStatus(projectId);
    if (processState === 'running') {
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
        raw: '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      });
      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '🔄 DEV SERVER RESTART\n',
        raw: '🔄 DEV SERVER RESTART\n'
      });
      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
        raw: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      });
      terminalAggregator.addDevServerLine(projectId, {
        timestamp: new Date(),
        type: 'stdout',
        message: '⏳ Stopping...\n',
        raw: '⏳ Stopping...\n'
      });

      try {
        await processManager.stopDevServer(projectId);

        terminalAggregator.addDevServerLine(projectId, {
          timestamp: new Date(),
          type: 'stdout',
          message: '✅ Stopped | ⏳ Starting...\n',
          raw: '✅ Stopped | ⏳ Starting...\n'
        });

        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s

        const port = await processManager.startDevServer(projectId, projectPath);

        const devServerElapsed = ((Date.now() - devServerStartTime) / 1000).toFixed(1);

        terminalAggregator.addDevServerLine(projectId, {
          timestamp: new Date(),
          type: 'stdout',
          message: `✅ Restarted on port ${port} | ⏱️  ${devServerElapsed}s\n`,
          raw: `✅ Restarted on port ${port} | ⏱️  ${devServerElapsed}s\n`
        });
        terminalAggregator.addDevServerLine(projectId, {
          timestamp: new Date(),
          type: 'stdout',
          message: '\n',
          raw: '\n'
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
          raw: '❌ Failed to restart dev server\n'
        });

        // Update action to error
        chatHistoryManager.updateLastAction(projectId, {
          status: 'error',
          message: 'Failed to restart dev server',
        });
      }
    } else {
    }

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

    const gitStartTime = Date.now();

    // Add git block header
    terminalAggregator.addGitLine(projectId, '\n');
    terminalAggregator.addGitLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    terminalAggregator.addGitLine(projectId, '📦 GIT COMMIT\n');
    terminalAggregator.addGitLine(projectId, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Add git commit action (in progress)
    chatHistoryManager.addAction(projectId, {
      type: 'git_commit',
      status: 'in_progress',
    });

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
        terminalAggregator.addGitLine(projectId, '   ❌ Git status check failed\n', 'stderr');
        terminalAggregator.addGitLine(projectId, '\n');

        // Update action to error
        chatHistoryManager.updateLastAction(projectId, {
          status: 'error',
          message: 'Git status check failed',
        });

        reject(new Error('Git status failed'));
        return;
      }

      // No changes to commit
      if (statusOutput.trim().length === 0) {
        terminalAggregator.addGitLine(projectId, 'ℹ️  No changes detected - working tree clean\n');
        terminalAggregator.addGitLine(projectId, '\n');

        // Update action to success (no changes)
        chatHistoryManager.updateLastAction(projectId, {
          status: 'success',
          message: 'No changes to commit',
        });

        resolve();
        return;
      }

      // Count files changed
      const changedFiles = statusOutput.trim().split('\n').length;
      terminalAggregator.addGitLine(projectId, `📝 Changes: ${changedFiles} file(s) | ⏳ Staging...\n`);

      const addProcess = spawn('git', ['add', '.'], {
        cwd: projectPath,
      });

      addProcess.on('close', (addCode) => {
        if (addCode !== 0) {
          console.error(`❌ Git add failed for ${projectId}`);
          terminalAggregator.addGitLine(projectId, '❌ Failed to stage changes\n', 'stderr');
          terminalAggregator.addGitLine(projectId, '\n');

          // Update action to error
          chatHistoryManager.updateLastAction(projectId, {
            status: 'error',
            message: 'Failed to stage changes',
          });

          reject(new Error('Git add failed'));
          return;
        }

        terminalAggregator.addGitLine(projectId, '✅ Staged | ⏳ Committing...\n');

        // Commit with Claude-generated message
        const commitMessage = 'feat: updates via Claude Code\n\n🤖 Generated with Claude Code';
        const commitProcess = spawn('git', ['commit', '-m', commitMessage], {
          cwd: projectPath,
        });

        let commitOutput = '';
        commitProcess.stdout.on('data', (data) => {
          commitOutput += data.toString();
        });

        commitProcess.stderr.on('data', (data) => {
          commitOutput += data.toString();
        });

        commitProcess.on('close', (commitCode) => {
          if (commitCode !== 0) {
            console.error(`❌ Git commit failed for ${projectId}`);
            terminalAggregator.addGitLine(projectId, '❌ Commit failed\n', 'stderr');
            terminalAggregator.addGitLine(projectId, '\n');

            // Update action to error
            chatHistoryManager.updateLastAction(projectId, {
              status: 'error',
              message: 'Commit failed',
            });

            reject(new Error('Git commit failed'));
            return;
          }

          // Get commit hash reliably using git rev-parse

          // Use git rev-parse HEAD to get the actual commit hash (100% reliable)
          const revParseProcess = spawn('git', ['rev-parse', 'HEAD'], {
            cwd: projectPath,
          });

          let commitHash = 'unknown';
          let revParseOutput = '';

          revParseProcess.stdout.on('data', (data) => {
            revParseOutput += data.toString();
          });

          revParseProcess.on('close', (revParseCode) => {
            if (revParseCode === 0 && revParseOutput.trim()) {
              // Get full hash and trim to 7 characters for display
              commitHash = revParseOutput.trim().substring(0, 7);
            } else {
              console.error(`❌ Failed to get commit hash via rev-parse`);
              commitHash = 'unknown';
            }


            const gitElapsed = ((Date.now() - gitStartTime) / 1000).toFixed(1);

            terminalAggregator.addGitLine(projectId, `✅ Committed: ${commitHash} | ⏱️  ${gitElapsed}s\n`);
            terminalAggregator.addGitLine(projectId, '\n');

            // Update action to success with commit details
            chatHistoryManager.updateLastAction(projectId, {
              status: 'success',
              data: {
                commitHash,
                filesChanged: changedFiles,
                commitTime: parseFloat(gitElapsed),
              },
            });

            // Also update old commit info for backward compatibility
            chatHistoryManager.updateCommitInfo(projectId, commitHash, changedFiles);

            resolve();
          });
        });
      });
    });
  });
}

/**
 * Perform restore to checkpoint (called directly, not via IPC)
 * Used when interrupting Claude to revert code changes
 */
async function performRestore(projectId: string, commitHash: string, projectPath: string): Promise<void> {
  return new Promise((resolve, reject) => {

    // Execute git checkout
    const checkoutProcess = spawn('git', ['checkout', commitHash], {
      cwd: projectPath,
    });

    let errorOutput = '';
    checkoutProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    checkoutProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error(`❌ Git checkout failed for ${projectId}:`, errorOutput);
        reject(new Error('Git checkout failed'));
        return;
      }


      // Restart dev server if running
      const processState = processManager.getProcessStatus(projectId);
      if (processState === 'running') {

        try {
          await processManager.stopDevServer(projectId);
          await new Promise((res) => setTimeout(res, 2000)); // Wait 2s
          await processManager.startDevServer(projectId, projectPath);
        } catch (error) {
          console.error(`❌ Failed to restart dev server:`, error);
        }
      }

      resolve();
    });
  });
}
