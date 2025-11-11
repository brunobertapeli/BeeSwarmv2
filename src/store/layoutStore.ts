import { create } from 'zustand';

export type LayoutState = 'DEFAULT' | 'TOOLS' | 'BROWSER_FULL';

interface LayoutStoreState {
  // Current layout state
  layoutState: LayoutState;
  setLayoutState: (state: LayoutState) => void;

  // StatusSheet expanded state (independent of layout state)
  statusSheetExpanded: boolean;
  setStatusSheetExpanded: (expanded: boolean) => void;

  // ActionBar height (for bounds calculation)
  actionBarHeight: number;
  setActionBarHeight: (height: number) => void;

  // Modal freeze state (for overlay effects)
  modalFreezeActive: boolean;
  modalFreezeImage: string | null;
  setModalFreezeActive: (active: boolean) => void;
  setModalFreezeImage: (image: string | null) => void;

  // Edit mode state (for image editing)
  editModeEnabled: boolean;
  setEditModeEnabled: (enabled: boolean) => void;

  // Helper to check if in specific state
  isState: (state: LayoutState) => boolean;

  // Helper: Check if ActionBar should be visible
  isActionBarVisible: () => boolean;

  // Helper: Check if BrowserView should be fullscreen
  isBrowserFullscreen: () => boolean;
}

export const useLayoutStore = create<LayoutStoreState>((set, get) => ({
  // State
  layoutState: 'DEFAULT', // Start in DEFAULT state
  statusSheetExpanded: false,
  actionBarHeight: 110, // Default ActionBar height
  modalFreezeActive: false,
  modalFreezeImage: null,
  editModeEnabled: false,

  // Setters
  setLayoutState: (state) => set({ layoutState: state }),
  setStatusSheetExpanded: (expanded) => set({ statusSheetExpanded: expanded }),
  setActionBarHeight: (height) => {
    set({ actionBarHeight: height });
    // Notify Electron
    window.electronAPI?.layout.setActionBarHeight(height);
  },
  setModalFreezeActive: (active) => set({ modalFreezeActive: active }),
  setModalFreezeImage: (image) => set({ modalFreezeImage: image }),
  setEditModeEnabled: (enabled) => set({ editModeEnabled: enabled }),

  // Helpers
  isState: (state) => get().layoutState === state,

  isActionBarVisible: () => {
    const state = get().layoutState;
    return state === 'DEFAULT' || state === 'TOOLS';
  },

  isBrowserFullscreen: () => {
    const state = get().layoutState;
    return state === 'BROWSER_FULL';
  },
}));
