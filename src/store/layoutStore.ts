import { create } from 'zustand';
import { useAppStore } from './appStore';

export type LayoutState = 'DEFAULT' | 'TOOLS' | 'BROWSER_FULL';
export type Priority = 'Low' | 'Medium' | 'High' | 'Important' | 'Critical' | 'Off track';

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
  kanbanZIndex: number;
  kanbanColumns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: Priority;
    }>;
  }>;
  setKanbanColumns: (columns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: Priority;
    }>;
  }> | ((prev: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: Priority;
    }>;
  }>) => Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      content: string;
      priority: Priority;
    }>;
  }>)) => void;
  loadKanbanState: (projectId: string) => Promise<void>;

  // Sticky notes state
  stickyNotes: Array<{
    id: string;
    position: { x: number; y: number }; // Relative position (0-1)
    content: string;
    color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green';
    stickyText: boolean; // True for handwritten-style font
    zIndex: number;
  }>;
  addStickyNote: () => void;
  updateStickyNote: (id: string, updates: Partial<{
    position: { x: number; y: number };
    content: string;
    color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green';
    stickyText: boolean;
  }>) => void;
  removeStickyNote: (id: string) => void;
  bringNoteToFront: (id: string) => void;
  loadStickyNotesState: (projectId: string) => Promise<void>;

  // Analytics widget state
  analyticsWidgetEnabled: boolean;
  setAnalyticsWidgetEnabled: (enabled: boolean) => void;
  analyticsWidgetPosition: { x: number; y: number };
  setAnalyticsWidgetPosition: (position: { x: number; y: number }) => void;
  analyticsWidgetSize: { width: number; height: number };
  setAnalyticsWidgetSize: (size: { width: number; height: number }) => void;
  analyticsWidgetZIndex: number;
  loadAnalyticsWidgetState: (projectId: string) => Promise<void>;

  // Project Assets widget state
  projectAssetsWidgetEnabled: boolean;
  setProjectAssetsWidgetEnabled: (enabled: boolean) => void;
  projectAssetsWidgetPosition: { x: number; y: number };
  setProjectAssetsWidgetPosition: (position: { x: number; y: number }) => void;
  projectAssetsWidgetZIndex: number;
  loadProjectAssetsWidgetState: (projectId: string) => Promise<void>;

  // Whiteboard widget state
  whiteboardWidgetEnabled: boolean;
  setWhiteboardWidgetEnabled: (enabled: boolean) => void;
  whiteboardWidgetPosition: { x: number; y: number };
  setWhiteboardWidgetPosition: (position: { x: number; y: number }) => void;
  whiteboardWidgetSize: { width: number; height: number };
  setWhiteboardWidgetSize: (size: { width: number; height: number }) => void;
  whiteboardWidgetZIndex: number;
  loadWhiteboardWidgetState: (projectId: string) => Promise<void>;

  // Whiteboard drawing data (Excalidraw)
  whiteboardData: { elements: any[]; appState: any; files: any } | null;
  setWhiteboardData: (data: { elements: any[]; appState: any; files: any } | null) => void;
  loadWhiteboardData: (projectId: string) => Promise<void>;

  // Icons widget state
  iconsWidgetEnabled: boolean;
  setIconsWidgetEnabled: (enabled: boolean) => void;
  iconsWidgetPosition: { x: number; y: number };
  setIconsWidgetPosition: (position: { x: number; y: number }) => void;
  iconsWidgetSize: { width: number; height: number };
  setIconsWidgetSize: (size: { width: number; height: number }) => void;
  iconsWidgetZIndex: number;
  loadIconsWidgetState: (projectId: string) => Promise<void>;

  // Chat widget state
  chatWidgetEnabled: boolean;
  setChatWidgetEnabled: (enabled: boolean) => void;
  chatWidgetPosition: { x: number; y: number };
  setChatWidgetPosition: (position: { x: number; y: number }) => void;
  chatWidgetSize: { width: number; height: number };
  setChatWidgetSize: (size: { width: number; height: number }) => void;
  chatWidgetZIndex: number;
  loadChatWidgetState: (projectId: string) => Promise<void>;

  // Background Remover widget state
  backgroundRemoverWidgetEnabled: boolean;
  setBackgroundRemoverWidgetEnabled: (enabled: boolean) => void;
  backgroundRemoverWidgetPosition: { x: number; y: number };
  setBackgroundRemoverWidgetPosition: (position: { x: number; y: number }) => void;
  backgroundRemoverWidgetSize: { width: number; height: number };
  setBackgroundRemoverWidgetSize: (size: { width: number; height: number }) => void;
  backgroundRemoverWidgetZIndex: number;
  loadBackgroundRemoverWidgetState: (projectId: string) => Promise<void>;

  // Unified bring to front for all widgets and sticky notes
  bringWidgetToFront: (widgetType: 'kanban' | 'analytics' | 'projectAssets' | 'whiteboard' | 'icons' | 'chat' | 'backgroundRemover' | 'stickyNote', stickyNoteId?: string) => void;

  // Preview hidden state (when modals are open over browser)
  previewHidden: boolean;
  setPreviewHidden: (hidden: boolean) => void;

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
  zIndex: number;
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

// Debounce helper for saving Sticky Notes state
let saveStickyNotesTimeout: NodeJS.Timeout | null = null;
const debouncedSaveStickyNotesState = (projectId: string, stickyNotesState: {
  notes: Array<{
    id: string;
    position: { x: number; y: number };
    content: string;
    color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green';
    stickyText: boolean;
    zIndex: number;
  }>;
}) => {
  if (saveStickyNotesTimeout) {
    clearTimeout(saveStickyNotesTimeout);
  }

  saveStickyNotesTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveStickyNotesState(projectId, stickyNotesState);
    } catch (error) {
      console.error('Failed to save sticky notes state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Analytics widget state
let saveAnalyticsTimeout: NodeJS.Timeout | null = null;
const debouncedSaveAnalyticsWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}) => {
  if (saveAnalyticsTimeout) {
    clearTimeout(saveAnalyticsTimeout);
  }

  saveAnalyticsTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveAnalyticsWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Analytics widget state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Project Assets widget state
let saveProjectAssetsTimeout: NodeJS.Timeout | null = null;
const debouncedSaveProjectAssetsWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  zIndex: number;
}) => {
  if (saveProjectAssetsTimeout) {
    clearTimeout(saveProjectAssetsTimeout);
  }

  saveProjectAssetsTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveProjectAssetsWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Project Assets widget state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Whiteboard widget state
let saveWhiteboardTimeout: NodeJS.Timeout | null = null;
const debouncedSaveWhiteboardWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}) => {
  if (saveWhiteboardTimeout) {
    clearTimeout(saveWhiteboardTimeout);
  }

  saveWhiteboardTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveWhiteboardWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Whiteboard widget state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Whiteboard drawing data (Excalidraw)
let saveWhiteboardDataTimeout: NodeJS.Timeout | null = null;
const debouncedSaveWhiteboardData = (projectId: string, data: {
  elements: any[];
  appState: any;
  files: any;
}) => {
  if (saveWhiteboardDataTimeout) {
    clearTimeout(saveWhiteboardDataTimeout);
  }

  saveWhiteboardDataTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveWhiteboardData(projectId, data);
    } catch (error) {
      console.error('Failed to save Whiteboard data:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Icons widget state
let saveIconsTimeout: NodeJS.Timeout | null = null;
const debouncedSaveIconsWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}) => {
  if (saveIconsTimeout) {
    clearTimeout(saveIconsTimeout);
  }

  saveIconsTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveIconsWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Icons widget state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Chat widget state
let saveChatTimeout: NodeJS.Timeout | null = null;
const debouncedSaveChatWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}) => {
  if (saveChatTimeout) {
    clearTimeout(saveChatTimeout);
  }

  saveChatTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveChatWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Chat widget state:', error);
    }
  }, 500); // 500ms debounce
};

// Debounce helper for saving Background Remover widget state
let saveBackgroundRemoverTimeout: NodeJS.Timeout | null = null;
const debouncedSaveBackgroundRemoverWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
}) => {
  if (saveBackgroundRemoverTimeout) {
    clearTimeout(saveBackgroundRemoverTimeout);
  }

  saveBackgroundRemoverTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveBackgroundRemoverWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Background Remover widget state:', error);
    }
  }, 500); // 500ms debounce
};

export const useLayoutStore = create<LayoutStoreState>((set, get) => ({
  // State
  layoutState: 'DEFAULT', // Start in DEFAULT state
  statusSheetExpanded: false,
  actionBarHeight: 110, // Default ActionBar height
  editModeEnabled: false,
  imageEditModalOpen: false,
  imageEditModalData: null,
  imageReferences: [],
  textContents: [],
  prefilledMessage: null,
  kanbanEnabled: false,
  kanbanPosition: { x: 5, y: 48 }, // Default position (5px from left, below header)
  kanbanSize: { width: 900, height: 410 }, // Default size
  kanbanZIndex: 50,
  kanbanColumns: [
    { id: 'todo', title: 'To Do', cards: [] },
    { id: 'progress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ],

  // Sticky notes initial state
  stickyNotes: [],

  // Analytics widget initial state
  analyticsWidgetEnabled: false,
  analyticsWidgetPosition: { x: 5, y: 48 }, // Default position (5px from left, below header)
  analyticsWidgetSize: { width: 600, height: 405 },
  analyticsWidgetZIndex: 51,

  // Project Assets widget initial state
  projectAssetsWidgetEnabled: false,
  projectAssetsWidgetPosition: { x: 5, y: 48 }, // Default position (5px from left, below header)
  projectAssetsWidgetZIndex: 52,

  // Whiteboard widget initial state
  whiteboardWidgetEnabled: false,
  whiteboardWidgetPosition: { x: 5, y: 48 }, // Default position (5px from left, below header)
  whiteboardWidgetSize: { width: 1005, height: 500 },
  whiteboardWidgetZIndex: 53,
  whiteboardData: null,

  // Icons widget initial state
  iconsWidgetEnabled: false,
  iconsWidgetPosition: { x: 5, y: 48 }, // 5px from left, below header (40px + 3px padding + 5px)
  iconsWidgetSize: { width: 420, height: 298 },
  iconsWidgetZIndex: 54,

  // Chat widget initial state
  chatWidgetEnabled: false,
  chatWidgetPosition: { x: 5, y: 48 }, // 5px from left, below header
  chatWidgetSize: { width: 420, height: 550 },
  chatWidgetZIndex: 55,

  // Background Remover widget initial state
  backgroundRemoverWidgetEnabled: false,
  backgroundRemoverWidgetPosition: { x: 20, y: 48 }, // 20px from left, below header
  backgroundRemoverWidgetSize: { width: 650, height: 450 },
  backgroundRemoverWidgetZIndex: 56,

  // Setters
  setLayoutState: (state) => set({ layoutState: state }),
  setStatusSheetExpanded: (expanded) => set({ statusSheetExpanded: expanded }),
  setActionBarHeight: (height) => {
    set({ actionBarHeight: height });
    // Notify Electron
    window.electronAPI?.layout.setActionBarHeight(height);
  },
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
        columns: state.kanbanColumns,
        zIndex: state.kanbanZIndex
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
        columns: state.kanbanColumns,
        zIndex: state.kanbanZIndex
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
        columns: state.kanbanColumns,
        zIndex: state.kanbanZIndex
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
        columns: newColumns,
        zIndex: state.kanbanZIndex
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
          kanbanColumns: result.kanbanState.columns,
          kanbanZIndex: result.kanbanState.zIndex ?? 50
        });
      } else {
        // Reset to defaults if no saved state
        set({
          kanbanEnabled: false,
          kanbanPosition: { x: 5, y: 48 },
          kanbanSize: { width: 900, height: 410 },
          kanbanZIndex: 50,
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
        kanbanPosition: { x: 5, y: 48 },
        kanbanSize: { width: 900, height: 410 },
        kanbanZIndex: 50,
        kanbanColumns: [
          { id: 'todo', title: 'To Do', cards: [] },
          { id: 'progress', title: 'In Progress', cards: [] },
          { id: 'done', title: 'Done', cards: [] }
        ]
      });
    }
  },

  // Sticky notes functions
  addStickyNote: () => {
    const currentNotes = get().stickyNotes;
    const maxZ = currentNotes.length > 0
      ? Math.max(...currentNotes.map(n => n.zIndex), 95)
      : 96;

    const newNote = {
      id: `note-${Date.now()}`,
      position: { x: 0.1 + Math.random() * 0.1, y: 0.1 + Math.random() * 0.1 }, // Random position near top-left
      content: '',
      color: 'yellow' as const,
      stickyText: false,
      zIndex: Math.min(maxZ + 1, 98) // Cap at 98 to stay below status sheets (z-99)
    };

    set((state) => ({ stickyNotes: [...state.stickyNotes, newNote] }));

    // Save to database
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveStickyNotesState(currentProjectId, { notes: state.stickyNotes });
    }
  },

  updateStickyNote: (id, updates) => {
    set((state) => ({
      stickyNotes: state.stickyNotes.map(note =>
        note.id === id ? { ...note, ...updates } : note
      )
    }));

    // Save to database
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveStickyNotesState(currentProjectId, { notes: state.stickyNotes });
    }
  },

  removeStickyNote: (id) => {
    set((state) => ({
      stickyNotes: state.stickyNotes.filter(note => note.id !== id)
    }));

    // Save to database
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveStickyNotesState(currentProjectId, { notes: state.stickyNotes });
    }
  },

  bringNoteToFront: (id) => {
    const state = get();
    const currentNotes = state.stickyNotes;
    const targetNote = currentNotes.find(n => n.id === id);

    if (!targetNote) return;

    // Find the max z-index across ALL widgets AND sticky notes
    const allZIndices = [
      state.kanbanZIndex,
      state.analyticsWidgetZIndex,
      state.projectAssetsWidgetZIndex,
      state.whiteboardWidgetZIndex,
      ...currentNotes.map(n => n.zIndex)
    ];
    const maxZ = Math.max(...allZIndices, 49);
    const newTopZ = maxZ + 1;

    // Update only the target note's z-index
    const updatedNotes = currentNotes.map(note =>
      note.id === id ? { ...note, zIndex: newTopZ } : note
    );

    set({ stickyNotes: updatedNotes });

    // Save to database
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      debouncedSaveStickyNotesState(currentProjectId, { notes: updatedNotes });
    }
  },

  loadStickyNotesState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getStickyNotesState(projectId);
      if (result?.success && result.stickyNotesState) {
        set({
          stickyNotes: result.stickyNotesState.notes
        });
      } else {
        // Reset to defaults if no saved state
        set({
          stickyNotes: []
        });
      }
    } catch (error) {
      console.error('Failed to load sticky notes state:', error);
      // Reset to defaults on error
      set({
        stickyNotes: []
      });
    }
  },

  // Analytics widget functions
  setAnalyticsWidgetEnabled: (enabled) => {
    set({ analyticsWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveAnalyticsWidgetState(currentProjectId, {
        enabled,
        position: state.analyticsWidgetPosition,
        size: state.analyticsWidgetSize,
        zIndex: state.analyticsWidgetZIndex
      });
    }
  },

  setAnalyticsWidgetPosition: (position) => {
    set({ analyticsWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveAnalyticsWidgetState(currentProjectId, {
        enabled: state.analyticsWidgetEnabled,
        position,
        size: state.analyticsWidgetSize,
        zIndex: state.analyticsWidgetZIndex
      });
    }
  },

  setAnalyticsWidgetSize: (size) => {
    set({ analyticsWidgetSize: size });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveAnalyticsWidgetState(currentProjectId, {
        enabled: state.analyticsWidgetEnabled,
        position: state.analyticsWidgetPosition,
        size,
        zIndex: state.analyticsWidgetZIndex
      });
    }
  },

  loadAnalyticsWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getAnalyticsWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          analyticsWidgetEnabled: result.widgetState.enabled,
          analyticsWidgetPosition: result.widgetState.position,
          analyticsWidgetSize: result.widgetState.size,
          analyticsWidgetZIndex: result.widgetState.zIndex ?? 51
        });
      } else {
        // Reset to defaults if no saved state
        set({
          analyticsWidgetEnabled: false,
          analyticsWidgetPosition: { x: 5, y: 48 },
          analyticsWidgetSize: { width: 600, height: 405 },
          analyticsWidgetZIndex: 51
        });
      }
    } catch (error) {
      console.error('Failed to load Analytics widget state:', error);
      // Reset to defaults on error
      set({
        analyticsWidgetEnabled: false,
        analyticsWidgetPosition: { x: 5, y: 48 },
        analyticsWidgetSize: { width: 600, height: 405 },
        analyticsWidgetZIndex: 51
      });
    }
  },

  // Project Assets widget functions
  setProjectAssetsWidgetEnabled: (enabled) => {
    set({ projectAssetsWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveProjectAssetsWidgetState(currentProjectId, {
        enabled,
        position: state.projectAssetsWidgetPosition,
        zIndex: state.projectAssetsWidgetZIndex
      });
    }
  },

  setProjectAssetsWidgetPosition: (position) => {
    set({ projectAssetsWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveProjectAssetsWidgetState(currentProjectId, {
        enabled: state.projectAssetsWidgetEnabled,
        position,
        zIndex: state.projectAssetsWidgetZIndex
      });
    }
  },

  loadProjectAssetsWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getProjectAssetsWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          projectAssetsWidgetEnabled: result.widgetState.enabled,
          projectAssetsWidgetPosition: result.widgetState.position,
          projectAssetsWidgetZIndex: result.widgetState.zIndex ?? 52
        });
      } else {
        // Reset to defaults if no saved state
        set({
          projectAssetsWidgetEnabled: false,
          projectAssetsWidgetPosition: { x: 5, y: 48 },
          projectAssetsWidgetZIndex: 52
        });
      }
    } catch (error) {
      console.error('Failed to load Project Assets widget state:', error);
      // Reset to defaults on error
      set({
        projectAssetsWidgetEnabled: false,
        projectAssetsWidgetPosition: { x: 5, y: 48 },
        projectAssetsWidgetZIndex: 52
      });
    }
  },

  // Whiteboard widget functions
  setWhiteboardWidgetEnabled: (enabled) => {
    set({ whiteboardWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveWhiteboardWidgetState(currentProjectId, {
        enabled,
        position: state.whiteboardWidgetPosition,
        size: state.whiteboardWidgetSize,
        zIndex: state.whiteboardWidgetZIndex
      });
    }
  },

  setWhiteboardWidgetPosition: (position) => {
    set({ whiteboardWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveWhiteboardWidgetState(currentProjectId, {
        enabled: state.whiteboardWidgetEnabled,
        position,
        size: state.whiteboardWidgetSize,
        zIndex: state.whiteboardWidgetZIndex
      });
    }
  },

  setWhiteboardWidgetSize: (size) => {
    set({ whiteboardWidgetSize: size });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveWhiteboardWidgetState(currentProjectId, {
        enabled: state.whiteboardWidgetEnabled,
        position: state.whiteboardWidgetPosition,
        size,
        zIndex: state.whiteboardWidgetZIndex
      });
    }
  },

  loadWhiteboardWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getWhiteboardWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          whiteboardWidgetEnabled: result.widgetState.enabled,
          whiteboardWidgetPosition: result.widgetState.position,
          whiteboardWidgetSize: result.widgetState.size,
          whiteboardWidgetZIndex: result.widgetState.zIndex ?? 53
        });
      } else {
        // Reset to defaults if no saved state
        set({
          whiteboardWidgetEnabled: false,
          whiteboardWidgetPosition: { x: 5, y: 48 },
          whiteboardWidgetSize: { width: 1005, height: 500 },
          whiteboardWidgetZIndex: 53
        });
      }
    } catch (error) {
      console.error('Failed to load Whiteboard widget state:', error);
      // Reset to defaults on error
      set({
        whiteboardWidgetEnabled: false,
        whiteboardWidgetPosition: { x: 5, y: 48 },
        whiteboardWidgetSize: { width: 1005, height: 500 },
        whiteboardWidgetZIndex: 53
      });
    }
  },

  // Whiteboard data functions (Excalidraw)
  setWhiteboardData: (data) => {
    set({ whiteboardData: data });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId && data) {
      debouncedSaveWhiteboardData(currentProjectId, data);
    }
  },

  loadWhiteboardData: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getWhiteboardData(projectId);
      if (result?.success && result.data) {
        set({ whiteboardData: result.data });
      } else {
        set({ whiteboardData: null });
      }
    } catch (error) {
      console.error('Failed to load Whiteboard data:', error);
      set({ whiteboardData: null });
    }
  },

  // Icons widget functions
  setIconsWidgetEnabled: (enabled) => {
    set({ iconsWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveIconsWidgetState(currentProjectId, {
        enabled,
        position: state.iconsWidgetPosition,
        size: state.iconsWidgetSize,
        zIndex: state.iconsWidgetZIndex
      });
    }
  },

  setIconsWidgetPosition: (position) => {
    set({ iconsWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveIconsWidgetState(currentProjectId, {
        enabled: state.iconsWidgetEnabled,
        position,
        size: state.iconsWidgetSize,
        zIndex: state.iconsWidgetZIndex
      });
    }
  },

  setIconsWidgetSize: (size) => {
    set({ iconsWidgetSize: size });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveIconsWidgetState(currentProjectId, {
        enabled: state.iconsWidgetEnabled,
        position: state.iconsWidgetPosition,
        size,
        zIndex: state.iconsWidgetZIndex
      });
    }
  },

  loadIconsWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getIconsWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          iconsWidgetEnabled: result.widgetState.enabled,
          iconsWidgetPosition: result.widgetState.position,
          iconsWidgetSize: result.widgetState.size,
          iconsWidgetZIndex: result.widgetState.zIndex ?? 54
        });
      } else {
        // Reset to defaults if no saved state
        set({
          iconsWidgetEnabled: false,
          iconsWidgetPosition: { x: 5, y: 48 },
          iconsWidgetSize: { width: 420, height: 298 },
          iconsWidgetZIndex: 54
        });
      }
    } catch (error) {
      console.error('Failed to load Icons widget state:', error);
      // Reset to defaults on error
      set({
        iconsWidgetEnabled: false,
        iconsWidgetPosition: { x: 5, y: 48 },
        iconsWidgetSize: { width: 420, height: 298 },
        iconsWidgetZIndex: 54
      });
    }
  },

  // Chat widget functions
  setChatWidgetEnabled: (enabled) => {
    set({ chatWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveChatWidgetState(currentProjectId, {
        enabled,
        position: state.chatWidgetPosition,
        size: state.chatWidgetSize,
        zIndex: state.chatWidgetZIndex
      });
    }
  },

  setChatWidgetPosition: (position) => {
    set({ chatWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveChatWidgetState(currentProjectId, {
        enabled: state.chatWidgetEnabled,
        position,
        size: state.chatWidgetSize,
        zIndex: state.chatWidgetZIndex
      });
    }
  },

  setChatWidgetSize: (size) => {
    set({ chatWidgetSize: size });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveChatWidgetState(currentProjectId, {
        enabled: state.chatWidgetEnabled,
        position: state.chatWidgetPosition,
        size,
        zIndex: state.chatWidgetZIndex
      });
    }
  },

  loadChatWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getChatWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          chatWidgetEnabled: result.widgetState.enabled,
          chatWidgetPosition: result.widgetState.position,
          chatWidgetSize: result.widgetState.size,
          chatWidgetZIndex: result.widgetState.zIndex ?? 55
        });
      } else {
        // Reset to defaults if no saved state
        set({
          chatWidgetEnabled: false,
          chatWidgetPosition: { x: 5, y: 48 },
          chatWidgetSize: { width: 420, height: 550 },
          chatWidgetZIndex: 55
        });
      }
    } catch (error) {
      console.error('Failed to load Chat widget state:', error);
      // Reset to defaults on error
      set({
        chatWidgetEnabled: false,
        chatWidgetPosition: { x: 5, y: 48 },
        chatWidgetSize: { width: 420, height: 550 },
        chatWidgetZIndex: 55
      });
    }
  },

  // Background Remover widget functions
  setBackgroundRemoverWidgetEnabled: (enabled) => {
    set({ backgroundRemoverWidgetEnabled: enabled });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveBackgroundRemoverWidgetState(currentProjectId, {
        enabled,
        position: state.backgroundRemoverWidgetPosition,
        size: state.backgroundRemoverWidgetSize,
        zIndex: state.backgroundRemoverWidgetZIndex
      });
    }
  },

  setBackgroundRemoverWidgetPosition: (position) => {
    set({ backgroundRemoverWidgetPosition: position });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveBackgroundRemoverWidgetState(currentProjectId, {
        enabled: state.backgroundRemoverWidgetEnabled,
        position,
        size: state.backgroundRemoverWidgetSize,
        zIndex: state.backgroundRemoverWidgetZIndex
      });
    }
  },

  setBackgroundRemoverWidgetSize: (size) => {
    set({ backgroundRemoverWidgetSize: size });
    const currentProjectId = useAppStore.getState().currentProjectId;
    if (currentProjectId) {
      const state = get();
      debouncedSaveBackgroundRemoverWidgetState(currentProjectId, {
        enabled: state.backgroundRemoverWidgetEnabled,
        position: state.backgroundRemoverWidgetPosition,
        size,
        zIndex: state.backgroundRemoverWidgetZIndex
      });
    }
  },

  loadBackgroundRemoverWidgetState: async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.getBackgroundRemoverWidgetState(projectId);
      if (result?.success && result.widgetState) {
        set({
          backgroundRemoverWidgetEnabled: result.widgetState.enabled,
          backgroundRemoverWidgetPosition: result.widgetState.position,
          backgroundRemoverWidgetSize: result.widgetState.size,
          backgroundRemoverWidgetZIndex: result.widgetState.zIndex ?? 56
        });
      } else {
        // Reset to defaults if no saved state
        set({
          backgroundRemoverWidgetEnabled: false,
          backgroundRemoverWidgetPosition: { x: 20, y: 48 },
          backgroundRemoverWidgetSize: { width: 650, height: 450 },
          backgroundRemoverWidgetZIndex: 56
        });
      }
    } catch (error) {
      console.error('Failed to load Background Remover widget state:', error);
      // Reset to defaults on error
      set({
        backgroundRemoverWidgetEnabled: false,
        backgroundRemoverWidgetPosition: { x: 20, y: 48 },
        backgroundRemoverWidgetSize: { width: 650, height: 450 },
        backgroundRemoverWidgetZIndex: 56
      });
    }
  },

  // Unified bring to front for all widgets and sticky notes
  bringWidgetToFront: (widgetType, stickyNoteId) => {
    const state = get();
    const currentProjectId = useAppStore.getState().currentProjectId;

    // Collect all current z-indices
    const zIndices: { type: string; id?: string; zIndex: number }[] = [
      { type: 'kanban', zIndex: state.kanbanZIndex },
      { type: 'analytics', zIndex: state.analyticsWidgetZIndex },
      { type: 'projectAssets', zIndex: state.projectAssetsWidgetZIndex },
      { type: 'whiteboard', zIndex: state.whiteboardWidgetZIndex },
      { type: 'icons', zIndex: state.iconsWidgetZIndex },
      { type: 'chat', zIndex: state.chatWidgetZIndex },
      { type: 'backgroundRemover', zIndex: state.backgroundRemoverWidgetZIndex },
      ...state.stickyNotes.map(note => ({ type: 'stickyNote', id: note.id, zIndex: note.zIndex }))
    ];

    // Find the max z-index - CAP at 99 to stay below bottom section (z-150)
    const MAX_WIDGET_Z = 99;
    const maxZ = Math.max(...zIndices.map(z => z.zIndex), 49);
    let newTopZ = maxZ + 1;

    // If we've exceeded the cap, normalize all z-indices back to base range (50-99)
    if (newTopZ > MAX_WIDGET_Z) {
      // Sort by current z-index to preserve relative order
      const sorted = [...zIndices].sort((a, b) => a.zIndex - b.zIndex);
      const baseZ = 50;

      // Reassign z-indices starting from 50
      sorted.forEach((item, index) => {
        const normalizedZ = baseZ + index;
        if (item.type === 'kanban') set({ kanbanZIndex: normalizedZ });
        else if (item.type === 'analytics') set({ analyticsWidgetZIndex: normalizedZ });
        else if (item.type === 'projectAssets') set({ projectAssetsWidgetZIndex: normalizedZ });
        else if (item.type === 'whiteboard') set({ whiteboardWidgetZIndex: normalizedZ });
        else if (item.type === 'icons') set({ iconsWidgetZIndex: normalizedZ });
        else if (item.type === 'chat') set({ chatWidgetZIndex: normalizedZ });
        else if (item.type === 'backgroundRemover') set({ backgroundRemoverWidgetZIndex: normalizedZ });
        else if (item.type === 'stickyNote' && item.id) {
          set((s) => ({
            stickyNotes: s.stickyNotes.map(n => n.id === item.id ? { ...n, zIndex: normalizedZ } : n)
          }));
        }
      });

      // The clicked widget gets top position after normalization
      newTopZ = baseZ + sorted.length;
    }

    // Update the specific widget/sticky note
    if (widgetType === 'kanban') {
      set({ kanbanZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveKanbanState(currentProjectId, {
          enabled: state.kanbanEnabled,
          position: state.kanbanPosition,
          size: state.kanbanSize,
          columns: state.kanbanColumns,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'analytics') {
      set({ analyticsWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveAnalyticsWidgetState(currentProjectId, {
          enabled: state.analyticsWidgetEnabled,
          position: state.analyticsWidgetPosition,
          size: state.analyticsWidgetSize,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'projectAssets') {
      set({ projectAssetsWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveProjectAssetsWidgetState(currentProjectId, {
          enabled: state.projectAssetsWidgetEnabled,
          position: state.projectAssetsWidgetPosition,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'whiteboard') {
      set({ whiteboardWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveWhiteboardWidgetState(currentProjectId, {
          enabled: state.whiteboardWidgetEnabled,
          position: state.whiteboardWidgetPosition,
          size: state.whiteboardWidgetSize,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'icons') {
      set({ iconsWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveIconsWidgetState(currentProjectId, {
          enabled: state.iconsWidgetEnabled,
          position: state.iconsWidgetPosition,
          size: state.iconsWidgetSize,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'chat') {
      set({ chatWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveChatWidgetState(currentProjectId, {
          enabled: state.chatWidgetEnabled,
          position: state.chatWidgetPosition,
          size: state.chatWidgetSize,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'backgroundRemover') {
      set({ backgroundRemoverWidgetZIndex: newTopZ });
      if (currentProjectId) {
        debouncedSaveBackgroundRemoverWidgetState(currentProjectId, {
          enabled: state.backgroundRemoverWidgetEnabled,
          position: state.backgroundRemoverWidgetPosition,
          size: state.backgroundRemoverWidgetSize,
          zIndex: newTopZ
        });
      }
    } else if (widgetType === 'stickyNote' && stickyNoteId) {
      // Use the existing bringNoteToFront logic for sticky notes
      get().bringNoteToFront(stickyNoteId);
    }
  },

  // Preview hidden state
  previewHidden: false,
  setPreviewHidden: (hidden) => set({ previewHidden: hidden }),

  // Helpers
  isState: (state) => get().layoutState === state,

  isActionBarVisible: () => {
    const state = get().layoutState;
    return state === 'DEFAULT' || state === 'TOOLS';
  },
}));
