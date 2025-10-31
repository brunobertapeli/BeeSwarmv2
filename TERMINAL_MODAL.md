# Terminal Modal - Implementation Guide

## Overview
Beautiful, full-featured terminal modal that displays Claude Code SDK output in a professional xterm.js-style interface. Opens from the Console icon in the ActionBar.

## Features

### Visual Design
- **Large modal:** 900px × 600px (resizable to 95vw × 90vh when maximized)
- **Dark terminal theme:** `#0a0e14` background (VS Code-like)
- **Monospace font:** Professional terminal appearance
- **Color-coded output:** Different colors for different message types
- **Hover timestamps:** Shows exact time for each line
- **Auto-scroll:** Automatically scrolls to newest output
- **Animated cursor:** Pulsing cursor at the bottom
- **Custom scrollbar:** Beautiful thin scrollbar

### Terminal Header
- **Terminal icon** with primary color accent
- **Title:** "Terminal"
- **Subtitle:** "Claude Code SDK Output"
- **Control buttons:**
  - Copy (all output to clipboard)
  - Clear (wipes terminal)
  - Stop (stops Claude execution)
  - Maximize/Minimize
  - Close

### Terminal Content
- **Color-coded lines:**
  - 🟦 User messages: Blue (`text-blue-400`)
  - ⚪ Assistant messages: White
  - ⚫ Tool actions: Gray (`text-gray-400`)
  - 🟢 Success: Green (`text-primary`)
  - 🔴 Errors: Red (`text-red-400`)
  - ⚪ Info: Light gray (`text-gray-500`)

- **Timestamps:** Hover over any line to see exact time
- **Auto-scroll:** Always shows latest output
- **Scrollable:** Can scroll up to see history

### Terminal Footer
- **Stats:** Line count and connection status
- **Keyboard hint:** "Press ESC to close"

## User Experience

### Opening Terminal
1. Click Console icon (Terminal) in ActionBar
2. Terminal modal slides in with scale animation
3. Shows full conversation history
4. Cursor animates at bottom

### Using Terminal
- **Read output:** Scroll through all messages
- **Copy output:** Click Copy button (shows checkmark)
- **Clear terminal:** Click Trash icon
- **Stop execution:** Click Square icon (when Claude is working)
- **Maximize:** Click Maximize icon (fills 95% of screen)
- **Close:** Click X, press ESC, or click backdrop

### Terminal Output Format

```
10:23:45  $ BeeSwarm Terminal v1.0.0
10:23:46  $ Connected to Claude Code SDK
10:23:47  > User: Add a dark mode toggle to the settings page
10:23:48  I'll help you add a dark mode toggle. Let me first check the current settings page structure.
10:23:49  ⚙ Reading file: src/pages/Settings.tsx
10:23:50  ⚙ Reading file: src/context/ThemeContext.tsx
10:23:51  I found the theme context. Now I'll add the toggle component.
10:23:52  ⚙ Writing changes to src/pages/Settings.tsx
10:23:53  ⚙ Creating new file: src/components/DarkModeToggle.tsx
10:23:54  ✓ Dark mode toggle has been added to the settings page.
10:23:55  ⚙ Committed changes: "feat: add dark mode toggle to settings"
10:23:56  ✓ Task completed successfully
          $ _
```

## Component Structure

### Props
```tsx
interface TerminalModalProps {
  isOpen: boolean          // Show/hide modal
  onClose: () => void      // Close handler
  onStop?: () => void      // Stop execution handler (optional)
}
```

### State
```tsx
interface TerminalLine {
  type: 'user' | 'assistant' | 'tool' | 'success' | 'error' | 'info'
  content: string
  timestamp: Date
}

const [history, setHistory] = useState<TerminalLine[]>([])
const [isMaximized, setIsMaximized] = useState(false)
const [isCopied, setIsCopied] = useState(false)
```

## Controls

### Copy Button
- Icon: Copy → Check (when copied)
- Action: Copies all terminal output to clipboard
- Feedback: Shows checkmark for 2 seconds

### Clear Button
- Icon: Trash2
- Action: Clears all history, shows "$ Terminal cleared"
- Hover: Yellow color

### Stop Button
- Icon: Square (filled)
- Action: Stops Claude Code SDK execution
- Hover: Red color
- Only visible when execution is active

### Maximize/Minimize Button
- Icon: Maximize2 ↔ Minimize2
- Action: Toggles between 900×600 and 95vw×90vh
- Smooth transition

### Close Button
- Icon: X
- Action: Closes modal
- Keyboard: ESC key

## Visual States

### Normal Size
- Width: 900px
- Height: 600px
- Centered on screen

### Maximized
- Width: 95vw
- Height: 90vh
- Smooth transition

### Copy State
- Copy icon → Check icon (green)
- Auto-reverts after 2 seconds

## Mock Data

Shows realistic conversation history:
- Terminal startup message
- SDK connection confirmation
- User prompt
- Assistant responses
- Tool actions
- Success/error messages
- Commit messages

## Keyboard Shortcuts

- **ESC** - Close terminal
- More shortcuts can be added (Cmd+K to clear, etc.)

## Technical Details

### Auto-Scroll Implementation
```tsx
const terminalEndRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (terminalEndRef.current) {
    terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }
}, [history])
```

### Timestamp Display
- Hidden by default
- Shows on hover (group-hover)
- Format: HH:MM:SS (24-hour)

### Color Coding
```tsx
const getLineColor = (type) => {
  switch (type) {
    case 'user': return 'text-blue-400'
    case 'assistant': return 'text-white'
    case 'tool': return 'text-gray-400'
    case 'success': return 'text-primary'
    case 'error': return 'text-red-400'
    case 'info': return 'text-gray-500'
  }
}
```

### Custom Scrollbar
```css
.terminal-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.terminal-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
```

## Integration

### AppStore
```tsx
showTerminal: boolean
setShowTerminal: (show: boolean) => void
```

### ActionBar
Console button opens terminal:
```tsx
<button onClick={onConsoleClick}>
  <Terminal size={15} />
</button>
```

### ProjectView
```tsx
const handleConsoleClick = () => {
  setShowTerminal(true)
}

<TerminalModal
  isOpen={showTerminal}
  onClose={() => setShowTerminal(false)}
  onStop={() => console.log('Stopping...')}
/>
```

## Future Enhancements

### When Integrating Real xterm.js
1. Replace mock history with real PTY output
2. Stream data in real-time
3. Add ANSI color support
4. Enable user input (interactive mode)
5. Add search functionality
6. Export logs to file
7. Filter by message type

### Possible Features
- **Tabs:** Multiple terminal sessions
- **Split view:** Side-by-side terminals
- **Themes:** Light/dark/custom color schemes
- **Font size:** Adjustable text size
- **Search:** Ctrl+F to find in output
- **Export:** Download logs as .txt
- **Filter:** Toggle message types on/off

## Styling

### Colors
- Background: `#0a0e14` (terminal black)
- Header: `bg-dark-bg/50`
- Border: `border-dark-border`
- Accent: `text-primary` (green)

### Fonts
- Terminal content: `font-mono`
- Headers: Default app font

### Animations
- Modal: `animate-scaleIn`
- Backdrop: `animate-fadeIn`
- Cursor: `animate-pulse`
- Transitions: `transition-all duration-300`

## Accessibility

- **Keyboard navigation:** ESC to close
- **Focus management:** Auto-focuses on open
- **Screen readers:** Semantic HTML
- **High contrast:** Good color contrast ratios

## Testing

**Test scenarios:**
1. Open terminal → Should show history
2. Scroll up → Should see older messages
3. Click Copy → Should copy all text
4. Click Clear → Should wipe terminal
5. Click Maximize → Should fill screen
6. Click Minimize → Should restore size
7. Press ESC → Should close
8. Click backdrop → Should close
9. Hover line → Should show timestamp
10. Auto-scroll → Should follow new messages

## Files

**Created:**
- `src/components/TerminalModal.tsx` - Main component

**Modified:**
- `src/store/appStore.ts` - Added terminal state
- `src/components/ProjectView.tsx` - Integration
- `src/components/ActionBar.tsx` - Console button (already done)

## Notes

- Modal has z-index 110 (higher than other modals)
- Terminal lines stored in state for now
- Will be replaced with real streaming data
- Mock data shows realistic conversation flow
- Custom scrollbar for consistent look
- Timestamps formatted in 24-hour time

Enjoy the professional terminal experience! 💻✨
