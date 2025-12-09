import { WebContentsView, BrowserWindow, shell } from 'electron';
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
 * Manages WebContentsView instances for previewing user's applications.
 * Migrated from BrowserView (deprecated) to WebContentsView for proper z-index control.
 * Handles creation, navigation, DevTools, and lifecycle management.
 */
class PreviewService extends EventEmitter {
  private webContentsViews: Map<string, WebContentsView> = new Map();
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
   * @param bounds - Initial bounds for the WebContentsView
   */
  createPreview(projectId: string, url: string, bounds: PreviewBounds): void {
    if (!this.mainWindow) {
      throw new Error('Main window not set. Call setMainWindow first.');
    }

    // Destroy existing preview if any
    this.destroyPreview(projectId);

    // Create WebContentsView (replaces deprecated BrowserView)
    const view = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    // WebContentsView has white background by default, set transparent if needed
    view.setBackgroundColor('#FFFFFF');

    // Set bounds
    view.setBounds(bounds);

    // Attach to main window using contentView (WebContentsView API)
    this.mainWindow.contentView.addChildView(view);

    // Load URL
    view.webContents.loadURL(url);

    // Store reference
    this.webContentsViews.set(projectId, view);
    this.devToolsOpen.set(projectId, false);

    // Mark as NOT hidden when creating a new view
    this.isHidden.set(projectId, false);

    // Intercept keyboard shortcuts in WebContentsView
    view.webContents.on('before-input-event', async (event, input) => {
      // Only process keyDown events
      if (input.type !== 'keyDown') return;

      // Helper function to check if user is typing in a form field
      const isUserTyping = async (): Promise<boolean> => {
        try {
          return await view.webContents.executeJavaScript(`
            (function() {
              const el = document.activeElement;
              if (!el) return false;
              const tagName = el.tagName.toLowerCase();
              // Check for input, textarea, select, or contentEditable
              if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
                return true;
              }
              if (el.isContentEditable) {
                return true;
              }
              return false;
            })();
          `);
        } catch (error) {
          // If executeJavaScript fails, assume NOT editing (allow hotkeys)
          return false;
        }
      };

      // Shift+Tab - used for layout switching (cycle between Browser and Workspace)
      if (input.key === 'Tab' && input.shift && !input.meta && !input.control && !input.alt) {
        // Always allow Shift+Tab hotkey even when typing (it's not a character key)
        event.preventDefault();
        this.mainWindow?.webContents.send('layout-cycle-requested');
        return;
      }

      // For character keys, check if user is typing first
      const charKeys = ['g', 'e', 's', 'p'];
      if (charKeys.includes(input.key.toLowerCase()) && !input.meta && !input.control && !input.alt) {
        // Check if user is typing in a form field
        const typing = await isUserTyping();
        if (typing) {
          // User is typing, don't intercept
          return;
        }

        // Not typing, intercept the hotkey
        event.preventDefault();

        if (input.key.toLowerCase() === 'g') {
          this.mainWindow?.webContents.send('github-sheet-toggle-requested');
        } else if (input.key.toLowerCase() === 'e') {
          this.mainWindow?.webContents.send('edit-mode-toggle-requested');
        } else if (input.key.toLowerCase() === 's') {
          this.mainWindow?.webContents.send('select-mode-toggle-requested');
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
   * Setup event handlers for WebContentsView
   */
  private setupEventHandlers(projectId: string, view: WebContentsView): void {
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
    webContents.on('console-message', ({ level, message, lineNumber, sourceId }) => {
      this.emit('preview-console', projectId, {
        level,
        message,
        line: lineNumber,
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
    const view = this.webContentsViews.get(projectId);
    if (!view) {
      return;
    }

    // Don't update bounds if view is hidden
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
    const view = this.webContentsViews.get(projectId);
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
    const view = this.webContentsViews.get(projectId);
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
    const view = this.webContentsViews.get(projectId);
    if (!view) return;

    view.webContents.loadURL(url);
  }

  /**
   * Destroy a preview
   * @param projectId - Unique project identifier
   */
  destroyPreview(projectId: string): void {
    const view = this.webContentsViews.get(projectId);
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

    // Remove from window using WebContentsView API
    if (this.mainWindow) {
      this.mainWindow.contentView.removeChildView(view);
    }

    // Close view's webContents
    view.webContents.close();

    // Clean up
    this.webContentsViews.delete(projectId);
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
    const projectIds = Array.from(this.webContentsViews.keys());
    projectIds.forEach((projectId) => this.destroyPreview(projectId));
  }

  /**
   * Get the current preview for a project
   * @param projectId - Unique project identifier
   */
  getPreview(projectId: string): WebContentsView | undefined {
    return this.webContentsViews.get(projectId);
  }

  /**
   * Check if a preview exists for a project
   * @param projectId - Unique project identifier
   */
  hasPreview(projectId: string): boolean {
    return this.webContentsViews.has(projectId);
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
    const view = this.webContentsViews.get(projectId);

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
   * Hide a preview by removing from view hierarchy
   * With WebContentsView we can properly remove/add views for z-index control
   * @param projectId - Unique project identifier
   */
  hide(projectId: string): void {
    const view = this.webContentsViews.get(projectId);
    if (!view || this.isHidden.get(projectId)) return;

    // Store current bounds for restoration
    const currentBounds = view.getBounds();
    this.hiddenBounds.set(projectId, currentBounds);

    // Remove from view hierarchy (proper z-index control with WebContentsView!)
    if (this.mainWindow) {
      this.mainWindow.contentView.removeChildView(view);
    }

    // Throttle the hidden WebContents to save CPU/GPU
    view.webContents.setBackgroundThrottling(true);
    view.webContents.setFrameRate(1); // Minimal frame rate when hidden

    // Transfer focus back to main window so keyboard events work
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.focus();
    }

    this.isHidden.set(projectId, true);
    this.emit('preview-hidden', projectId);
  }

  /**
   * Show a previously hidden preview by adding back to view hierarchy
   * @param projectId - Unique project identifier
   */
  show(projectId: string): void {
    const view = this.webContentsViews.get(projectId);
    if (!view) return;

    // Restore normal frame rate before showing
    view.webContents.setFrameRate(60); // Normal frame rate
    view.webContents.setBackgroundThrottling(false);

    // Add view back to hierarchy (at index 0 to be behind other views like modals)
    // With WebContentsView, addChildView brings to top by default
    if (this.mainWindow) {
      // Add at index 0 so it's at the bottom of the z-stack
      this.mainWindow.contentView.addChildView(view, 0);
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
    const view = this.webContentsViews.get(projectId);
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
    const view = this.webContentsViews.get(projectId);
    if (!view) return;

    view.webContents.disableDeviceEmulation();
  }

  /**
   * Inject CSS into the preview WebContentsView
   * @param projectId - Unique project identifier
   * @param css - CSS string to inject
   */
  async injectCSS(projectId: string, css: string): Promise<void> {
    const view = this.webContentsViews.get(projectId);
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
   * Remove injected CSS from the preview WebContentsView
   * @param projectId - Unique project identifier
   */
  async removeCSS(projectId: string): Promise<void> {
    const view = this.webContentsViews.get(projectId);
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
   * Execute JavaScript in the preview WebContentsView
   * @param projectId - Unique project identifier
   * @param code - JavaScript code to execute
   */
  async executeJavaScript(projectId: string, code: string): Promise<any> {
    const view = this.webContentsViews.get(projectId);
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

  /**
   * Bring a preview to top of z-stack (for proper layering)
   * @param projectId - Unique project identifier
   */
  bringToTop(projectId: string): void {
    const view = this.webContentsViews.get(projectId);
    if (!view || !this.mainWindow) return;

    // Re-adding the view moves it to the top of the z-stack
    this.mainWindow.contentView.addChildView(view);
  }

  /**
   * Send preview to back of z-stack (behind other views)
   * @param projectId - Unique project identifier
   */
  sendToBack(projectId: string): void {
    const view = this.webContentsViews.get(projectId);
    if (!view || !this.mainWindow) return;

    // Add at index 0 to put at bottom of z-stack
    this.mainWindow.contentView.addChildView(view, 0);
  }
}

// Export singleton instance
export const previewService = new PreviewService();
