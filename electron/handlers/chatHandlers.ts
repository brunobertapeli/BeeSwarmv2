import { ipcMain, WebContents } from 'electron';
import { databaseService, ChatBlock } from '../services/DatabaseService';
import { chatHistoryManager } from '../services/ChatHistoryManager';
import { getCurrentUserId } from '../main';

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
  ipcMain.handle('chat:create-block', async (_event, projectId: string, userPrompt: string) => {
    try {
      console.log(`💬 Creating chat block for project: ${projectId}`);

      const block = databaseService.createChatBlock(projectId, userPrompt);

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create chat block',
      };
    }
  });

  // Update chat block
  ipcMain.handle('chat:update-block', async (_event, blockId: string, updates: Partial<ChatBlock>) => {
    try {
      console.log(`💬 Updating chat block: ${blockId}`);

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update chat block',
      };
    }
  });

  // Complete chat block
  ipcMain.handle('chat:complete-block', async (_event, blockId: string) => {
    try {
      console.log(`💬 Completing chat block: ${blockId}`);

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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete chat block',
      };
    }
  });

  // Get chat history
  ipcMain.handle('chat:get-history', async (_event, projectId: string, limit?: number, offset?: number) => {
    try {
      // Check if user is logged in
      const userId = getCurrentUserId()
      if (!userId) {
        return {
          success: true,
          blocks: [],
        };
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
      const block = databaseService.getChatBlock(blockId);

      return {
        success: true,
        block,
      };
    } catch (error) {
      console.error('❌ Error getting chat block:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get chat block',
      };
    }
  });

  // Delete chat history for project
  ipcMain.handle('chat:delete-history', async (_event, projectId: string) => {
    try {
      console.log(`💬 Deleting chat history for project: ${projectId}`);

      databaseService.deleteChatHistory(projectId);

      // Emit event to renderer
      emitChatEvent('chat:history-deleted', projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error deleting chat history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete chat history',
      };
    }
  });
}
