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
 * Active chat block being tracked
 */
interface ActiveBlock {
  blockId: string;
  projectId: string;
  claudeMessages: string[]; // Claude's text messages
  toolExecutions: ToolExecution[];
  commitHash: string | null;
  filesChanged: number | null;
  operationStartTime: number; // When Claude started working
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

    this.activeBlocks.set(projectId, {
      blockId,
      projectId,
      claudeMessages: [],
      toolExecutions: [],
      commitHash: null,
      filesChanged: null,
      operationStartTime: Date.now(),
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
          activeBlock.claudeMessages.push(block.text);
        }

        // Track tool executions with details
        if (block.type === 'tool_use') {
          const toolExecution: ToolExecution = {
            toolName: block.name,
            toolId: block.id,
            startTime: Date.now(),
          };

          // Extract file path for Read, Write, Edit tools
          if (block.input && (block.name === 'Read' || block.name === 'Write' || block.name === 'Edit')) {
            toolExecution.filePath = block.input.file_path || block.input.path;
          }

          // Extract command for Bash tool
          if (block.input && block.name === 'Bash') {
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
      console.log(`💬 Completing block: ${activeBlock.blockId}`);

      const timeSeconds = ((Date.now() - activeBlock.operationStartTime) / 1000).toFixed(1);

      // Extract completion stats
      const completionStats = {
        timeSeconds: parseFloat(timeSeconds),
        inputTokens: msg?.usage?.input_tokens || 0,
        outputTokens: msg?.usage?.output_tokens || 0,
        cost: msg?.total_cost_usd || 0,
      };

      // Extract summary from last Claude message if it looks like a summary
      let summary: string | null = null;
      const lastMessage = activeBlock.claudeMessages[activeBlock.claudeMessages.length - 1];
      if (lastMessage && (lastMessage.includes('## Summary') || lastMessage.includes('### Summary'))) {
        summary = lastMessage;
      }

      // Update block with final data and mark complete
      databaseService.updateChatBlock(activeBlock.blockId, {
        completionStats: JSON.stringify(completionStats),
        summary: summary,
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
    type: 'git_commit' | 'build' | 'dev_server'
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

    // Get current block to find last action index
    const block = databaseService.getChatBlock(blockId);
    if (!block || !block.actions) {
      return;
    }

    try {
      const actions = JSON.parse(block.actions);
      const lastActionIndex = actions.length - 1;

      if (lastActionIndex >= 0) {
        databaseService.updateAction(blockId, lastActionIndex, updates);

        // Emit update event
        const updatedBlock = databaseService.getChatBlock(blockId);
        if (updatedBlock) {
          emitChatEvent('chat:block-updated', projectId, updatedBlock);
        }
      }
    } catch (e) {
      console.error('Failed to update action:', e);
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
   * Cancel/abort active block
   */
  cancelBlock(projectId: string): void {
    const activeBlock = this.activeBlocks.get(projectId);

    if (!activeBlock) {
      return;
    }

    console.log(`💬 Canceling block: ${activeBlock.blockId}`);

    // Mark as complete (even though it was canceled)
    databaseService.completeChatBlock(activeBlock.blockId);

    // Emit completion event
    const completedBlock = databaseService.getChatBlock(activeBlock.blockId);
    if (completedBlock) {
      emitChatEvent('chat:block-completed', projectId, completedBlock);
    }

    // Remove from active blocks
    this.activeBlocks.delete(projectId);
  }
}

// Export singleton instance
export const chatHistoryManager = new ChatHistoryManager();
