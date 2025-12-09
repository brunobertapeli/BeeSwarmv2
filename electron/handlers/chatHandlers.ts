import { ipcMain, WebContents } from 'electron';
import { databaseService, ChatBlock } from '../services/DatabaseService';
import { chatHistoryManager } from '../services/ChatHistoryManager';
import { getCurrentUserId } from '../main';
import { validateProjectOwnership, UnauthorizedError } from '../middleware/authMiddleware';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setChatHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Emit chat event to renderer
 */
export function emitChatEvent(event: string, ...args: any[]): void {
  if (mainWindowContents && !mainWindowContents.isDestroyed()) {
    mainWindowContents.send(event, ...args);
  }
}

/**
 * Register chat-related IPC handlers
 */
export function registerChatHandlers(): void {
  // Create new chat block
  ipcMain.handle('chat:create-block', async (_event, projectId: string, userPrompt: string, interactionType?: string | null) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      // Infer interaction type from prompt if not provided
      let type = interactionType;
      if (!type) {
        if (userPrompt.startsWith('Here are my answers to your questions')) {
          type = 'answers';
        } else if (userPrompt === 'I approve this plan. Please proceed with the implementation.') {
          type = 'plan_approval';
        } else if (userPrompt.startsWith('Restore to checkpoint')) {
          type = 'checkpoint_restore';
        } else {
          type = 'user_message';
        }
      }

      const block = databaseService.createChatBlock(projectId, userPrompt, type);

      // Start tracking this block in ChatHistoryManager
      chatHistoryManager.startBlock(projectId, block.id);

      // Emit event to renderer
      emitChatEvent('chat:block-created', projectId, block);

      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('❌ Error creating chat block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat block',
      };
    }
  });

  // Update chat block
  ipcMain.handle('chat:update-block', async (_event, blockId: string, updates: Partial<ChatBlock>) => {
    try {
      // SECURITY: Get block and validate user owns the project
      const existingBlock = databaseService.getChatBlock(blockId);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Block not found'
        };
      }
      validateProjectOwnership(existingBlock.projectId);

      databaseService.updateChatBlock(blockId, updates);

      // Get updated block
      const block = databaseService.getChatBlock(blockId);

      // Emit event to renderer
      if (block) {
        emitChatEvent('chat:block-updated', block.projectId, block);
      }

      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('❌ Error updating chat block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update chat block',
      };
    }
  });

  // Complete chat block
  ipcMain.handle('chat:complete-block', async (_event, blockId: string) => {
    try {
      // SECURITY: Get block and validate user owns the project
      const existingBlock = databaseService.getChatBlock(blockId);
      if (!existingBlock) {
        return {
          success: false,
          error: 'Block not found'
        };
      }
      validateProjectOwnership(existingBlock.projectId);

      databaseService.completeChatBlock(blockId);

      // Get completed block
      const block = databaseService.getChatBlock(blockId);

      // Emit event to renderer
      if (block) {
        emitChatEvent('chat:block-completed', block.projectId, block);
      }

      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('❌ Error completing chat block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete chat block',
      };
    }
  });

  // Get chat history
  ipcMain.handle('chat:get-history', async (_event, projectId: string, limit?: number, offset?: number) => {
    try {
      // Try to validate project ownership
      try {
        // Use silent mode since we expect this to fail for deleted projects
        validateProjectOwnership(projectId, true);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          // Project not found or unauthorized - return empty history (graceful degradation)
          return {
            success: true,
            blocks: [],
          };
        }
        throw error;
      }

      const blocks = databaseService.getChatHistory(projectId, limit, offset);

      return {
        success: true,
        blocks,
      };
    } catch (error) {
      console.error('❌ Error getting chat history:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat history',
      };
    }
  });

  // Get specific chat block
  ipcMain.handle('chat:get-block', async (_event, blockId: string) => {
    try {
      // SECURITY: Get block and validate user owns the project
      const block = databaseService.getChatBlock(blockId);
      if (!block) {
        return {
          success: false,
          error: 'Block not found'
        };
      }
      validateProjectOwnership(block.projectId);

      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('❌ Error getting chat block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat block',
      };
    }
  });

  // Delete chat history for project
  ipcMain.handle('chat:delete-history', async (_event, projectId: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      databaseService.deleteChatHistory(projectId);

      // Emit event to renderer
      emitChatEvent('chat:history-deleted', projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error deleting chat history:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete chat history',
      };
    }
  });

  // Create initialization block
  ipcMain.handle('chat:create-initialization-block', async (_event, projectId: string, templateName: string, stages: Array<{ label: string; isComplete: boolean }>, sourceProjectName?: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      // Create a special block with initialization data
      // Store stages as JSON in the 'actions' field (we can reuse this for initialization stages)
      const blockPrompt = sourceProjectName
        ? `Forking project from: ${sourceProjectName}`
        : `Initializing project with template: ${templateName}`;

      const block = databaseService.createChatBlock(
        projectId,
        blockPrompt,
        'initialization'
      );

      // Store stages in a custom format (include sourceProjectName for fork display)
      const initData = {
        type: 'initialization',
        templateName,
        stages,
        ...(sourceProjectName && { sourceProjectName })
      };

      databaseService.updateChatBlock(block.id, {
        actions: JSON.stringify(initData)
      });

      // Get updated block
      const updatedBlock = databaseService.getChatBlock(block.id);

      // Emit event to renderer
      if (updatedBlock) {
        emitChatEvent('chat:block-created', projectId, updatedBlock);
      }

      return {
        success: true,
        blockId: block.id,
      };
    } catch (error) {
      console.error('❌ Error creating initialization block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create initialization block',
      };
    }
  });

  // Update initialization block
  ipcMain.handle('chat:update-initialization-block', async (_event, projectId: string, stages: Array<{ label: string; isComplete: boolean }>, isComplete: boolean, commitHash?: string) => {
    try {
      // SECURITY: Validate user owns this project
      validateProjectOwnership(projectId);

      // Find the initialization block for this project (most recent one)
      const blocks = databaseService.getChatHistory(projectId, 1, 0);
      const initBlock = blocks.find(b => {
        try {
          const actions = b.actions ? JSON.parse(b.actions) : null;
          return actions && actions.type === 'initialization';
        } catch {
          return false;
        }
      });

      if (!initBlock) {
        return {
          success: false,
          error: 'Initialization block not found'
        };
      }

      // Parse existing init data
      const existingData = JSON.parse(initBlock.actions || '{}');

      // Update stages
      const updatedData = {
        ...existingData,
        stages
      };

      // Build update object with optional commitHash
      const updateData: { actions: string; isComplete: boolean; commitHash?: string } = {
        actions: JSON.stringify(updatedData),
        isComplete
      };

      // Add commit hash if provided (for restore functionality)
      if (commitHash) {
        updateData.commitHash = commitHash;
      }

      databaseService.updateChatBlock(initBlock.id, updateData);

      // If complete, mark as completed
      if (isComplete) {
        databaseService.completeChatBlock(initBlock.id);
      }

      // Get updated block
      const updatedBlock = databaseService.getChatBlock(initBlock.id);

      // Emit appropriate event to renderer
      if (updatedBlock) {
        if (isComplete) {
          emitChatEvent('chat:block-completed', projectId, updatedBlock);
        } else {
          emitChatEvent('chat:block-updated', projectId, updatedBlock);
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error updating initialization block:', error);

      if (error instanceof UnauthorizedError) {
        return {
          success: false,
          error: 'Unauthorized'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update initialization block',
      };
    }
  });
}
