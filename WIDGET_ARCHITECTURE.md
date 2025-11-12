# Widget Architecture Guide

This guide explains how to create new draggable, resizable, and persistent widgets in the application, following the Kanban widget pattern.

## Architecture Overview

The widget system consists of 5 layers:

1. **Database Layer** - Stores widget state per-project
2. **IPC Layer** - Electron handlers for save/load operations
3. **State Management** - Zustand store for reactive state
4. **Component Layer** - React component with drag/resize logic
5. **Integration Layer** - Mounting and visibility control

---

## Step-by-Step Guide: Creating a New Widget

Let's create an example "Notes Widget" following the same pattern as Kanban.

### 1. Database Layer

**File:** `electron/services/DatabaseService.ts`

#### A. Add Interface

```typescript
export interface NotesWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  notes: Array<{
    id: string
    title: string
    content: string
    createdAt: number
  }>
}
```

#### B. Update Project Interface

```typescript
export interface Project {
  // ... existing fields
  notesWidgetState: string | null // JSON string
}
```

#### C. Add Migration

In `runMigrations()`:

```typescript
// Migration X: Add notesWidgetState column
const hasNotesWidgetState = tableInfo.some(col => col.name === 'notesWidgetState')
if (!hasNotesWidgetState) {
  this.db.exec('ALTER TABLE projects ADD COLUMN notesWidgetState TEXT')
}
```

#### D. Add Save/Load Methods

```typescript
/**
 * Save Notes widget state for a project
 */
saveNotesWidgetState(projectId: string, widgetState: NotesWidgetState): void {
  if (!this.db) {
    console.warn('⚠️ Attempted to save Notes widget state after database closed - ignoring')
    return
  }

  const stateJson = JSON.stringify(widgetState)
  const sql = 'UPDATE projects SET notesWidgetState = ? WHERE id = ?'

  try {
    this.db.prepare(sql).run(stateJson, projectId)
  } catch (error) {
    console.error('❌ Failed to save Notes widget state:', error)
    throw error
  }
}

/**
 * Get Notes widget state for a project
 */
getNotesWidgetState(projectId: string): NotesWidgetState | null {
  if (!this.db) {
    throw new Error('Database not initialized')
  }

  const project = this.getProjectById(projectId)
  if (!project?.notesWidgetState) {
    return null
  }

  try {
    return JSON.parse(project.notesWidgetState) as NotesWidgetState
  } catch (error) {
    console.error('❌ Failed to parse Notes widget state:', error)
    return null
  }
}
```

---

### 2. IPC Layer

**File:** `electron/handlers/projectHandlers.ts`

Add handlers in `registerProjectHandlers()`:

```typescript
// Save Notes widget state
ipcMain.handle('project:save-notes-widget-state', async (_event, projectId: string, widgetState: NotesWidgetState) => {
  try {
    // SECURITY: Validate user owns this project
    validateProjectOwnership(projectId)

    databaseService.saveNotesWidgetState(projectId, widgetState)

    return {
      success: true
    }
  } catch (error) {
    console.error('❌ Error saving Notes widget state:', error)

    if (error instanceof UnauthorizedError) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save Notes widget state'
    }
  }
})

// Get Notes widget state
ipcMain.handle('project:get-notes-widget-state', async (_event, projectId: string) => {
  try {
    // SECURITY: Validate user owns this project
    validateProjectOwnership(projectId)

    const widgetState = databaseService.getNotesWidgetState(projectId)

    return {
      success: true,
      widgetState
    }
  } catch (error) {
    console.error('❌ Error getting Notes widget state:', error)

    if (error instanceof UnauthorizedError) {
      return {
        success: false,
        error: 'Unauthorized'
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Notes widget state'
    }
  }
})
```

---

### 3. Preload API

**File:** `electron/preload.js`

Add methods to the `projects` object:

```javascript
projects: {
  // ... existing methods
  saveNotesWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-notes-widget-state', id, widgetState),
  getNotesWidgetState: (id) => ipcRenderer.invoke('project:get-notes-widget-state', id)
}
```

---

### 4. TypeScript Definitions

**File:** `src/types/electron.d.ts`

Add type definitions to the `projects` interface:

```typescript
projects: {
  // ... existing methods
  saveNotesWidgetState: (id: string, widgetState: {
    enabled: boolean;
    position: { x: number; y: number };
    size: { width: number; height: number };
    notes: Array<{
      id: string;
      title: string;
      content: string;
      createdAt: number;
    }>;
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  getNotesWidgetState: (id: string) => Promise<{
    success: boolean;
    widgetState?: {
      enabled: boolean;
      position: { x: number; y: number };
      size: { width: number; height: number };
      notes: Array<{
        id: string;
        title: string;
        content: string;
        createdAt: number;
      }>;
    } | null;
    error?: string;
  }>;
}
```

---

### 5. State Management

**File:** `src/store/layoutStore.ts`

#### A. Add State Interface

```typescript
interface LayoutStoreState {
  // ... existing fields

  // Notes widget state
  notesWidgetEnabled: boolean;
  setNotesWidgetEnabled: (enabled: boolean) => void;
  notesWidgetPosition: { x: number; y: number };
  setNotesWidgetPosition: (position: { x: number; y: number }) => void;
  notesWidgetSize: { width: number; height: number };
  setNotesWidgetSize: (size: { width: number; height: number }) => void;
  notesWidgetData: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>;
  setNotesWidgetData: (data: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }> | ((prev: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>) => Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>)) => void;
  loadNotesWidgetState: (projectId: string) => Promise<void>;
}
```

#### B. Add Debounced Save Helper

```typescript
// Debounce helper for saving Notes widget state
let saveNotesTimeout: NodeJS.Timeout | null = null;
const debouncedSaveNotesWidgetState = (projectId: string, widgetState: {
  enabled: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  notes: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: number;
  }>;
}) => {
  if (saveNotesTimeout) {
    clearTimeout(saveNotesTimeout);
  }

  saveNotesTimeout = setTimeout(async () => {
    try {
      await window.electronAPI?.projects.saveNotesWidgetState(projectId, widgetState);
    } catch (error) {
      console.error('Failed to save Notes widget state:', error);
    }
  }, 500); // 500ms debounce
};
```

#### C. Add Initial State

```typescript
export const useLayoutStore = create<LayoutStoreState>((set, get) => ({
  // ... existing state

  notesWidgetEnabled: false,
  notesWidgetPosition: { x: 940, y: 43 }, // Position next to Kanban
  notesWidgetSize: { width: 400, height: 600 },
  notesWidgetData: [],

  // ... setters below
}))
```

#### D. Add Setters

```typescript
setNotesWidgetEnabled: (enabled) => {
  set({ notesWidgetEnabled: enabled });
  const currentProjectId = useAppStore.getState().currentProjectId;
  if (currentProjectId) {
    const state = get();
    debouncedSaveNotesWidgetState(currentProjectId, {
      enabled,
      position: state.notesWidgetPosition,
      size: state.notesWidgetSize,
      notes: state.notesWidgetData
    });
  }
},

setNotesWidgetPosition: (position) => {
  set({ notesWidgetPosition: position });
  const currentProjectId = useAppStore.getState().currentProjectId;
  if (currentProjectId) {
    const state = get();
    debouncedSaveNotesWidgetState(currentProjectId, {
      enabled: state.notesWidgetEnabled,
      position,
      size: state.notesWidgetSize,
      notes: state.notesWidgetData
    });
  }
},

setNotesWidgetSize: (size) => {
  set({ notesWidgetSize: size });
  const currentProjectId = useAppStore.getState().currentProjectId;
  if (currentProjectId) {
    const state = get();
    debouncedSaveNotesWidgetState(currentProjectId, {
      enabled: state.notesWidgetEnabled,
      position: state.notesWidgetPosition,
      size,
      notes: state.notesWidgetData
    });
  }
},

setNotesWidgetData: (dataOrUpdater) => {
  const newData = typeof dataOrUpdater === 'function'
    ? dataOrUpdater(get().notesWidgetData || [])
    : dataOrUpdater;

  set({ notesWidgetData: newData });

  const currentProjectId = useAppStore.getState().currentProjectId;
  if (currentProjectId) {
    const state = get();
    debouncedSaveNotesWidgetState(currentProjectId, {
      enabled: state.notesWidgetEnabled,
      position: state.notesWidgetPosition,
      size: state.notesWidgetSize,
      notes: newData
    });
  }
},

loadNotesWidgetState: async (projectId: string) => {
  try {
    const result = await window.electronAPI?.projects.getNotesWidgetState(projectId);
    if (result?.success && result.widgetState) {
      set({
        notesWidgetEnabled: result.widgetState.enabled,
        notesWidgetPosition: result.widgetState.position,
        notesWidgetSize: result.widgetState.size,
        notesWidgetData: result.widgetState.notes
      });
    } else {
      // Reset to defaults if no saved state
      set({
        notesWidgetEnabled: false,
        notesWidgetPosition: { x: 940, y: 43 },
        notesWidgetSize: { width: 400, height: 600 },
        notesWidgetData: []
      });
    }
  } catch (error) {
    console.error('Failed to load Notes widget state:', error);
    // Reset to defaults on error
    set({
      notesWidgetEnabled: false,
      notesWidgetPosition: { x: 940, y: 43 },
      notesWidgetSize: { width: 400, height: 600 },
      notesWidgetData: []
    });
  }
},
```

---

### 6. Widget Component

**File:** `src/components/NotesWidget.tsx`

```typescript
import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

type ResizeDirection = 's' | 'n' | 'e' | 'w' | null

function NotesWidget() {
  const {
    notesWidgetPosition,
    setNotesWidgetPosition,
    notesWidgetSize,
    setNotesWidgetSize,
    setNotesWidgetEnabled,
    notesWidgetData,
    setNotesWidgetData
  } = useLayoutStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const MIN_WIDTH = 300
  const MAX_WIDTH = 800
  const MIN_HEIGHT = 400
  const MAX_HEIGHT = 900

  // Use data from layoutStore with fallback
  const notes = Array.isArray(notesWidgetData) ? notesWidgetData : []

  const addNote = () => {
    const newNote = {
      id: Date.now().toString(),
      title: 'New Note',
      content: '',
      createdAt: Date.now()
    }

    setNotesWidgetData((prev = []) => [...prev, newNote])
  }

  const deleteNote = (id: string) => {
    setNotesWidgetData((prev = []) => prev.filter(note => note.id !== id))
  }

  const updateNote = (id: string, updates: { title?: string; content?: string }) => {
    setNotesWidgetData((prev = []) =>
      prev.map(note => note.id === id ? { ...note, ...updates } : note)
    )
  }

  // Drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) return

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - notesWidgetPosition.x,
      y: e.clientY - notesWidgetPosition.y
    })
  }

  // Resize logic
  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: notesWidgetSize.width,
      height: notesWidgetSize.height
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        const padding = 3
        const headerHeight = 40 + padding
        const minX = padding
        const maxX = window.innerWidth - notesWidgetSize.width - padding
        const minY = headerHeight
        const maxY = window.innerHeight - notesWidgetSize.height - padding

        setNotesWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = notesWidgetPosition.x
        let newY = notesWidgetPosition.y

        if (resizeDirection === 'e') {
          newWidth = resizeStart.width + deltaX
        }
        if (resizeDirection === 'w') {
          newWidth = resizeStart.width - deltaX
          newX = notesWidgetPosition.x + deltaX
        }
        if (resizeDirection === 's') {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection === 'n') {
          newHeight = resizeStart.height - deltaY
          newY = notesWidgetPosition.y + deltaY
        }

        // Apply constraints
        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        setNotesWidgetSize({ width: newWidth, height: newHeight })

        if (resizeDirection === 'w' || resizeDirection === 'n') {
          setNotesWidgetPosition({ x: newX, y: newY })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, notesWidgetPosition, notesWidgetSize, setNotesWidgetPosition, setNotesWidgetSize])

  return (
    <div
      ref={widgetRef}
      className="fixed z-[95] bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        left: `${notesWidgetPosition.x}px`,
        top: `${notesWidgetPosition.y}px`,
        width: `${notesWidgetSize.width}px`,
        height: `${notesWidgetSize.height}px`
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      {/* Header */}
      <div
        ref={headerRef}
        onMouseDown={handleMouseDown}
        className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-dark-border/50 cursor-move bg-dark-bg/30"
      >
        <h3 className="text-sm font-semibold text-gray-200">Notes</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={addNote}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-colors"
            title="Add Note"
          >
            <Plus size={14} className="text-gray-400" />
          </button>
          <button
            onClick={() => setNotesWidgetEnabled(false)}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-colors"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-4 overflow-y-auto scrollbar-thin" style={{ height: `calc(${notesWidgetSize.height}px - 56px)` }}>
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No notes yet. Click + to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div
                key={note.id}
                className="bg-dark-bg/30 border border-dark-border/50 rounded-lg p-3 hover:border-primary/30 transition-all"
              >
                <input
                  type="text"
                  value={note.title}
                  onChange={(e) => updateNote(note.id, { title: e.target.value })}
                  className="w-full bg-transparent text-sm font-medium text-gray-200 border-none outline-none mb-2"
                  placeholder="Note title"
                />
                <textarea
                  value={note.content}
                  onChange={(e) => updateNote(note.id, { content: e.target.value })}
                  className="w-full bg-transparent text-xs text-gray-400 border-none outline-none resize-none"
                  placeholder="Note content..."
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-border/30">
                  <span className="text-[10px] text-gray-500">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resize Handles */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'n')}
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 's')}
        className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'e')}
        className="absolute top-0 right-0 bottom-0 w-1 cursor-ew-resize"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'w')}
        className="absolute top-0 left-0 bottom-0 w-1 cursor-ew-resize"
      />
    </div>
  )
}

export default NotesWidget
```

---

### 7. Integration

#### A. Add Toggle to ActionBar

**File:** `src/components/ActionBar.tsx`

```typescript
// Import the state
const {
  // ... existing
  notesWidgetEnabled,
  setNotesWidgetEnabled
} = useLayoutStore()

// Add icon/button to toggle (example in TOOLS mode UI)
<button
  onClick={() => setNotesWidgetEnabled(!notesWidgetEnabled)}
  className={`p-2 rounded-lg transition-colors ${
    notesWidgetEnabled ? 'bg-primary/20 text-primary' : 'hover:bg-dark-bg/50 text-gray-400'
  }`}
  title="Toggle Notes"
>
  <FileText size={18} />
</button>
```

#### B. Render Widget

**File:** `src/components/ProjectView.tsx`

```typescript
// Import
import NotesWidget from './NotesWidget'

// Get state
const {
  // ... existing
  notesWidgetEnabled,
  loadNotesWidgetState
} = useLayoutStore()

// Load state when project changes
useEffect(() => {
  if (currentProjectId) {
    loadKanbanState(currentProjectId)
    loadNotesWidgetState(currentProjectId) // Add this
  }
}, [currentProjectId, loadKanbanState, loadNotesWidgetState])

// Render conditionally
{/* Notes Widget */}
{notesWidgetEnabled && layoutState === 'TOOLS' && <NotesWidget />}
```

---

## Key Patterns to Follow

### 1. **State Persistence**
- Always use **debounced saves** (500ms recommended)
- Save on: enable/disable, position change, size change, data change
- Load on: project switch

### 2. **Race Condition Prevention**
- Use `get()` to access current state in setters
- Check `currentProjectId` exists before saving
- Handle undefined/null gracefully with fallbacks

### 3. **Drag & Resize**
- Use `onMouseDown` on header for drag
- Calculate boundaries with padding (3px recommended)
- Support min/max constraints
- Stop propagation on interactive elements

### 4. **Visibility Logic**
```typescript
{widgetEnabled && layoutState === 'TOOLS' && <Widget />}
```
- Widget shows ONLY when enabled AND in correct layout state
- Don't reset `enabled` when changing layout states

### 5. **Data Updates**
- Support both direct values and updater functions
- Always provide fallback empty arrays/objects
- Use `Array.isArray()` checks before mapping

### 6. **Security**
- Always validate project ownership in IPC handlers
- Use `validateProjectOwnership()` middleware
- Gracefully handle database closure on shutdown

---

## Testing Checklist

For each new widget, verify:

- [ ] Toggle persists when cycling layout states (Tab)
- [ ] Toggle persists when closing/reopening app
- [ ] Position persists per-project
- [ ] Size persists per-project
- [ ] Data persists per-project
- [ ] Dragging respects viewport boundaries
- [ ] Resizing respects min/max constraints
- [ ] Widget only shows in intended layout state(s)
- [ ] Multiple widgets don't interfere with each other
- [ ] Database migrations run successfully
- [ ] IPC handlers validate project ownership

---

## Widget Positioning Guide

To avoid overlaps, use these default positions:

- **Kanban**: `x: 20, y: 43` (left side)
- **Notes**: `x: 940, y: 43` (right of Kanban)
- **Calendar**: `x: 1360, y: 43` (right of Notes)
- **Tasks**: `x: 20, y: 473` (below Kanban)

Adjust based on your default widget sizes.

---

## Common Pitfalls

1. **Forgetting to import `useAppStore`** in layoutStore.ts
2. **Not handling undefined data** in component render
3. **Resetting enabled state** when changing layout states
4. **Missing Array.isArray()** checks before `.map()`
5. **Not using updater functions** in setters that need previous state
6. **Forgetting to load state** in ProjectView useEffect

---

## Performance Considerations

- **Debouncing**: Prevents excessive database writes (use 500ms)
- **Memoization**: Consider `useMemo` for expensive calculations
- **Conditional Rendering**: Only mount widgets when visible
- **Event Cleanup**: Always remove event listeners in useEffect cleanup

---

## Future Enhancements

Consider adding:
- **Widget presets**: Save/load workspace configurations
- **Grid snapping**: Align widgets to invisible grid
- **Z-index management**: Bring widget to front on click
- **Minimize/maximize**: Collapse widgets to save space
- **Widget marketplace**: Share custom widgets between users
- **Keyboard shortcuts**: Quick toggle widgets (Cmd+K for Kanban, etc.)

---

This architecture scales to unlimited widgets while maintaining performance and data integrity across projects and sessions.
