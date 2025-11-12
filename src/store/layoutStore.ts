import { create } from 'zustand';

export type LayoutState = 'DEFAULT' | 'TOOLS';

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

  // Image edit modal state
  imageEditModalOpen: boolean;
  imageEditModalData: { src: string; width?: number; height?: number; path?: string } | null;
  setImageEditModalOpen: (open: boolean) => void;
  setImageEditModalData: (data: { src: string; width?: number; height?: number; path?: string } | null) => void;

  // Image references for ActionBar (inline pills in message input)
  imageReferences: Array<{
    id: string;
    name: string;
    path: string;
    src: string;
    dimensions: string;
  }>;
  addImageReference: (ref: { id: string; name: string; path: string; src: string; dimensions: string }) => void;
  removeImageReference: (id: string) => void;
  clearImageReferences: () => void;

  // Text content pills for large pastes (logs, schemas, etc.)
  textContents: Array<{
    id: string;
    content: string;
    lineCount: number;
    preview: string; // First ~50 chars for display
  }>;
  addTextContent: (content: { id: string; content: string; lineCount: number; preview: string }) => void;
  removeTextContent: (id: string) => void;
  clearTextContents: () => void;

  // Pre-filled message for ActionBar (set by modals/other components)
  prefilledMessage: string | null;
  setPrefilledMessage: (message: string | null) => void;

  // Helper to check if in specific state
  isState: (state: LayoutState) => boolean;

  // Helper: Check if ActionBar should be visible
  isActionBarVisible: () => boolean;
}

export const useLayoutStore = create<LayoutStoreState>((set, get) => ({
  // State
  layoutState: 'DEFAULT', // Start in DEFAULT state
  statusSheetExpanded: false,
  actionBarHeight: 110, // Default ActionBar height
  modalFreezeActive: false,
  modalFreezeImage: null,
  editModeEnabled: false,
  imageEditModalOpen: false,
  imageEditModalData: null,
  imageReferences: [],
  textContents: [],
  prefilledMessage: null,

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
  setImageEditModalOpen: (open) => set({ imageEditModalOpen: open }),
  setImageEditModalData: (data) => set({ imageEditModalData: data }),
  addImageReference: (ref) => set((state) => ({ imageReferences: [...state.imageReferences, ref] })),
  removeImageReference: (id) => set((state) => ({ imageReferences: state.imageReferences.filter(r => r.id !== id) })),
  clearImageReferences: () => set({ imageReferences: [] }),
  addTextContent: (content) => set((state) => ({ textContents: [...state.textContents, content] })),
  removeTextContent: (id) => set((state) => ({ textContents: state.textContents.filter(c => c.id !== id) })),
  clearTextContents: () => set({ textContents: [] }),
  setPrefilledMessage: (message) => set({ prefilledMessage: message }),

  // Helpers
  isState: (state) => get().layoutState === state,

  isActionBarVisible: () => {
    const state = get().layoutState;
    return state === 'DEFAULT' || state === 'TOOLS';
  },
}));
