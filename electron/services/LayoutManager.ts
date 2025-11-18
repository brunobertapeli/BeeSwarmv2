import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { previewService } from './PreviewService.js';

/**
 * Layout state for the IDE
 */
export type LayoutState = 'DEFAULT' | 'TOOLS' | 'BROWSER_FULL';

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
 * States: DEFAULT (preview + ActionBar) | TOOLS (ActionBar only, no preview) | BROWSER_FULL (fullscreen)
 */
class LayoutManager extends EventEmitter {
  private currentState: LayoutState = 'DEFAULT';
  private mainWindow: BrowserWindow | null = null;
  private actionBarHeight: number = 110; // Default ActionBar height
  private headerHeight: number = 48; // Top header height
  private modalFreezeCache: Map<string, string> = new Map(); // Cache full-size captures for modal freeze
  private currentViewMode: 'desktop' | 'mobile' = 'desktop'; // Track current view mode
  private isTransitioning: boolean = false; // Guard against rapid state changes

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
    this.currentViewMode = viewMode;
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
    console.log('🔍 [LAYOUT MANAGER] setState() called:', {
      currentState: this.currentState,
      newState: state,
      projectId,
      isTransitioning: this.isTransitioning,
      timestamp: new Date().toISOString()
    });

    // Guard against overlapping transitions
    if (this.isTransitioning) {
      console.warn('⚠️ [LAYOUT MANAGER] Transition already in progress, ignoring setState');
      return;
    }

    this.isTransitioning = true;

    try {
      const previousState = this.currentState;
      this.currentState = state;

      // Calculate and apply bounds for new state
      const bounds = this.calculateBounds(state);
      console.log('🔍 [LAYOUT MANAGER] Calculated bounds for state:', state, bounds);

      if (state === 'TOOLS') {
        // TOOLS state: Hide preview, show ActionBar + StatusSheet
        console.log('🔍 [LAYOUT MANAGER] TOOLS state - hiding preview for project:', projectId);
        previewService.hide(projectId);

        // Emit state change to renderer
        this.emit('state-changed', state, previousState);
        console.log('✅ [LAYOUT MANAGER] Transitioned to TOOLS state');
      } else if (state === 'BROWSER_FULL') {
        // BROWSER_FULL: Show preview in fullscreen
        console.log('🔍 [LAYOUT MANAGER] BROWSER_FULL state - hiding then showing preview');
        previewService.hide(projectId);

        // Emit state change event to renderer first (so DOM can update)
        this.emit('state-changed', state, previousState);

        // Wait for DOM to settle, then show with correct bounds
        await new Promise(resolve => setTimeout(resolve, 150));

        // Show BrowserView - bounds will be set by DesktopPreviewFrame
        previewService.show(projectId);
        console.log('✅ [LAYOUT MANAGER] Transitioned to BROWSER_FULL state');
      } else if (state === 'DEFAULT') {
        // DEFAULT: Show preview (StatusSheet component may hide it temporarily if expanded)
        console.log('🔍 [LAYOUT MANAGER] DEFAULT state - showing preview for project:', projectId);

        // Emit state change event to renderer first
        this.emit('state-changed', state, previousState);

        // Wait for DOM to settle, then show preview
        await new Promise(resolve => setTimeout(resolve, 50));

        // Show BrowserView - ensures it's visible when switching back to DEFAULT
        previewService.show(projectId);
        console.log('✅ [LAYOUT MANAGER] Transitioned to DEFAULT state');
      }
    } finally {
      // Always clear the transition flag
      this.isTransitioning = false;
      console.log('🔍 [LAYOUT MANAGER] Transition complete, flag cleared');
    }
  }

  /**
   * Cycle to next state (for Tab key)
   * DEFAULT ↔ TOOLS (toggle between preview and tools view)
   * Note: BROWSER_FULL is only accessible via fullscreen icon, not Tab cycling
   */
  async cycleState(projectId: string): Promise<void> {
    console.log('🔍 [LAYOUT MANAGER] cycleState() called:', {
      currentState: this.currentState,
      projectId,
      isTransitioning: this.isTransitioning,
      timestamp: new Date().toISOString()
    });

    // Guard against rapid Tab presses (setState also has guard, this provides early exit)
    if (this.isTransitioning) {
      console.warn('⚠️ [LAYOUT MANAGER] Transition in progress, ignoring Tab press');
      return;
    }

    let nextState: LayoutState;

    switch (this.currentState) {
      case 'DEFAULT':
        nextState = 'TOOLS';
        break;
      case 'TOOLS':
        nextState = 'DEFAULT';
        break;
      case 'BROWSER_FULL':
        // If somehow in BROWSER_FULL, go back to DEFAULT
        nextState = 'DEFAULT';
        break;
      default:
        nextState = 'DEFAULT';
    }

    console.log('🔍 [LAYOUT MANAGER] Cycling from', this.currentState, 'to', nextState);
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

      case 'TOOLS':
        // TOOLS state: Preview is hidden, no bounds needed
        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
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
