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
  ipcMain.handle('preview:toggle-devtools', async (_event, projectId: string, isMobile?: boolean, layoutState?: string) => {
    try {
      previewService.toggleDevTools(projectId, isMobile, layoutState);

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

  // Hide preview
  ipcMain.handle('preview:hide', async (_event, projectId: string) => {
    try {
      previewService.hide(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error hiding preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to hide preview',
      };
    }
  });

  // Show preview
  ipcMain.handle('preview:show', async (_event, projectId: string) => {
    try {
      previewService.show(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error showing preview:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to show preview',
      };
    }
  });

  // Enable device emulation
  ipcMain.handle('preview:enable-device-emulation', async (_event, projectId: string, device: string) => {
    try {
      previewService.enableDeviceEmulation(projectId, device as any);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error enabling device emulation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable device emulation',
      };
    }
  });

  // Disable device emulation
  ipcMain.handle('preview:disable-device-emulation', async (_event, projectId: string) => {
    try {
      previewService.disableDeviceEmulation(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error disabling device emulation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable device emulation',
      };
    }
  });

  // Inject CSS
  ipcMain.handle('preview:inject-css', async (_event, projectId: string, css: string) => {
    try {
      await previewService.injectCSS(projectId, css);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error injecting CSS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inject CSS',
      };
    }
  });

  // Remove CSS
  ipcMain.handle('preview:remove-css', async (_event, projectId: string) => {
    try {
      await previewService.removeCSS(projectId);

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Error removing CSS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove CSS',
      };
    }
  });

  // Execute JavaScript
  ipcMain.handle('preview:execute-javascript', async (_event, projectId: string, code: string) => {
    try {
      const result = await previewService.executeJavaScript(projectId, code);

      return {
        success: true,
        result,
      };
    } catch (error) {
      console.error('❌ Error executing JavaScript:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute JavaScript',
      };
    }
  });

  // Check if preview exists
  ipcMain.handle('preview:has-preview', async (_event, projectId: string) => {
    try {
      const exists = previewService.hasPreview(projectId);

      return {
        success: true,
        exists,
      };
    } catch (error) {
      console.error('❌ Error checking preview existence:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to check preview',
      };
    }
  });

  // Wait for preview to be created
  ipcMain.handle('preview:wait-for-preview', async (_event, projectId: string, timeoutMs?: number) => {
    try {
      const exists = await previewService.waitForPreview(projectId, timeoutMs);

      return {
        success: true,
        exists,
      };
    } catch (error) {
      console.error('❌ Error waiting for preview:', error);
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to wait for preview',
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
