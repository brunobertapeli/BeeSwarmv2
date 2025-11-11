import { ipcMain, WebContents } from 'electron';
import { layoutManager, LayoutState } from '../services/LayoutManager.js';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setLayoutHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register layout-related IPC handlers
 */
export function registerLayoutHandlers(): void {
  // Set layout state
  ipcMain.handle(
    'layout:set-state',
    async (_event, state: LayoutState, projectId: string) => {
      try {
        await layoutManager.setState(state, projectId);

        return {
          success: true,
        };
      } catch (error) {
        console.error('❌ Error setting layout state:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set layout state',
        };
      }
    }
  );

  // Cycle layout state (for Tab key)
  ipcMain.handle('layout:cycle-state', async (_event, projectId: string) => {
    try {
      await layoutManager.cycleState(projectId);

      return {
        success: true,
        newState: layoutManager.getState(),
      };
    } catch (error) {
      console.error('❌ Error cycling layout state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cycle layout state',
      };
    }
  });

  // Get current state
  ipcMain.handle('layout:get-state', async () => {
    try {
      return {
        success: true,
        state: layoutManager.getState(),
      };
    } catch (error) {
      console.error('❌ Error getting layout state:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get layout state',
      };
    }
  });

  // Set ActionBar height
  ipcMain.handle('layout:set-actionbar-height', async (_event, height: number) => {
    try {
      layoutManager.setActionBarHeight(height);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error setting ActionBar height:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set ActionBar height',
      };
    }
  });

  // Set view mode (desktop/mobile)
  ipcMain.handle('layout:set-view-mode', async (_event, viewMode: 'desktop' | 'mobile') => {
    try {
      layoutManager.setViewMode(viewMode);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error setting view mode:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set view mode',
      };
    }
  });

  // Capture for modal freeze
  ipcMain.handle('layout:capture-modal-freeze', async (_event, projectId: string) => {
    try {
      const freezeImage = await layoutManager.captureForModalFreeze(projectId);

      return {
        success: true,
        freezeImage,
      };
    } catch (error) {
      console.error('❌ Error capturing modal freeze:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture modal freeze',
      };
    }
  });

  // Get cached modal freeze
  ipcMain.handle('layout:get-cached-modal-freeze', async (_event, projectId: string) => {
    try {
      const freezeImage = layoutManager.getCachedModalFreeze(projectId);

      return {
        success: true,
        freezeImage,
      };
    } catch (error) {
      console.error('❌ Error getting cached modal freeze:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cached modal freeze',
      };
    }
  });

  // Clear modal freeze cache
  ipcMain.handle('layout:clear-modal-freeze-cache', async (_event, projectId: string) => {
    try {
      layoutManager.clearModalFreezeCache(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error clearing modal freeze cache:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear modal freeze cache',
      };
    }
  });

  // Setup event listeners to forward to renderer
  setupLayoutEventForwarding();
}

/**
 * Setup event forwarding from LayoutManager to renderer
 */
function setupLayoutEventForwarding(): void {
  // State changed
  layoutManager.on('state-changed', (newState: LayoutState, previousState: LayoutState) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('layout-state-changed', newState, previousState);
    }
  });

  // ActionBar height changed
  layoutManager.on('actionbar-height-changed', (height: number) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('layout-actionbar-height-changed', height);
    }
  });
}
