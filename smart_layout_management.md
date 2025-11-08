# BrowserView Layout Architecture

## Overview
The IDE uses a state-based layout system where a BrowserView (Chromium preview) and IDE interface elements coordinate through programmatic bounds management and visibility toggling.

## View States

### BROWSER_FULL
- BrowserView occupies entire window
- Action bar hidden
- Status sheet hidden
- User focuses on preview/testing their app

### IDE_ACTIVE
- Action bar visible at bottom
- BrowserView shrinks to area above action bar
- Status sheet can open (when open, BrowserView becomes thumbnail)
- User focuses on AI commands and system activities

### MODAL_OPEN
- Temporary state for help modal, profile popup, etc.
- BrowserView hidden or dimmed with overlay
- Returns to previous state when modal closes

## Keyboard Navigation

**Tab Key**: Primary toggle between BROWSER_FULL ↔ IDE_ACTIVE
- Implemented via Electron's globalShortcut (works even when BrowserView has focus)
- Default browser tab-cycling behavior is disabled (not needed in IDE context)
- No tab functionality inside BrowserView itself (users can "Open in Chrome" if needed)

## Layout Coordination Rules

**When Action Bar shows**: BrowserView bounds adjusted to start below it

**When Status Sheet opens**: 
- BrowserView hidden
- Thumbnail preview shown in top-left corner (captured from BrowserView)

**When Modals open**: BrowserView temporarily hidden or dimmed

**When user clicks back to preview area**: Return to appropriate state based on previous context

## BrowserView Capabilities

**Process Isolation**: User code bugs cannot crash the IDE

**DevTools Access**: Can be opened programmatically for debugging

**Console Capture**: console-message events forwarded to status sheet and Claude for debugging loop

**Crash Recovery**: If user's app crashes, only BrowserView process dies, IDE stays functional

## User Discoverability

- Visual indicator in action bar showing "Press Tab for full preview"
- Help modal explains keyboard shortcuts
- First-run tutorial covers view switching

## Benefits

- True process isolation prevents user code from crashing IDE
- Clean separation between preview and IDE interactions
- Programmatic control over layout eliminates z-index issues
- Console logs and DevTools integrated for debugging workflow