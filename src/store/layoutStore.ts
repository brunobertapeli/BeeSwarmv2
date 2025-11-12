import { create } from 'zustand';
import { useAppStore } from './appStore';

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

  // Kanban widget state
  kanbanEnabled: boolean;
  setKanbanEnabled: (enabled: boolean) => void;
  kanbanPosition: { x: number; y: number };
  setKanbanPosition: (position: { x: number; y: number }) => void;
  kanbanSize: { width: number; height: number };
  setKanbanSize: (size: { width: number; height: number }) => void;
  kanbanColumns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: string;
    }>;
  }>;
  setKanbanColumns: (columns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: string;
    }>;
  }> | ((prev: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: string;
    }>;
  }>) => Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: string;
    }>;
  }>)) => void;
  loadKanbanState: (projectId: string) => Promise<void>;

  // Helper to check if in specific state
  isState: (state: LayoutState) => boolean;

  // Helper: Check if ActionBar should be visible
  isActionBarVisible: () => boolean;
}

// Debounce helper for saving Kanban state
let saveTimeout: NodeJS.Timeout | null = null;
const debouncedSaveKanbanState = (projectId: string, kanbanState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  columns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: string;
    }>;
  }>;
}) => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveKanbanState(projectId, kanbanState);
    } catch (error) {
      console.error('Failed to save Kanban state:', error);
    }
  }, 500); // 500ms debounce
};

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
  kanbanEnabled: false,
  kanbanPosition: { x: 20, y: 43 }, // Default position (3px padding from header)
  kanbanSize: { width: 900, height: 410 }, // Default size
  kanbanColumns: [
    { id: 'todo', title: 'To Do', cards: [] },
    { id: 'progress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ],

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

  setKanbanEnabled: (enabled) => {
    set({ kanbanEnabled: enabled });
    // Get current project ID from appStore
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveKanbanState(currentProjectId, {
        enabled,
        position: state.kanbanPosition,
        size: state.kanbanSize,
        columns: state.kanbanColumns
      });
    }
  },

  setKanbanPosition: (position) => {
    set({ kanbanPosition: position });
    // Get current project ID from appStore
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveKanbanState(currentProjectId, {
        enabled: state.kanbanEnabled,
        position,
        size: state.kanbanSize,
        columns: state.kanbanColumns
      });
    }
  },

  setKanbanSize: (size) => {
    set({ kanbanSize: size });
    // Get current project ID from appStore
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveKanbanState(currentProjectId, {
        enabled: state.kanbanEnabled,
        position: state.kanbanPosition,
        size,
        columns: state.kanbanColumns
      });
    }
  },

  setKanbanColumns: (columnsOrUpdater) => {
    // Support both direct value and updater function
    const newColumns = typeof columnsOrUpdater === 'function'
      ? columnsOrUpdater(get().kanbanColumns || [])
      : columnsOrUpdater;

    set({ kanbanColumns: newColumns });

    // Get current project ID from appStore
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveKanbanState(currentProjectId, {
        enabled: state.kanbanEnabled,
        position: state.kanbanPosition,
        size: state.kanbanSize,
        columns: newColumns
      });
    }
  },

  loadKanbanState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getKanbanState(projectId);
      if (result?.success && result.kanbanState) {
        set({
          kanbanEnabled: result.kanbanState.enabled,
          kanbanPosition: result.kanbanState.position,
          kanbanSize: result.kanbanState.size,
          kanbanColumns: result.kanbanState.columns
        });
      } else {
        // Reset to defaults if no saved state
        set({
          kanbanEnabled: false,
          kanbanPosition: { x: 20, y: 43 },
          kanbanSize: { width: 900, height: 410 },
          kanbanColumns: [
            { id: 'todo', title: 'To Do', cards: [] },
            { id: 'progress', title: 'In Progress', cards: [] },
            { id: 'done', title: 'Done', cards: [] }
          ]
        });
      }
    } catch (error) {
      console.error('Failed to load Kanban state:', error);
      // Reset to defaults on error
      set({
        kanbanEnabled: false,
        kanbanPosition: { x: 20, y: 43 },
        kanbanSize: { width: 900, height: 410 },
        kanbanColumns: [
          { id: 'todo', title: 'To Do', cards: [] },
          { id: 'progress', title: 'In Progress', cards: [] },
          { id: 'done', title: 'Done', cards: [] }
        ]
      });
    }
  },

  // Helpers
  isState: (state) => get().layoutState === state,

  isActionBarVisible: () => {
    const state = get().layoutState;
    return state === 'DEFAULT' || state === 'TOOLS';
  },
}));
