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
  private thumbnailSize = { width: 224, height: 126 }; // Thumbnail dimensions (30% smaller: 320*0.7, 180*0.7)
  private thumbnailPosition = { top: 64, left: 16 }; // Below header, left margin
  private thumbnailCache: Map<string, string> = new Map(); // Cache thumbnails per project

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
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
    console.log(`🎨 Layout state: ${this.currentState} → ${state}`);

    const previousState = this.currentState;
    this.currentState = state;

    // Calculate and apply bounds for new state
    const bounds = this.calculateBounds(state);

    if (state === 'STATUS_EXPANDED') {
      // Ensure BrowserView is visible before capturing
      const wasHidden = previewService.isPreviewHidden(projectId);
      if (wasHidden) {
        console.log('📸 BrowserView was hidden, showing temporarily for capture...');
        previewService.show(projectId);
        // Set to DEFAULT bounds temporarily for capture
        const defaultBounds = this.calculateBounds('DEFAULT');
        previewService.updateBounds(projectId, defaultBounds);
        // Small delay to ensure render
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Capture fresh thumbnail
      console.log('📸 Capturing thumbnail...');
      const thumbnail = await this.captureThumbnail(projectId);

      if (thumbnail) {
        console.log('✅ Thumbnail captured successfully, length:', thumbnail.length);
        // Cache it for subsequent fast transitions
        this.thumbnailCache.set(projectId, thumbnail);
      } else {
        console.log('❌ Thumbnail capture failed, checking cache...');
      }

      // Hide BrowserView (we'll show the static screenshot instead)
      previewService.hide(projectId);

      // Use captured or cached thumbnail
      const finalThumbnail = thumbnail || this.thumbnailCache.get(projectId);
      console.log('📤 Emitting state-changed with thumbnail:', finalThumbnail ? 'YES' : 'NO');

      // Emit with thumbnail data (use cached if capture failed)
      this.emit('state-changed', state, previousState, finalThumbnail);
    } else if (state === 'BROWSER_FULL' || state === 'DEFAULT') {
      // Show full BrowserView with appropriate bounds
      previewService.show(projectId);
      previewService.updateBounds(projectId, bounds);

      // Emit state change event to renderer
      this.emit('state-changed', state, previousState);
    }
  }

  /**
   * Cycle to next state (for Tab key)
   * DEFAULT → STATUS_EXPANDED → BROWSER_FULL → DEFAULT
   */
  async cycleState(projectId: string): Promise<void> {
    let nextState: LayoutState;

    switch (this.currentState) {
      case 'DEFAULT':
        nextState = 'STATUS_EXPANDED';
        break;
      case 'STATUS_EXPANDED':
        nextState = 'BROWSER_FULL';
        break;
      case 'BROWSER_FULL':
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
        // Small thumbnail (top-left)
        return {
          x: this.thumbnailPosition.left,
          y: this.thumbnailPosition.top,
          width: this.thumbnailSize.width,
          height: this.thumbnailSize.height,
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
    console.log(`📏 ActionBar height updated: ${this.actionBarHeight} → ${height}`);
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
      const resized = image.resize({
        width: this.thumbnailSize.width,
        height: this.thumbnailSize.height,
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
    return {
      size: this.thumbnailSize,
      position: this.thumbnailPosition,
    };
  }
}

// Export singleton instance
export const layoutManager = new LayoutManager();
