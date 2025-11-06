import { EventEmitter } from 'events';
import { claudeService, ClaudeEvent } from './ClaudeService';
import { databaseService } from './DatabaseService';
import { emitChatEvent } from '../handlers/chatHandlers';

/**
 * Tool execution tracking
 */
interface ToolExecution {
  toolName: string;
  toolId: string;
  filePath?: string; // File being operated on (for Read, Write, Edit)
  command?: string; // Command (for Bash)
  startTime: number;
  endTime?: number;
  success?: boolean;
}

/**
 * Claude message (text or thinking)
 */
interface ClaudeMessage {
  type: 'text' | 'thinking';
  content: string;
  thinkingDuration?: number; // Duration in seconds (only for thinking)
  timestamp?: number; // When message was created
}

/**
 * Active chat block being tracked
 */
interface ActiveBlock {
  blockId: string;
  projectId: string;
  claudeMessages: ClaudeMessage[]; // Claude's text messages and thinking
  toolExecutions: ToolExecution[];
  commitHash: string | null;
  filesChanged: number | null;
  operationStartTime: number; // When Claude started working
  isInterrupted: boolean; // Flag to track if user interrupted this block
  thinkingStartTime: number | null; // When thinking started (for duration calculation)
}

/**
 * ChatHistoryManager Service
 *
 * Tracks Claude operations in real-time and updates chat blocks with:
 * - Tool executions (grouped by type)
 * - Commit information
 * - Completion status
 */
class ChatHistoryManager extends EventEmitter {
  private activeBlocks: Map<string, ActiveBlock> = new Map();
  private interruptedBlocks: Set<string> = new Set(); // Track recently interrupted blocks

  /**
   * Initialize the chat history manager
   */
  init(): void {
    console.log('💬 Initializing ChatHistoryManager...');

    // Listen to Claude events
    claudeService.on('claude-event', this.handleClaudeEvent.bind(this));

    console.log('✅ ChatHistoryManager initialized');
  }

  /**
   * Start tracking a new chat block
   */
  startBlock(projectId: string, blockId: string): void {
    console.log(`💬 Starting block tracking: ${blockId} for project ${projectId}`);

    // Clear any previous interrupted flag for this project
    this.interruptedBlocks.delete(projectId);

    this.activeBlocks.set(projectId, {
      blockId,
      projectId,
      claudeMessages: [],
      toolExecutions: [],
      commitHash: null,
      filesChanged: null,
      operationStartTime: Date.now(),
      isInterrupted: false,
      thinkingStartTime: null,
    });
  }

  /**
   * Handle Claude events and update active blocks
   */
  private handleClaudeEvent({ projectId, event }: { projectId: string; event: ClaudeEvent }): void {
    const activeBlock = this.activeBlocks.get(projectId);

    // Skip if no active block for this project
    if (!activeBlock) {
      return;
    }

    const msg = event.message;

    // Track Claude text messages and tool executions
    if (event.type === 'assistant' && msg?.message?.content) {
      const content = msg.message.content;

      for (const block of content) {
        // Track Claude's text messages
        if (block.type === 'text' && block.text) {
          // IMPORTANT: Text blocks end the current thinking session
          // Complete any active thinking before adding the text
          if (activeBlock.thinkingStartTime) {
            const activeThinking = activeBlock.claudeMessages.find(m => m.type === 'thinking' && !m.thinkingDuration);
            if (activeThinking) {
              const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
              activeThinking.thinkingDuration = parseInt(duration);
              activeBlock.thinkingStartTime = null; // Reset timer
              console.log(`🧠 Thinking completed by text block: ${duration}s`);
            }
          }

          activeBlock.claudeMessages.push({
            type: 'text',
            content: block.text,
            timestamp: Date.now(),
          });
        }

        // Track thinking blocks
        if (block.type === 'thinking' && block.thinking) {
          // Check if there's an active thinking message (without duration)
          const existingThinking = activeBlock.claudeMessages.find(m => m.type === 'thinking' && !m.thinkingDuration);

          if (existingThinking) {
            // Update existing thinking content (streaming)
            existingThinking.content = block.thinking;
          } else {
            // New thinking session - complete previous one if exists
            if (activeBlock.thinkingStartTime) {
              const previousThinking = activeBlock.claudeMessages
                .filter(m => m.type === 'thinking')
                .pop();
              if (previousThinking && !previousThinking.thinkingDuration) {
                const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
                previousThinking.thinkingDuration = parseInt(duration);
                console.log(`🧠 Previous thinking completed: ${duration}s`);
              }
            }

            // Start new thinking session
            activeBlock.thinkingStartTime = Date.now();
            activeBlock.claudeMessages.push({
              type: 'thinking',
              content: block.thinking,
              timestamp: Date.now(),
            });
            console.log(`🧠 Thinking started for block ${activeBlock.blockId}`);
          }
        }

        // Track tool executions with details
        if (block.type === 'tool_use') {
          const toolName = block.name;

          // LOGGING: Track tool usage and flag execution tools
          const isExecutionTool = ['Edit', 'Write', 'Bash', 'NotebookEdit'].includes(toolName);
          const isExitPlanMode = toolName === 'ExitPlanMode';

          if (isExitPlanMode) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📋 [EXIT PLAN MODE] Claude called ExitPlanMode tool');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ Plan is ready for user approval');
            console.log('⏸️  Claude should STOP here and wait for user approval');
            console.log('❌ NO execution tools (Edit/Write/Bash) should follow');
          } else if (isExecutionTool) {
            console.log('⚠️  [TOOL EXECUTION] Claude using EXECUTION tool: ' + toolName);
            console.log('   ⚠️  This should ONLY happen when NOT in plan mode!');
          } else {
            console.log(`🔧 [TOOL USE] Claude using ${toolName}`);
          }

          const toolExecution: ToolExecution = {
            toolName,
            toolId: block.id,
            startTime: Date.now(),
          };

          // Extract file path for Read, Write, Edit tools
          if (block.input && (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit')) {
            toolExecution.filePath = block.input.file_path || block.input.path;
          }

          // Extract command for Bash tool
          if (block.input && toolName === 'Bash') {
            toolExecution.command = block.input.command;
          }

          activeBlock.toolExecutions.push(toolExecution);
        }
      }

      // Update block
      this.updateBlock(activeBlock);
    }

    // Track tool results
    if (event.type === 'tool_result' && msg?.message) {
      const toolId = msg.message.tool_use_id;
      const isError = msg.message.is_error;

      // Find the tool execution
      const execution = activeBlock.toolExecutions.find(e => e.toolId === toolId);
      if (execution) {
        execution.endTime = Date.now();
        execution.success = !isError;

        // Update block
        this.updateBlock(activeBlock);
      }
    }

    // Completion - extract stats, summary, and mark complete
    if (event.type === 'result') {
      // Check if block was interrupted by user
      if (activeBlock.isInterrupted) {
        console.log(`⚠️ Block ${activeBlock.blockId} was interrupted - skipping normal completion`);
        // Just clean up and exit - cancelBlock() already handled everything
        this.activeBlocks.delete(projectId);
        return;
      }

      console.log(`💬 Completing block: ${activeBlock.blockId}`);

      const timeSeconds = ((Date.now() - activeBlock.operationStartTime) / 1000).toFixed(1);

      // Finalize ALL thinking durations that don't have one yet
      if (activeBlock.thinkingStartTime) {
        const thinkingDuration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
        // Find ALL thinking messages without durations and complete them
        const unfinishedThinking = activeBlock.claudeMessages.filter(m => m.type === 'thinking' && !m.thinkingDuration);
        for (const thinkingMsg of unfinishedThinking) {
          thinkingMsg.thinkingDuration = parseInt(thinkingDuration);
        }
        if (unfinishedThinking.length > 0) {
          console.log(`🧠 Thinking completed: ${thinkingDuration}s (${unfinishedThinking.length} session(s))`);
        }
      }

      // Extract completion stats
      const completionStats = {
        timeSeconds: parseFloat(timeSeconds),
        inputTokens: msg?.usage?.input_tokens || 0,
        outputTokens: msg?.usage?.output_tokens || 0,
        cost: msg?.total_cost_usd || 0,
      };

      // Extract summary from last text message if it looks like a summary
      let summary: string | null = null;
      const lastTextMessage = activeBlock.claudeMessages.filter(m => m.type === 'text').pop();
      if (lastTextMessage && (lastTextMessage.content.includes('## Summary') || lastTextMessage.content.includes('### Summary'))) {
        summary = lastTextMessage.content;
      }

      // Detect interaction type based on Claude's response
      let interactionType: string | null = null;

      // Check if this was a plan mode session (has ExitPlanMode tool)
      const hasExitPlanMode = activeBlock.toolExecutions.some(t => t.toolName === 'ExitPlanMode');
      if (hasExitPlanMode) {
        interactionType = 'plan_ready';
        console.log('📋 Detected interaction type: plan_ready (ExitPlanMode tool used)');
      }

      // Check for questions in Claude's messages
      const hasQuestions = activeBlock.claudeMessages.some(m =>
        m.type === 'text' && m.content.includes('<QUESTIONS>')
      );
      if (hasQuestions) {
        interactionType = 'questions';
        console.log('❓ Detected interaction type: questions (<QUESTIONS> tag found)');
      }

      // If no special type detected, it's a regular Claude response
      if (!interactionType) {
        interactionType = 'claude_response';
      }

      // Update block with final data and mark complete
      databaseService.updateChatBlock(activeBlock.blockId, {
        completionStats: JSON.stringify(completionStats),
        summary: summary,
        interactionType: interactionType,
      });

      databaseService.completeChatBlock(activeBlock.blockId);

      // Get completed block and emit event
      const completedBlock = databaseService.getChatBlock(activeBlock.blockId);
      if (completedBlock) {
        emitChatEvent('chat:block-completed', projectId, completedBlock);
      }

      // Remove from active blocks
      this.activeBlocks.delete(projectId);
    }
  }

  /**
   * Update git commit info for active block
   */
  updateCommitInfo(projectId: string, commitHash: string, filesChanged: number): void {
    const activeBlock = this.activeBlocks.get(projectId);

    // Get block ID - either from active block or from last completed block
    let blockId: string | null = null;

    if (activeBlock) {
      blockId = activeBlock.blockId;
      activeBlock.commitHash = commitHash;
      activeBlock.filesChanged = filesChanged;
    } else {
      // Try to find the most recent block for this project
      const blocks = databaseService.getChatHistory(projectId, 1);
      if (blocks.length > 0) {
        blockId = blocks[0].id;
      }
    }

    if (!blockId) {
      console.warn(`⚠️ No block found for project ${projectId} to update commit info`);
      return;
    }

    console.log(`💬 Updating commit info for block ${blockId}: ${commitHash}`);

    // Update database
    databaseService.updateChatBlock(blockId, {
      commitHash,
      filesChanged,
    });

    // Emit update event
    const updatedBlock = databaseService.getChatBlock(blockId);
    if (updatedBlock) {
      emitChatEvent('chat:block-updated', projectId, updatedBlock);
    }
  }

  /**
   * Add an action to active block (git commit, build, dev server)
   */
  addAction(projectId: string, action: {
    type: 'git_commit' | 'build' | 'dev_server' | 'checkpoint_restore'
    status: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
  }): void {
    const activeBlock = this.activeBlocks.get(projectId);

    // Get block ID - either from active block or from last completed block
    let blockId: string | null = null;

    if (activeBlock) {
      blockId = activeBlock.blockId;
    } else {
      // Try to find the most recent block for this project
      const blocks = databaseService.getChatHistory(projectId, 1);
      if (blocks.length > 0) {
        blockId = blocks[0].id;
      }
    }

    if (!blockId) {
      console.warn(`⚠️ No block found for project ${projectId} to add action`);
      return;
    }

    console.log(`💬 Adding action to block ${blockId}: ${action.type} (${action.status})`);

    // Add action to database
    databaseService.addAction(blockId, {
      ...action,
      timestamp: Date.now(),
    });

    // Emit update event
    const updatedBlock = databaseService.getChatBlock(blockId);
    if (updatedBlock) {
      emitChatEvent('chat:block-updated', projectId, updatedBlock);
    }
  }

  /**
   * Update the last action for a project
   */
  updateLastAction(projectId: string, updates: {
    status?: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
  }): void {
    const activeBlock = this.activeBlocks.get(projectId);

    // Get block ID - either from active block or from last completed block
    let blockId: string | null = null;

    if (activeBlock) {
      blockId = activeBlock.blockId;
    } else {
      // Try to find the most recent block for this project
      const blocks = databaseService.getChatHistory(projectId, 1);
      if (blocks.length > 0) {
        blockId = blocks[0].id;
      }
    }

    if (!blockId) {
      console.warn(`⚠️ No block found for project ${projectId} to update action`);
      return;
    }

    // Use atomic updateLastActionInBlock to prevent race conditions
    databaseService.updateLastActionInBlock(blockId, updates);

    // Emit update event
    const updatedBlock = databaseService.getChatBlock(blockId);
    if (updatedBlock) {
      emitChatEvent('chat:block-updated', projectId, updatedBlock);
    }
  }

  /**
   * Update block with current Claude messages and tool executions
   */
  private updateBlock(activeBlock: ActiveBlock): void {
    // Store individual tool executions while working (not grouped)
    const toolExecutionsJson = JSON.stringify(activeBlock.toolExecutions);

    // Store Claude messages
    const claudeMessagesJson = JSON.stringify(activeBlock.claudeMessages);

    // Update database
    databaseService.updateChatBlock(activeBlock.blockId, {
      claudeMessages: claudeMessagesJson,
      toolExecutions: toolExecutionsJson,
    });

    // Emit update event
    const updatedBlock = databaseService.getChatBlock(activeBlock.blockId);
    if (updatedBlock) {
      emitChatEvent('chat:block-updated', activeBlock.projectId, updatedBlock);
    }
  }

  /**
   * Group tool executions by type for compact display
   * Example: { "Edit": 3, "Read": 5, "Bash": 2 }
   */
  private groupToolExecutions(executions: ToolExecution[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const execution of executions) {
      const toolName = execution.toolName;
      grouped[toolName] = (grouped[toolName] || 0) + 1;
    }

    return grouped;
  }

  /**
   * Get active block for a project
   */
  getActiveBlock(projectId: string): ActiveBlock | undefined {
    return this.activeBlocks.get(projectId);
  }

  /**
   * Check if project has an active block
   */
  hasActiveBlock(projectId: string): boolean {
    return this.activeBlocks.has(projectId);
  }

  /**
   * Check if project was recently interrupted
   */
  wasInterrupted(projectId: string): boolean {
    return this.interruptedBlocks.has(projectId);
  }

  /**
   * Clear interrupted flag for project
   */
  clearInterrupted(projectId: string): void {
    this.interruptedBlocks.delete(projectId);
  }

  /**
   * Cancel/abort active block
   */
  cancelBlock(projectId: string): void {
    const activeBlock = this.activeBlocks.get(projectId);

    if (!activeBlock) {
      return;
    }

    console.log(`💬 Canceling block: ${activeBlock.blockId}`);

    // Mark as interrupted BEFORE any completion logic
    activeBlock.isInterrupted = true;

    // Track this project as interrupted so claude-complete handler can check it
    this.interruptedBlocks.add(projectId);
    console.log(`🔴 Marked project ${projectId} as interrupted`);

    // Add interrupted message to the block
    const interruptedMessage = '⚠️ Stopped by user';
    activeBlock.claudeMessages.push(interruptedMessage);

    // Update block with interrupted message
    databaseService.updateChatBlock(activeBlock.blockId, {
      claudeMessages: JSON.stringify(activeBlock.claudeMessages),
    });

    // Mark as complete (even though it was canceled)
    databaseService.completeChatBlock(activeBlock.blockId);

    // Emit completion event
    const completedBlock = databaseService.getChatBlock(activeBlock.blockId);
    if (completedBlock) {
      emitChatEvent('chat:block-completed', projectId, completedBlock);
    }

    // DON'T delete from active blocks yet!
    // Keep it in memory so handleClaudeEvent can check isInterrupted flag
    // It will be removed when next block starts or in the completion handler
  }
}

// Export singleton instance
export const chatHistoryManager = new ChatHistoryManager();
