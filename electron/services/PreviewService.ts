import { BrowserView, BrowserWindow, shell } from 'electron';
import { EventEmitter } from 'events';

/**
 * Preview bounds interface
 */
export interface PreviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * PreviewService
 *
 * Manages BrowserView instances for previewing user's applications.
 * Handles creation, navigation, DevTools, and lifecycle management.
 */
class PreviewService extends EventEmitter {
  private browserViews: Map<string, BrowserView> = new Map();
  private devToolsOpen: Map<string, boolean> = new Map();
  private devToolsWindows: Map<string, BrowserWindow> = new Map(); // Track DevTools windows
  private mainWindow: BrowserWindow | null = null;
  private hiddenBounds: Map<string, PreviewBounds> = new Map(); // Store bounds when hidden
  private isHidden: Map<string, boolean> = new Map(); // Track visibility state
  private injectedCSSKeys: Map<string, string> = new Map(); // Track injected CSS keys for removal

  /**
   * Set the main window reference
   * @param window - Main BrowserWindow instance
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Create a new preview for a project
   * @param projectId - Unique project identifier
   * @param url - URL to load (e.g., http://localhost:8888)
   * @param bounds - Initial bounds for the BrowserView
   */
  createPreview(projectId: string, url: string, bounds: PreviewBounds): void {
    if (!this.mainWindow) {
      throw new Error('Main window not set. Call setMainWindow first.');
    }

    // Destroy existing preview if any
    this.destroyPreview(projectId);

    // Create BrowserView
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    // Set bounds
    view.setBounds(bounds);

    // Attach to main window
    this.mainWindow.setBrowserView(view);

    // Load URL
    view.webContents.loadURL(url);

    // Store reference
    this.browserViews.set(projectId, view);
    this.devToolsOpen.set(projectId, false);

    // CRITICAL FIX: Mark as NOT hidden when creating a new view
    // The view is created on-screen with real bounds, so it's visible
    this.isHidden.set(projectId, false);

    // Intercept keyboard shortcuts in BrowserView
    view.webContents.on('before-input-event', async (event, input) => {
      // Tab key - used for layout switching
      if (input.key === 'Tab' && input.type === 'keyDown') {
        event.preventDefault();
      }

      // For E and P keys, check if we're editing text first
      if ((input.key.toLowerCase() === 'e' || input.key.toLowerCase() === 'p') && input.type === 'keyDown' && !input.meta && !input.control && !input.alt) {
        try {
          // Check if any element is currently contentEditable
          const isEditing = await view.webContents.executeJavaScript(`
            (function() {
              const activeElement = document.activeElement;
              return activeElement && activeElement.isContentEditable;
            })();
          `);

          // If we're editing text, don't intercept the key
          if (isEditing) {
            return;
          }
        } catch (error) {
          // If executeJavaScript fails, assume we're not editing
          console.error('Failed to check contentEditable state:', error);
        }

        // Not editing, so intercept the key
        event.preventDefault();

        if (input.key.toLowerCase() === 'e') {
          this.mainWindow?.webContents.send('edit-mode-toggle-requested');
        } else if (input.key.toLowerCase() === 'p') {
          this.mainWindow?.webContents.send('screenshot-requested');
        }
      }
    });

    // Setup event handlers
    this.setupEventHandlers(projectId, view);

    this.emit('preview-created', projectId);
  }

  /**
   * Setup event handlers for BrowserView
   */
  private setupEventHandlers(projectId: string, view: BrowserView): void {
    const webContents = view.webContents;

    // Handle navigation
    webContents.on('will-navigate', (event, url) => {
      this.handleNavigation(event, url);
    });

    // Handle new window requests
    webContents.setWindowOpenHandler(({ url }) => {
      // Open external links in system browser
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle page load complete
    webContents.on('did-finish-load', () => {
      this.emit('preview-loaded', projectId);
    });

    // Handle page load error
    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      // Ignore aborted loads (user navigation)
      if (errorCode === -3) return;

      this.emit('preview-error', projectId, {
        errorCode,
        errorDescription,
        url: validatedURL,
      });
    });

    // Handle page crash
    webContents.on('render-process-gone', (event, details) => {
      this.emit('preview-crashed', projectId, details);
    });

    // Capture console messages
    webContents.on('console-message', (event, level, message, line, sourceId) => {
      this.emit('preview-console', projectId, {
        level,
        message,
        line,
        sourceId,
      });
    });
  }

  /**
   * Handle navigation events
   */
  private handleNavigation(event: Electron.Event, url: string): void {
    // Allow localhost navigation (SPA routing)
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return; // Allow
    }

    // Block and open external URLs in system browser
    event.preventDefault();
    shell.openExternal(url);
  }

  /**
   * Update preview bounds (on window resize, viewport change)
   * @param projectId - Unique project identifier
   * @param bounds - New bounds
   */
  updateBounds(projectId: string, bounds: PreviewBounds): void {
    const view = this.browserViews.get(projectId);
    if (!view) {
      return;
    }

    // Don't update bounds if view is hidden (off-screen)
    if (this.isHidden.get(projectId)) {
      return;
    }

    view.setBounds(bounds);
    this.emit('preview-bounds-updated', projectId, bounds);
  }

  /**
   * Refresh/reload the preview
   * @param projectId - Unique project identifier
   */
  refresh(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    view.webContents.reload();
    this.emit('preview-refreshed', projectId);
  }

  /**
   * Toggle DevTools for the preview
   * @param projectId - Unique project identifier
   * @param isMobile - Whether in mobile mode
   * @param layoutState - Current layout state (DEFAULT, BROWSER_FULL, TOOLS)
   */
  toggleDevTools(projectId: string, isMobile?: boolean, layoutState?: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    const isOpen = this.devToolsOpen.get(projectId) || false;

    if (isOpen) {
      // Close DevTools
      view.webContents.closeDevTools();
      this.devToolsOpen.set(projectId, false);

      // Clean up window reference
      const devToolsWindow = this.devToolsWindows.get(projectId);
      if (devToolsWindow && !devToolsWindow.isDestroyed()) {
        devToolsWindow.close();
      }
      this.devToolsWindows.delete(projectId);
    } else {
      // For mobile: detached window, for desktop: docked to right
      const devToolsMode = isMobile ? 'detach' : 'right';
      view.webContents.openDevTools({ mode: devToolsMode, activate: true });
      this.devToolsOpen.set(projectId, true);

      // Only position if mobile (detached mode)
      if (isMobile) {
        // Position the DevTools window after it opens
        view.webContents.once('devtools-opened', () => {
          // Get all windows to find the DevTools window
          const { BrowserWindow } = require('electron');
          const allWindows = BrowserWindow.getAllWindows();

          // The last window should be the DevTools window
          const devToolsWindow = allWindows[allWindows.length - 1];

          if (devToolsWindow && this.mainWindow) {
            this.devToolsWindows.set(projectId, devToolsWindow);

            // Get the current preview bounds
            const bounds = view.getBounds();
            const mainWindowBounds = this.mainWindow.getBounds();


            // Listen for when DevTools window is closed
            devToolsWindow.on('closed', () => {
              this.devToolsOpen.set(projectId, false);
              this.devToolsWindows.delete(projectId);
              this.emit('preview-devtools-toggled', projectId, false);
            });

            // Position DevTools to the right of the mobile frame
             if (layoutState === 'BROWSER_FULL') {
               const devToolsWidth = 600; // Width for BROWSER_FULL state
               const devToolsX = mainWindowBounds.x + bounds.x + bounds.width + 20; // 20px gap to the right
               const devToolsY = mainWindowBounds.y + bounds.y + 10; // 10px down from preview top
               const devToolsHeight = bounds.height; // Same height as preview
               devToolsWindow.setBounds({ x: devToolsX, y: devToolsY, width: devToolsWidth, height: devToolsHeight });
             } else { // DEFAULT state
               const devToolsWidth = 500; // Width for DEFAULT state
               const devToolsX = mainWindowBounds.x + bounds.x + bounds.width + 20; // 20px gap to the right
               const devToolsY = mainWindowBounds.y + bounds.y - 30; // 30px up from preview top
               const devToolsHeight = bounds.height; // Same height as preview
               devToolsWindow.setBounds({ x: devToolsX, y: devToolsY, width: devToolsWidth, height: devToolsHeight });
             }
          }
        });
      }
    }

    this.emit('preview-devtools-toggled', projectId, !isOpen);
  }

  /**
   * Navigate to a specific URL
   * @param projectId - Unique project identifier
   * @param url - URL to navigate to
   */
  navigateTo(projectId: string, url: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    view.webContents.loadURL(url);
  }

  /**
   * Destroy a preview
   * @param projectId - Unique project identifier
   */
  destroyPreview(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    // Close DevTools if open
    if (this.devToolsOpen.get(projectId)) {
      view.webContents.closeDevTools();

      // Close DevTools window
      const devToolsWindow = this.devToolsWindows.get(projectId);
      if (devToolsWindow && !devToolsWindow.isDestroyed()) {
        devToolsWindow.close();
      }
    }

    // Remove from window
    if (this.mainWindow) {
      this.mainWindow.removeBrowserView(view);
    }

    // Destroy view
    // @ts-ignore - destroy exists on BrowserView
    view.webContents.destroy();

    // Clean up
    this.browserViews.delete(projectId);
    this.devToolsOpen.delete(projectId);
    this.devToolsWindows.delete(projectId);
    this.isHidden.delete(projectId);
    this.hiddenBounds.delete(projectId);

    this.emit('preview-destroyed', projectId);
  }

  /**
   * Destroy all previews (on app quit)
   */
  destroyAll(): void {
    const projectIds = Array.from(this.browserViews.keys());
    projectIds.forEach((projectId) => this.destroyPreview(projectId));
  }

  /**
   * Get the current preview for a project
   * @param projectId - Unique project identifier
   */
  getPreview(projectId: string): BrowserView | undefined {
    return this.browserViews.get(projectId);
  }

  /**
   * Check if a preview exists for a project
   * @param projectId - Unique project identifier
   */
  hasPreview(projectId: string): boolean {
    return this.browserViews.has(projectId);
  }

  /**
   * Check if DevTools are open for a project
   * @param projectId - Unique project identifier
   */
  isDevToolsOpen(projectId: string): boolean {
    return this.devToolsOpen.get(projectId) || false;
  }

  /**
   * Reposition DevTools window (for mobile mode when layout changes)
   * @param projectId - Unique project identifier
   * @param layoutState - New layout state
   */
  repositionDevTools(projectId: string, layoutState: string): void {
    const devToolsWindow = this.devToolsWindows.get(projectId);
    const view = this.browserViews.get(projectId);

    if (!devToolsWindow || devToolsWindow.isDestroyed() || !view || !this.mainWindow) {
      return;
    }

    const bounds = view.getBounds();
    const mainWindowBounds = this.mainWindow.getBounds();


    // TODO: Uncomment and adjust based on layoutState
    // if (layoutState === 'BROWSER_FULL') {
    //   const devToolsWidth = ???;
    //   const devToolsX = ???;
    //   const devToolsY = ???;
    //   const devToolsHeight = ???;
    //   devToolsWindow.setBounds({ x: devToolsX, y: devToolsY, width: devToolsWidth, height: devToolsHeight });
    // } else { // DEFAULT
    //   const devToolsWidth = ???;
    //   const devToolsX = ???;
    //   const devToolsY = ???;
    //   const devToolsHeight = ???;
    //   devToolsWindow.setBounds({ x: devToolsX, y: devToolsY, width: devToolsWidth, height: devToolsHeight });
    // }
  }

  /**
   * Hide a preview (move off-screen to avoid z-index issues with modals)
   * @param projectId - Unique project identifier
   */
  hide(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view || this.isHidden.get(projectId)) return;

    // Store current bounds
    const currentBounds = view.getBounds();
    this.hiddenBounds.set(projectId, currentBounds);

    // Move off-screen (far to the right)
    view.setBounds({
      x: 99999,
      y: 99999,
      width: currentBounds.width,
      height: currentBounds.height
    });

    this.isHidden.set(projectId, true);
    this.emit('preview-hidden', projectId);
  }

  /**
   * Show a previously hidden preview
   * @param projectId - Unique project identifier
   */
  show(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    // CRITICAL FIX: Always set as active BrowserView when showing
    // Even if not hidden, we need to ensure this view is the active one
    if (this.mainWindow) {
      this.mainWindow.setBrowserView(view);
    }

    // If already visible, we're done
    if (!this.isHidden.get(projectId)) {
      this.emit('preview-shown', projectId);
      return;
    }

    // Restore previous bounds if available
    const previousBounds = this.hiddenBounds.get(projectId);

    // Mark as visible BEFORE setting bounds (so updateBounds doesn't skip)
    this.isHidden.set(projectId, false);
    this.hiddenBounds.delete(projectId);

    if (previousBounds) {
      view.setBounds(previousBounds);
    }

    this.emit('preview-shown', projectId);
  }

  /**
   * Check if a preview is currently hidden
   * @param projectId - Unique project identifier
   */
  isPreviewHidden(projectId: string): boolean {
    return this.isHidden.get(projectId) || false;
  }

  /**
   * Enable device emulation (mobile view)
   * @param projectId - Unique project identifier
   * @param deviceName - Device name (matches display names from frontend)
   */
  enableDeviceEmulation(projectId: string, deviceName: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    // Map device names to metrics (supports various device names)
    const deviceMetrics: Record<string, { width: number; height: number; deviceScaleFactor: number; mobile: boolean }> = {
      // iPhone devices
      'iPhone SE': { width: 375, height: 667, deviceScaleFactor: 2, mobile: true },
      'iPhone 14 Pro': { width: 393, height: 852, deviceScaleFactor: 3, mobile: true },
      'iPhone 14 Pro Max': { width: 430, height: 932, deviceScaleFactor: 3, mobile: true },
      'iPhone 16': { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
      'iPhone 16 Pro': { width: 393, height: 852, deviceScaleFactor: 3, mobile: true },

      // Android devices
      'Pixel 7': { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
      'Google Pixel 8 Pro': { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
      'Samsung Galaxy S23': { width: 360, height: 780, deviceScaleFactor: 3, mobile: true },
      'Samsung Galaxy S22': { width: 360, height: 800, deviceScaleFactor: 3, mobile: true },
      'Samsung S24 Ultra': { width: 384, height: 824, deviceScaleFactor: 3, mobile: true },

      // Tablets
      'iPad Air': { width: 820, height: 1180, deviceScaleFactor: 2, mobile: true },
      'iPad Pro': { width: 1024, height: 1366, deviceScaleFactor: 2, mobile: true },
    };

    const metrics = deviceMetrics[deviceName];
    if (metrics) {
      view.webContents.enableDeviceEmulation({
        screenPosition: 'mobile',
        screenSize: { width: metrics.width, height: metrics.height },
        viewSize: { width: metrics.width, height: metrics.height },
        viewPosition: { x: 0, y: 0 },
        deviceScaleFactor: metrics.deviceScaleFactor,
        scale: 1,
      });
    } else {
      console.warn(`⚠️ Unknown device: ${deviceName}, device emulation not enabled`);
    }
  }

  /**
   * Disable device emulation (back to desktop view)
   * @param projectId - Unique project identifier
   */
  disableDeviceEmulation(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    view.webContents.disableDeviceEmulation();
  }

  /**
   * Inject CSS into the preview BrowserView
   * @param projectId - Unique project identifier
   * @param css - CSS string to inject
   */
  async injectCSS(projectId: string, css: string): Promise<void> {
    const view = this.browserViews.get(projectId);
    if (!view) {
      throw new Error(`Preview not found for project: ${projectId}`);
    }

    try {
      // Remove previously injected CSS if exists
      await this.removeCSS(projectId);

      // Insert new CSS and store the key
      const key = await view.webContents.insertCSS(css);
      this.injectedCSSKeys.set(projectId, key);
    } catch (error) {
      console.error(`❌ [PreviewService] Failed to inject CSS:`, error);
      throw error;
    }
  }

  /**
   * Remove injected CSS from the preview BrowserView
   * @param projectId - Unique project identifier
   */
  async removeCSS(projectId: string): Promise<void> {
    const view = this.browserViews.get(projectId);
    const cssKey = this.injectedCSSKeys.get(projectId);

    if (!view || !cssKey) {
      return; // Nothing to remove
    }

    try {
      await view.webContents.removeInsertedCSS(cssKey);
      this.injectedCSSKeys.delete(projectId);
    } catch (error) {
      console.error(`❌ [PreviewService] Failed to remove CSS:`, error);
      throw error;
    }
  }

  /**
   * Wait for preview to be created (with timeout)
   * @param projectId - Unique project identifier
   * @param timeoutMs - Maximum time to wait in milliseconds
   */
  async waitForPreview(projectId: string, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      if (this.hasPreview(projectId)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  /**
   * Execute JavaScript in the preview BrowserView
   * @param projectId - Unique project identifier
   * @param code - JavaScript code to execute
   */
  async executeJavaScript(projectId: string, code: string): Promise<any> {
    const view = this.browserViews.get(projectId);
    if (!view) {
      throw new Error(`Preview not found for project: ${projectId}`);
    }

    try {
      const result = await view.webContents.executeJavaScript(code);
      return result;
    } catch (error) {
      console.error(`❌ [PreviewService] Failed to execute JavaScript:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const previewService = new PreviewService();
