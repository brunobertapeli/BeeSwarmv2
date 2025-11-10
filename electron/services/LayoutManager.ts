import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { previewService } from './PreviewService.js';

/**
 * Layout state for the IDE
 */
export type LayoutState = 'DEFAULT' | 'STATUS_EXPANDED' | 'BROWSER_FULL';

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
 * LayoutManager
 *
 * Manages the 3-state layout system for BrowserView coordination
 * States: DEFAULT (60% + ActionBar) | STATUS_EXPANDED (thumbnail + StatusSheet) | BROWSER_FULL (fullscreen)
 */
class LayoutManager extends EventEmitter {
  private currentState: LayoutState = 'DEFAULT';
  private mainWindow: BrowserWindow | null = null;
  private actionBarHeight: number = 110; // Default ActionBar height
  private headerHeight: number = 48; // Top header height
  private desktopThumbnailSize = { width: 224, height: 126 }; // Desktop: landscape (16:9)
  private mobileThumbnailSize = { width: 126, height: 224 }; // Mobile: portrait (9:16)
  private thumbnailPosition = { top: 64, left: 16 }; // Below header, left margin
  private thumbnailCache: Map<string, string> = new Map(); // Cache thumbnails per project
  private modalFreezeCache: Map<string, string> = new Map(); // Cache full-size captures for modal freeze
  private currentViewMode: 'desktop' | 'mobile' = 'desktop'; // Track current view mode

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  /**
   * Set current view mode (desktop/mobile)
   */
  setViewMode(viewMode: 'desktop' | 'mobile'): void {
    const wasChanged = this.currentViewMode !== viewMode;
    this.currentViewMode = viewMode;

    // Clear thumbnail cache when view mode changes to force re-capture with new size
    if (wasChanged) {
      this.thumbnailCache.clear();
    }
  }

  /**
   * Get current layout state
   */
  getState(): LayoutState {
    return this.currentState;
  }

  /**
   * Set layout state and update BrowserView bounds
   */
  async setState(state: LayoutState, projectId: string): Promise<void> {

    const previousState = this.currentState;
    this.currentState = state;

    // Calculate and apply bounds for new state
    const bounds = this.calculateBounds(state);

    if (state === 'STATUS_EXPANDED') {
      // Ensure BrowserView is visible before capturing
      const wasHidden = previewService.isPreviewHidden(projectId);
      if (wasHidden) {
        previewService.show(projectId);
        // Set to DEFAULT bounds temporarily for capture
        const defaultBounds = this.calculateBounds('DEFAULT');
        previewService.updateBounds(projectId, defaultBounds);
        // Small delay to ensure render
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Capture fresh thumbnail
      const thumbnail = await this.captureThumbnail(projectId);

      if (thumbnail) {
        // Cache it for subsequent fast transitions
        this.thumbnailCache.set(projectId, thumbnail);
      } else {
      }

      // Hide BrowserView (we'll show the static screenshot instead)
      previewService.hide(projectId);

      // Use captured or cached thumbnail
      const finalThumbnail = thumbnail || this.thumbnailCache.get(projectId);

      // Emit with thumbnail data (use cached if capture failed)
      this.emit('state-changed', state, previousState, finalThumbnail);
    } else if (state === 'BROWSER_FULL' || state === 'DEFAULT') {
      // Hide BrowserView briefly to avoid flash during transition
      previewService.hide(projectId);

      // Emit state change event to renderer first (so DOM can update)
      this.emit('state-changed', state, previousState);

      // Wait for DOM to settle, then show with correct bounds
      await new Promise(resolve => setTimeout(resolve, 150));

      // Show BrowserView - bounds will be set by DesktopPreviewFrame
      previewService.show(projectId);
    }
  }

  /**
   * Cycle to next state (for Tab key)
   * DEFAULT ↔ STATUS_EXPANDED (toggle between default and thumbnail)
   * Note: BROWSER_FULL is only accessible via fullscreen icon, not Tab cycling
   */
  async cycleState(projectId: string): Promise<void> {
    let nextState: LayoutState;

    switch (this.currentState) {
      case 'DEFAULT':
        nextState = 'STATUS_EXPANDED';
        break;
      case 'STATUS_EXPANDED':
        nextState = 'DEFAULT';
        break;
      case 'BROWSER_FULL':
        // If somehow in BROWSER_FULL, go back to DEFAULT
        nextState = 'DEFAULT';
        break;
      default:
        nextState = 'DEFAULT';
    }

    await this.setState(nextState, projectId);
  }

  /**
   * Calculate bounds for BrowserView based on state
   */
  private calculateBounds(state: LayoutState): PreviewBounds {
    if (!this.mainWindow) {
      return { x: 0, y: 0, width: 800, height: 600 };
    }

    const windowBounds = this.mainWindow.getBounds();
    const { width: windowWidth, height: windowHeight } = windowBounds;

    switch (state) {
      case 'DEFAULT':
        // Above ActionBar, responsive natural size
        return {
          x: 0,
          y: this.headerHeight,
          width: windowWidth,
          height: windowHeight - this.headerHeight - this.actionBarHeight,
        };

      case 'STATUS_EXPANDED':
        // Small thumbnail (top-left) - size depends on view mode
        const thumbnailSize = this.currentViewMode === 'mobile'
          ? this.mobileThumbnailSize
          : this.desktopThumbnailSize;
        return {
          x: this.thumbnailPosition.left,
          y: this.thumbnailPosition.top,
          width: thumbnailSize.width,
          height: thumbnailSize.height,
        };

      case 'BROWSER_FULL':
        // Fullscreen
        return {
          x: 0,
          y: 0,
          width: windowWidth,
          height: windowHeight,
        };

      default:
        return {
          x: 0,
          y: this.headerHeight,
          width: windowWidth,
          height: windowHeight - this.headerHeight - this.actionBarHeight,
        };
    }
  }

  /**
   * Update ActionBar height (called when ActionBar size changes)
   */
  setActionBarHeight(height: number): void {
    this.actionBarHeight = height;

    // Recalculate bounds if in DEFAULT state
    if (this.currentState === 'DEFAULT' && this.mainWindow) {
      // Will need projectId - emit event instead
      this.emit('actionbar-height-changed', height);
    }
  }

  /**
   * Capture thumbnail from BrowserView
   */
  async captureThumbnail(projectId: string): Promise<string | null> {
    const preview = previewService.getPreview(projectId);
    if (!preview) return null;

    try {
      const image = await preview.webContents.capturePage();
      const thumbnailSize = this.currentViewMode === 'mobile'
        ? this.mobileThumbnailSize
        : this.desktopThumbnailSize;
      const resized = image.resize({
        width: thumbnailSize.width,
        height: thumbnailSize.height,
      });

      // Return as base64 data URL
      return `data:image/png;base64,${resized.toPNG().toString('base64')}`;
    } catch (error) {
      console.error('❌ Failed to capture thumbnail:', error);
      return null;
    }
  }

  /**
   * Get thumbnail size and position
   */
  getThumbnailInfo() {
    const thumbnailSize = this.currentViewMode === 'mobile'
      ? this.mobileThumbnailSize
      : this.desktopThumbnailSize;
    return {
      size: thumbnailSize,
      position: this.thumbnailPosition,
    };
  }

  /**
   * Capture full-size screenshot for modal freeze effect
   */
  async captureForModalFreeze(projectId: string): Promise<string | null> {
    const preview = previewService.getPreview(projectId);
    if (!preview) {
      return null;
    }

    try {

      // Ensure BrowserView is visible
      const wasHidden = previewService.isPreviewHidden(projectId);
      if (wasHidden) {
        previewService.show(projectId);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const image = await preview.webContents.capturePage();

      // Return full-size as base64 data URL
      const dataUrl = `data:image/png;base64,${image.toPNG().toString('base64')}`;

      // Cache it for quick reuse
      this.modalFreezeCache.set(projectId, dataUrl);

      return dataUrl;
    } catch (error) {
      console.error('❌ Failed to capture for modal freeze:', error);
      return null;
    }
  }

  /**
   * Get cached modal freeze image if available
   */
  getCachedModalFreeze(projectId: string): string | null {
    return this.modalFreezeCache.get(projectId) || null;
  }

  /**
   * Clear modal freeze cache for a project
   */
  clearModalFreezeCache(projectId: string): void {
    this.modalFreezeCache.delete(projectId);
  }
}

// Export singleton instance
export const layoutManager = new LayoutManager();
