# Preview System - Technical Implementation Guide

## Overview
The preview system embeds the user's running application inside BeeSwarm using Electron's BrowserView, providing a native browser experience with DevTools, viewport controls, and automatic refresh capabilities.

---

## Architecture

### Components
- **BrowserView** (Electron): Embedded Chromium instance showing localhost
- **PreviewContainer** (React): UI wrapper managing BrowserView lifecycle
- **PreviewControls** (React): Toolbar with refresh, viewport, DevTools controls
- **PreviewService** (Main Process): Manages BrowserView lifecycle and IPC

### Flow
```
Main Window (Renderer)
    ↓
PreviewContainer component requests preview creation via IPC
    ↓
Main Process creates BrowserView
    ↓
BrowserView loads localhost:{port}
    ↓
Preview displayed overlaid on main window
    ↓
Controls overlay on top of BrowserView
```

---

## Implementation Steps

### 1. Main Process - BrowserView Management

**File:** `main/services/PreviewService.ts`

**Purpose:** Create, manage, and destroy BrowserView instances

**Key Methods:**
- `createPreview(url, bounds)` - Create new BrowserView
- `updateBounds(bounds)` - Resize/reposition BrowserView
- `refresh()` - Reload preview
- `toggleDevTools()` - Open/close DevTools
- `destroy()` - Clean up BrowserView
- `handleNavigation(url)` - Intercept navigation, open external links in system browser

**Implementation Details:**

**Creating BrowserView:**
- Use `new BrowserView()` with webPreferences:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `webSecurity: true`
- Attach to main window with `mainWindow.setBrowserView(browserView)`
- Set bounds with `browserView.setBounds({ x, y, width, height })`
- Load URL with `browserView.webContents.loadURL(url)`

**Bounds Calculation:**
- Leave space at bottom for action bar (60px)
- Calculate: `{ x: 0, y: 0, width: windowWidth, height: windowHeight - 60 }`
- Update on window resize event

**Navigation Handling:**
- Listen to `will-navigate` event on webContents
- Check if URL is external (not localhost)
- If external: prevent navigation, open in system browser with `shell.openExternal(url)`
- If localhost: allow navigation

**DevTools:**
- Toggle with `browserView.webContents.toggleDevTools()`
- Open in detached mode for better UX
- Remember state (open/closed) in store

**Console Monitoring:**
- Listen to `console-message` event
- Parse console.log, console.error, console.warn
- Store in array for error detection
- Send to renderer for display in chat modal

**Lifecycle:**
- Create when dev servers start
- Destroy on project close
- Recreate on dev server restart
- Handle crashes with `render-process-gone` event

---

### 2. IPC Handlers

**File:** `main/ipc/preview.ts`

**Handlers:**

**create-preview**
- Input: `{ url: string, bounds: { x, y, width, height } }`
- Action: Call PreviewService.createPreview()
- Output: `{ success: boolean }`

**update-preview-bounds**
- Input: `{ bounds: { x, y, width, height } }`
- Action: Call PreviewService.updateBounds()
- Used when: Window resizes, viewport size changes

**refresh-preview**
- Input: none
- Action: Call PreviewService.refresh()

**toggle-devtools**
- Input: none
- Action: Call PreviewService.toggleDevTools()

**destroy-preview**
- Input: none
- Action: Call PreviewService.destroy()

**set-viewport-size**
- Input: `{ size: 'mobile' | 'tablet' | 'desktop' }`
- Action: Calculate new bounds based on viewport, update BrowserView

---

### 3. Renderer - PreviewContainer Component

**File:** `renderer/components/Preview/PreviewContainer.tsx`

**Purpose:** React component that manages preview UI and lifecycle

**State:**
- `isLoading: boolean` - Show loading spinner
- `hasError: boolean` - Show error state
- `url: string` - Current preview URL
- `viewportSize: 'mobile' | 'tablet' | 'desktop'` - Current viewport
- `devToolsOpen: boolean` - DevTools state

**Lifecycle:**

**On Mount:**
- Get frontend port from project store
- Calculate bounds
- Send IPC: create-preview with `http://localhost:{port}`
- Show loading state
- Listen for `preview-ready` event from main process
- Hide loading, show preview

**On Unmount:**
- Send IPC: destroy-preview
- Clean up event listeners

**On Window Resize:**
- Debounce resize events (300ms)
- Recalculate bounds
- Send IPC: update-preview-bounds

**On Viewport Change:**
- Calculate new bounds based on viewport size:
  - Mobile: 375x667 (iPhone size)
  - Tablet: 768x1024 (iPad size)
  - Desktop: Full window minus action bar
- Center viewport if smaller than window
- Send IPC: set-viewport-size

**JSX Structure:**
```
<div className="preview-container">
  {isLoading && <LoadingSpinner />}
  {hasError && <ErrorState />}
  <PreviewControls 
    onRefresh={handleRefresh}
    onViewportChange={handleViewportChange}
    onToggleDevTools={handleToggleDevTools}
    viewportSize={viewportSize}
    devToolsOpen={devToolsOpen}
  />
  {/* BrowserView renders here, managed by main process */}
</div>
```

---

### 4. Preview Controls Component

**File:** `renderer/components/Preview/PreviewControls.tsx`

**Purpose:** Toolbar overlay with controls

**Controls:**

**Refresh Button:**
- Icon: ↻
- Action: Send IPC: refresh-preview
- Tooltip: "Refresh preview (Cmd+R)"

**Viewport Selector:**
- Dropdown with options: Mobile, Tablet, Desktop
- Shows current selection
- On change: Call onViewportChange prop
- Shows device icon + dimensions

**DevTools Toggle:**
- Icon: 🔧
- Action: Send IPC: toggle-devtools
- Tooltip: "Open DevTools (F12)"
- Highlight when open

**URL Display (optional):**
- Shows current route (e.g., "/", "/about")
- Read-only
- Click to copy

**Position:**
- Fixed at top of preview area
- Semi-transparent background (blur effect)
- Fade out after 3 seconds of no interaction
- Show on mouse hover

---

### 5. Viewport Size Calculations

**Preset Sizes:**
```
Mobile (iPhone 13):
  width: 390px
  height: 844px

Tablet (iPad):
  width: 820px
  height: 1180px

Desktop:
  width: window.innerWidth
  height: window.innerHeight - 60 (action bar height)
```

**Bounds Calculation Function:**
```
calculateBounds(viewportSize, windowSize) {
  const actionBarHeight = 60;
  const availableHeight = windowSize.height - actionBarHeight;
  
  if (viewportSize === 'desktop') {
    return {
      x: 0,
      y: 0,
      width: windowSize.width,
      height: availableHeight
    };
  }
  
  // Mobile or Tablet - center in window
  const presetWidth = viewportSize === 'mobile' ? 390 : 820;
  const presetHeight = viewportSize === 'mobile' ? 844 : 1180;
  
  // Scale down if doesn't fit
  let width = presetWidth;
  let height = presetHeight;
  
  if (width > windowSize.width) {
    const scale = windowSize.width / width;
    width = windowSize.width;
    height = height * scale;
  }
  
  if (height > availableHeight) {
    const scale = availableHeight / height;
    height = availableHeight;
    width = width * scale;
  }
  
  // Center
  const x = (windowSize.width - width) / 2;
  const y = (availableHeight - height) / 2;
  
  return { x, y, width, height };
}
```

---

### 6. Error Handling

**Scenarios:**

**Dev Server Not Running:**
- BrowserView shows "Cannot connect" error
- Detect with `did-fail-load` event
- Show overlay: "Starting dev server..." with spinner
- Retry connection every 2 seconds
- Max 10 retries, then show error

**Page Crash:**
- Listen to `render-process-gone` event
- Show overlay: "Preview crashed. Refreshing..."
- Auto-refresh after 2 seconds

**Navigation Errors:**
- 404 pages: Allow (part of user's app)
- Network errors: Show "Connection lost" overlay
- CORS errors: Log to console, don't block

**Console Errors:**
- Capture all console.error messages
- Store in array (max 100 recent)
- Available for error detection loop
- Display in chat modal if user wants to see

---

### 7. Auto-Refresh Strategy

**When to Refresh:**
- After Claude makes changes and dev servers restart
- When user clicks refresh button
- After error recovery
- When switching projects

**How to Refresh:**
- Send IPC to main process
- Main process calls `browserView.webContents.reload()`
- Show loading overlay during refresh
- Wait for `did-finish-load` event
- Remove loading overlay

**Smart Refresh (preserve state):**
- Inject script before unload to save state (scroll position, form inputs)
- Store in previewStore
- After reload, inject script to restore state
- Only for dev mode (not production preview)

---

### 8. DevTools Integration

**Opening DevTools:**
- Call `webContents.openDevTools({ mode: 'detach' })`
- Opens in separate window
- Better UX than docked mode

**Features Available:**
- Console (see user's app logs)
- Elements (inspect HTML/CSS)
- Network (see API calls)
- Sources (debug JavaScript)
- Application (view localStorage, cookies)

**State Management:**
- Remember if user had DevTools open
- Store in previewStore
- Restore on project reopen

---

### 9. Performance Optimization

**Debouncing:**
- Window resize events: 300ms debounce
- Viewport changes: immediate (no debounce)

**Memory Management:**
- Destroy BrowserView when switching projects
- Clear console message array when too large (>100 items)
- Remove event listeners on unmount

**Lazy Loading:**
- Don't create BrowserView until dev servers are ready
- Show placeholder while waiting

---

### 10. Keyboard Shortcuts

**Register in Main Process:**
- `Cmd/Ctrl + R` - Refresh preview
- `F12` - Toggle DevTools
- `Cmd/Ctrl + 1` - Mobile viewport
- `Cmd/Ctrl + 2` - Tablet viewport
- `Cmd/Ctrl + 3` - Desktop viewport

---

### 11. Testing Checklist

**Manual Tests:**
- [ ] Create preview with localhost URL
- [ ] Preview loads and displays correctly
- [ ] Refresh button works
- [ ] Viewport switching works (mobile/tablet/desktop)
- [ ] DevTools toggle works (F12)
- [ ] External links open in system browser
- [ ] Internal navigation works (SPA routing)
- [ ] Window resize updates preview bounds
- [ ] Preview persists on window minimize/restore
- [ ] Error overlay shows when dev server stops
- [ ] Auto-refresh after Claude edits works
- [ ] Console messages captured correctly
- [ ] Preview destroyed on project close
- [ ] Multiple projects can be opened (one preview at a time)

**Edge Cases:**
- [ ] Handle dev server crash during preview
- [ ] Handle extremely small window sizes
- [ ] Handle localhost CORS issues
- [ ] Handle SSL certificate warnings (if using https)
- [ ] Handle long-running page loads (timeout)

---

### 12. Future Enhancements

- Device frame UI (show phone/tablet bezels)
- Network throttling controls (3G, 4G, Offline)
- Screenshot capture of preview
- Video recording of preview
- Responsive design mode (drag to resize)
- Multiple viewports side-by-side
- Touch event simulation for mobile testing
- Geolocation spoofing
- Dark mode preview toggle