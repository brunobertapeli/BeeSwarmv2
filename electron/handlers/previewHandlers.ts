import { ipcMain, WebContents } from 'electron';
import { previewService, PreviewBounds } from '../services/PreviewService';

let mainWindowContents: WebContents | null = null;

/**
 * Set the main window web contents for event emission
 */
export function setPreviewHandlersWindow(webContents: WebContents): void {
  mainWindowContents = webContents;
}

/**
 * Register preview-related IPC handlers
 */
export function registerPreviewHandlers(): void {
  // Create preview
  ipcMain.handle(
    'preview:create',
    async (_event, projectId: string, url: string, bounds: PreviewBounds) => {
      try {
        console.log(`🖼️  Creating preview for project: ${projectId} at ${url}`);
        previewService.createPreview(projectId, url, bounds);

        return {
          success: true,
        };
      } catch (error) {
        console.error('❌ Error creating preview:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create preview',
        };
      }
    }
  );

  // Update preview bounds
  ipcMain.handle(
    'preview:update-bounds',
    async (_event, projectId: string, bounds: PreviewBounds) => {
      try {
        previewService.updateBounds(projectId, bounds);

        return {
          success: true,
        };
      } catch (error) {
        console.error('❌ Error updating preview bounds:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update preview bounds',
        };
      }
    }
  );

  // Refresh preview
  ipcMain.handle('preview:refresh', async (_event, projectId: string) => {
    try {
      console.log(`🔄 Refreshing preview for project: ${projectId}`);
      previewService.refresh(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error refreshing preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh preview',
      };
    }
  });

  // Toggle DevTools
  ipcMain.handle('preview:toggle-devtools', async (_event, projectId: string) => {
    try {
      console.log(`🔧 Toggling DevTools for project: ${projectId}`);
      previewService.toggleDevTools(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error toggling DevTools:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to toggle DevTools',
      };
    }
  });

  // Navigate to URL
  ipcMain.handle('preview:navigate', async (_event, projectId: string, url: string) => {
    try {
      console.log(`🧭 Navigating preview to: ${url}`);
      previewService.navigateTo(projectId, url);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error navigating preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to navigate preview',
      };
    }
  });

  // Destroy preview
  ipcMain.handle('preview:destroy', async (_event, projectId: string) => {
    try {
      console.log(`🗑️  Destroying preview for project: ${projectId}`);
      previewService.destroyPreview(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error destroying preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to destroy preview',
      };
    }
  });

  // Setup event listeners to forward to renderer
  setupPreviewEventForwarding();
}

/**
 * Setup event forwarding from PreviewService to renderer
 */
function setupPreviewEventForwarding(): void {
  // Preview created
  previewService.on('preview-created', (projectId: string) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-created', projectId);
    }
  });

  // Preview loaded
  previewService.on('preview-loaded', (projectId: string) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-loaded', projectId);
    }
  });

  // Preview error
  previewService.on('preview-error', (projectId: string, error: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-error', projectId, error);
    }
  });

  // Preview crashed
  previewService.on('preview-crashed', (projectId: string, details: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-crashed', projectId, details);
    }
  });

  // Preview console message
  previewService.on('preview-console', (projectId: string, message: any) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-console', projectId, message);
    }
  });

  // DevTools toggled
  previewService.on('preview-devtools-toggled', (projectId: string, isOpen: boolean) => {
    if (mainWindowContents && !mainWindowContents.isDestroyed()) {
      mainWindowContents.send('preview-devtools-toggled', projectId, isOpen);
    }
  });
}
