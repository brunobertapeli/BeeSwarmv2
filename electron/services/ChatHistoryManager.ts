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

    // Listen to Claude events
    claudeService.on('claude-event', this.handleClaudeEvent.bind(this));

  }

  /**
   * Start tracking a new chat block
   */
  startBlock(projectId: string, blockId: string): void {

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
            // Get the last thinking message (the one currently active)
            const thinkingMessages = activeBlock.claudeMessages.filter(m => m.type === 'thinking');
            const activeThinking = thinkingMessages[thinkingMessages.length - 1];

            if (activeThinking && !activeThinking.thinkingDuration) {
              const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
              activeThinking.thinkingDuration = parseInt(duration);
            }
            activeBlock.thinkingStartTime = null; // Reset timer
          }

          activeBlock.claudeMessages.push({
            type: 'text',
            content: block.text,
            timestamp: Date.now(),
          });
        }

        // Track thinking blocks
        if (block.type === 'thinking' && block.thinking) {
          // Get the last thinking message to check if we're in a streaming session
          const thinkingMessages = activeBlock.claudeMessages.filter(m => m.type === 'thinking');
          const lastThinking = thinkingMessages[thinkingMessages.length - 1];
          const isStreamingExisting = lastThinking && !lastThinking.thinkingDuration;

          if (isStreamingExisting) {
            // Update existing thinking content (streaming)
            lastThinking.content = block.thinking;
          } else {
            // New thinking session - complete previous one if it exists
            if (lastThinking && !lastThinking.thinkingDuration && activeBlock.thinkingStartTime) {
              const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
              lastThinking.thinkingDuration = parseInt(duration);
            }

            // Start new thinking session
            activeBlock.thinkingStartTime = Date.now();
            activeBlock.claudeMessages.push({
              type: 'thinking',
              content: block.thinking,
              timestamp: Date.now(),
            });
          }
        }

        // Track tool executions with details
        if (block.type === 'tool_use') {
          const toolName = block.name;

          // IMPORTANT: Tool use ends the current thinking session
          // Complete any active thinking before tracking the tool
          if (activeBlock.thinkingStartTime) {
            const thinkingMessages = activeBlock.claudeMessages.filter(m => m.type === 'thinking');
            const activeThinking = thinkingMessages[thinkingMessages.length - 1];

            if (activeThinking && !activeThinking.thinkingDuration) {
              const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
              activeThinking.thinkingDuration = parseInt(duration);
            }
            activeBlock.thinkingStartTime = null; // Reset timer
          }

          // LOGGING: Track tool usage and flag execution tools
          const isExecutionTool = ['Edit', 'Write', 'Bash', 'NotebookEdit'].includes(toolName);
          const isExitPlanMode = toolName === 'ExitPlanMode';

          if (isExitPlanMode) {
          } else if (isExecutionTool) {
          } else {
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
        // Just clean up and exit - cancelBlock() already handled everything
        this.activeBlocks.delete(projectId);
        return;
      }


      const timeSeconds = ((Date.now() - activeBlock.operationStartTime) / 1000).toFixed(1);

      // Finalize any active thinking session
      if (activeBlock.thinkingStartTime) {
        // Get the last thinking message (the one currently active)
        const thinkingMessages = activeBlock.claudeMessages.filter(m => m.type === 'thinking');
        const activeThinking = thinkingMessages[thinkingMessages.length - 1];

        if (activeThinking && !activeThinking.thinkingDuration) {
          const duration = ((Date.now() - activeBlock.thinkingStartTime) / 1000).toFixed(0);
          activeThinking.thinkingDuration = parseInt(duration);
        }
        activeBlock.thinkingStartTime = null;
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
      } else {
        // Regular Claude response
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


    // Mark as interrupted BEFORE any completion logic
    activeBlock.isInterrupted = true;

    // Track this project as interrupted so claude-complete handler can check it
    this.interruptedBlocks.add(projectId);

    // Add interrupted message to the block
    activeBlock.claudeMessages.push({
      type: 'text',
      content: '⚠️ Stopped by user',
      timestamp: Date.now()
    });

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
