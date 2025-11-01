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
  private mainWindow: BrowserWindow | null = null;

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
    if (!view) return;

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
   */
  toggleDevTools(projectId: string): void {
    const view = this.browserViews.get(projectId);
    if (!view) return;

    const isOpen = this.devToolsOpen.get(projectId) || false;

    if (isOpen) {
      view.webContents.closeDevTools();
      this.devToolsOpen.set(projectId, false);
    } else {
      view.webContents.openDevTools({ mode: 'detach' });
      this.devToolsOpen.set(projectId, true);
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
}

// Export singleton instance
export const previewService = new PreviewService();
