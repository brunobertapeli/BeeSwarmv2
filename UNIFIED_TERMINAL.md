# Unified Terminal Architecture

## Overview

BeeSwarm features a unified terminal system that aggregates output from multiple sources into a single, chronological stream. This provides developers with a complete view of everything happening in their project: dev server logs, shell commands, npm operations, git operations, and Claude Code iterations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         TerminalModal.tsx (xterm.js)               │    │
│  │  • Displays unified output with color-coded tags  │    │
│  │  • Interactive command input                       │    │
│  │  • Real-time streaming                            │    │
│  └────────────────────────────────────────────────────┘    │
│                          ▲                                   │
│                          │ IPC Events                        │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                    Main Process                         │    │
│                          │                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │       TerminalAggregator Service                   │    │
│  │  • Merges streams from all sources                │    │
│  │  • Maintains chronological order                  │    │
│  │  • Adds timestamps and source tags                │    │
│  │  • Emits 'terminal-line' events                   │    │
│  └────────────────────────────────────────────────────┘    │
│           ▲         ▲         ▲         ▲         ▲         │
│           │         │         │         │         │         │
│    ┌──────┴──┐ ┌───┴────┐ ┌──┴───┐ ┌──┴───┐ ┌────┴─────┐  │
│    │ProcessMgr│ │Terminal│ │ NPM  │ │ Git  │ │  Claude  │  │
│    │(DevSrvr)│ │Service │ │Install│ │Clone │ │   Code   │  │
│    │         │ │ (PTY)  │ │      │ │      │ │          │  │
│    └─────────┘ └────────┘ └──────┘ └──────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. TerminalAggregator (Backend)
**Location**: `electron/services/TerminalAggregator.ts`

Central hub that receives output from all sources and emits unified stream to renderer.

**Interface**:
```typescript
export type TerminalSource = 'dev-server' | 'shell' | 'npm' | 'git' | 'claude' | 'system'

export interface TerminalLine {
  timestamp: Date
  source: TerminalSource
  type: 'stdout' | 'stderr'
  message: string
  raw?: string // Original with ANSI colors
}
```

**Methods**:
```typescript
// Add output from different sources
addDevServerLine(projectId: string, output: ProcessOutput): void
addShellLine(projectId: string, output: TerminalOutput): void
addNpmLine(projectId: string, message: string, type?: 'stdout' | 'stderr'): void
addGitLine(projectId: string, message: string, type?: 'stdout' | 'stderr'): void
addClaudeLine(projectId: string, message: string, type?: 'stdout' | 'stderr'): void
addSystemLine(projectId: string, message: string): void

// Buffer management
getLines(projectId: string, limit?: number): TerminalLine[]
clearBuffer(projectId: string): void
deleteBuffer(projectId: string): void
```

**Events Emitted**:
- `terminal-line` - Emitted for each new line (forwarded to renderer via IPC)
- `terminal-cleared` - Emitted when buffer is cleared

### 2. TerminalModal (Frontend)
**Location**: `src/components/TerminalModal.tsx`

Interactive terminal UI using xterm.js that displays the unified stream.

**Features**:
- Color-coded source tags: `[Dev Server]`, `[Shell]`, `[NPM]`, `[Git]`, `[Claude]`, `[System]`
- Timestamps for each line: `[HH:MM:SS]`
- Interactive command input at bottom
- Real-time output streaming
- Copy, clear, maximize/minimize controls
- Project name in header

**ANSI Color Mapping**:
```typescript
const sourceColors = {
  'dev-server': '\x1b[36m', // Cyan
  'shell':      '\x1b[32m', // Green
  'npm':        '\x1b[33m', // Yellow
  'git':        '\x1b[35m', // Magenta
  'claude':     '\x1b[34m', // Blue
  'system':     '\x1b[90m', // Gray
}
```

### 3. TerminalService (Backend)
**Location**: `electron/services/TerminalService.ts`

Manages interactive PTY sessions for user shell commands using node-pty.

**Features**:
- One background shell per project
- Buffers output until newline (prevents character-by-character display)
- Session lifecycle management (create, destroy, cleanup)
- Output automatically forwarded to TerminalAggregator

### 4. ProcessManager (Backend)
**Location**: `electron/services/ProcessManager.ts`

Manages dev server processes (Netlify CLI).

**Integration**: Output is forwarded to TerminalAggregator with 'dev-server' source tag via `processHandlers.ts`.

## Source Types

### 1. Dev Server (`dev-server`)
**Color**: Cyan

Captures all output from the Netlify dev server (Vite, backend functions, etc.).

**Automatically added by**: ProcessManager via event listener in `processHandlers.ts`

**Example**:
```
[18:45:32] [Dev Server] VITE v6.4.1 ready in 128 ms
[18:45:33] [Dev Server] ➜  Local:   http://localhost:5179/
```

### 2. Shell Commands (`shell`)
**Color**: Green

User-executed commands in the interactive terminal.

**Automatically added by**: TerminalService when PTY emits output

**Example**:
```
[18:46:15] [Shell] $ node --version
[18:46:15] [Shell] v20.11.0
```

### 3. NPM Operations (`npm`)
**Color**: Yellow

Dependency installation operations (root, frontend, backend).

**How to add**:
```typescript
import { terminalAggregator } from './TerminalAggregator'

// In your service/handler:
terminalAggregator.addNpmLine(projectId, '📦 Installing frontend dependencies...\n')
terminalAggregator.addNpmLine(projectId, npmStdoutOutput) // Real-time streaming
terminalAggregator.addNpmLine(projectId, '✓ Dependencies installed successfully\n')
```

**Current usage**: `DependencyService.ts` during `npm install`

**Example**:
```
[18:47:10] [NPM] 📦 Installing root dependencies (netlify-cli)...
[18:47:15] [NPM] added 450 packages in 5s
[18:47:15] [NPM] ✓ Dependencies installed successfully
```

### 4. Git Operations (`git`)
**Color**: Magenta

Version control operations (clone, commit, push, etc.).

**How to add**:
```typescript
import { terminalAggregator } from './TerminalAggregator'

// In your service/handler:
terminalAggregator.addGitLine(projectId, 'Cloning template from https://github.com/...\n')
terminalAggregator.addGitLine(projectId, '✓ Template cloned successfully\n')

// For errors:
terminalAggregator.addGitLine(projectId, '✗ Git operation failed\n', 'stderr')
```

**Current usage**: `TemplateService.ts` during project creation (clone, init)

**Example**:
```
[18:50:20] [Git] Cloning template from https://github.com/user/template...
[18:50:25] [Git] ✓ Template cloned successfully to /Users/.../Projects/myapp
[18:50:25] [Git] ✓ Removed template .git directory
[18:50:25] [Git] ✓ Initialized new git repository
```

### 5. Claude Code (`claude`)
**Color**: Blue

Claude Code AI assistant operations (editing, committing, pushing).

**How to add**:
```typescript
import { terminalAggregator } from './TerminalAggregator'

// Example for future Claude Code integration:
terminalAggregator.addClaudeLine(projectId, '🤖 Claude: Starting code editing session...\n')
terminalAggregator.addClaudeLine(projectId, '📝 Editing src/components/Header.tsx\n')
terminalAggregator.addClaudeLine(projectId, '✓ Code changes applied successfully\n')
terminalAggregator.addClaudeLine(projectId, '📦 Running tests...\n')
terminalAggregator.addClaudeLine(projectId, '✓ All tests passed\n')
terminalAggregator.addClaudeLine(projectId, '🔧 Committing changes: "feat: add dark mode toggle"\n')
terminalAggregator.addClaudeLine(projectId, '✓ Changes committed successfully\n')
terminalAggregator.addClaudeLine(projectId, '🚀 Pushing to remote...\n')
terminalAggregator.addClaudeLine(projectId, '✓ Changes pushed to origin/main\n')
```

**Status**: Not yet implemented - reserved for Claude Code editing loop

**Planned usage**:
- Code editing notifications
- Test execution results
- Commit messages
- Push operations
- Error messages

### 6. System Messages (`system`)
**Color**: Gray

System-level notifications, warnings, and info messages.

**How to add**:
```typescript
import { terminalAggregator } from './TerminalAggregator'

terminalAggregator.addSystemLine(projectId, '🔧 Port configuration updated\n')
terminalAggregator.addSystemLine(projectId, '⚠️ Warning: Large bundle size detected\n')
```

**Example**:
```
[18:55:00] [System] 🔧 Port configuration updated
[18:55:05] [System] ⚠️ Warning: Large bundle size detected
```

## Implementation Guide

### Adding Terminal Output to a New Operation

**Step 1**: Import TerminalAggregator
```typescript
import { terminalAggregator } from '../services/TerminalAggregator'
```

**Step 2**: Add output at key points
```typescript
async function yourOperation(projectId: string) {
  try {
    // Start notification
    terminalAggregator.addClaudeLine(projectId, '🤖 Starting operation...\n')

    // Stream real-time output if available
    const process = spawn('some-command', args)
    process.stdout.on('data', (data) => {
      terminalAggregator.addClaudeLine(projectId, data.toString())
    })

    // Success notification
    terminalAggregator.addClaudeLine(projectId, '✓ Operation completed successfully\n')

  } catch (error) {
    // Error notification (use stderr)
    terminalAggregator.addClaudeLine(
      projectId,
      `✗ Operation failed: ${error.message}\n`,
      'stderr'
    )
  }
}
```

**Step 3**: Pass projectId through call chain
Ensure the projectId is available in the function that needs to log to terminal.

### Best Practices

1. **Always end messages with `\n`** - Ensures proper line breaks in terminal
   ```typescript
   // Good
   terminalAggregator.addGitLine(projectId, 'Cloning repository...\n')

   // Bad (will merge with next line)
   terminalAggregator.addGitLine(projectId, 'Cloning repository...')
   ```

2. **Use descriptive prefixes** - Help users understand what's happening
   ```typescript
   terminalAggregator.addClaudeLine(projectId, '🤖 Claude: Analyzing codebase...\n')
   terminalAggregator.addClaudeLine(projectId, '📝 Editing src/App.tsx\n')
   terminalAggregator.addClaudeLine(projectId, '✓ Changes applied\n')
   ```

3. **Use stderr for errors** - Displays in red in terminal
   ```typescript
   terminalAggregator.addGitLine(projectId, '✗ Push failed: remote rejected\n', 'stderr')
   ```

4. **Stream real-time output** - Don't wait for operation to complete
   ```typescript
   // Good - user sees output as it happens
   process.stdout.on('data', (data) => {
     terminalAggregator.addNpmLine(projectId, data.toString())
   })

   // Bad - user sees nothing until complete
   const output = await runCommand()
   terminalAggregator.addNpmLine(projectId, output)
   ```

5. **Use appropriate source type** - Helps with color coding and organization
   - `npm` - Package management (install, update, audit)
   - `git` - Version control (clone, commit, push, pull, merge)
   - `claude` - AI operations (editing, analysis, suggestions)
   - `system` - App-level notifications

## Terminal Session Lifecycle

### Creating a Session
Done automatically when user opens a project in `ProjectView.tsx`:
```typescript
await window.electronAPI.terminal.createSession(projectId)
```

### Destroying a Session
Done automatically when user closes project or switches:
```typescript
await window.electronAPI.terminal.destroySession(projectId)
```

### Clearing Terminal
User can clear via Clear button in TerminalModal:
```typescript
await window.electronAPI.terminal.clear(projectId)
```

## Testing Terminal Output

### Backend Test
```typescript
// In any backend service
import { terminalAggregator } from './services/TerminalAggregator'

// Add test output
terminalAggregator.addClaudeLine('your-project-id', '🧪 Test message\n')
```

### Check Console Logs
Backend logs show when terminal lines are emitted:
```
📺 Terminal line emitted for proj_xxx: [claude] 🧪 Test message
```

### Verify in UI
1. Open project in BeeSwarm
2. Click terminal icon (bottom-right)
3. Should see your message with timestamp and color-coded `[Claude]` tag

## Future Enhancements

### Claude Code Editing Loop
Next phase will integrate Claude Code operations:

```typescript
// Example implementation for editing loop
async function claudeEditingLoop(projectId: string, instruction: string) {
  // 1. Start session
  terminalAggregator.addClaudeLine(projectId, `🤖 Claude: ${instruction}\n`)

  // 2. Analyze code
  terminalAggregator.addClaudeLine(projectId, '📊 Analyzing codebase...\n')
  const analysis = await analyzeCode()

  // 3. Make changes
  terminalAggregator.addClaudeLine(projectId, `📝 Editing ${analysis.filesToEdit.length} files\n`)
  await applyChanges(analysis.changes)

  // 4. Run tests
  terminalAggregator.addClaudeLine(projectId, '🧪 Running tests...\n')
  const testResult = await runTests()

  if (testResult.failed > 0) {
    terminalAggregator.addClaudeLine(
      projectId,
      `✗ ${testResult.failed} tests failed\n`,
      'stderr'
    )
    return
  }

  terminalAggregator.addClaudeLine(projectId, '✓ All tests passed\n')

  // 5. Commit
  terminalAggregator.addClaudeLine(projectId, `📦 Committing: "${testResult.commitMsg}"\n`)
  await gitCommit(projectId, testResult.commitMsg)

  // 6. Push
  terminalAggregator.addClaudeLine(projectId, '🚀 Pushing to remote...\n')
  await gitPush(projectId)

  terminalAggregator.addClaudeLine(projectId, '✅ Changes deployed successfully!\n')
}
```

### Potential Features
- Filter by source type (show only `[NPM]` logs, etc.)
- Search/grep functionality
- Export logs to file
- Timestamps toggle
- Font size adjustment
- Theme customization

## File Reference

### Backend Services
- `electron/services/TerminalAggregator.ts` - Central aggregation service
- `electron/services/TerminalService.ts` - PTY shell management
- `electron/services/ProcessManager.ts` - Dev server management
- `electron/services/TemplateService.ts` - Git operations (clone, init)
- `electron/services/DependencyService.ts` - NPM operations (install)

### Backend Handlers
- `electron/handlers/terminalHandlers.ts` - IPC handlers for terminal operations
- `electron/handlers/processHandlers.ts` - Forwards dev server output to aggregator

### Frontend Components
- `src/components/TerminalModal.tsx` - Terminal UI with xterm.js
- `src/components/ProjectView.tsx` - Creates/destroys terminal sessions

### Type Definitions
- `electron/services/TerminalAggregator.ts` - `TerminalLine`, `TerminalSource`
- `src/types/electron.d.ts` - Frontend types for terminal API

## Troubleshooting

### Terminal output not showing
1. Check if terminal session was created: `window.electronAPI.terminal.createSession(projectId)`
2. Verify projectId matches between backend and frontend
3. Check backend logs for "📺 Terminal line emitted" messages
4. Ensure xterm.js initialized (check for console errors)

### Character-by-character output
- Already fixed! TerminalService buffers until newline
- If you see this elsewhere, implement buffering in your output handler

### Terminal not opening
- Check if TerminalModal has correct projectId and projectName props
- Verify terminal handlers are registered in `main.ts`
- Check for node-pty build errors (run `npx electron-rebuild -f -w node-pty`)

### Colors not showing
- Ensure ANSI color codes are used: `\x1b[36m` for cyan, etc.
- xterm.js supports ANSI colors - they'll render automatically
- Check that messages include ANSI reset code: `\x1b[0m`

---

**Last Updated**: 2024-11-01
**Status**: Production Ready ✅
