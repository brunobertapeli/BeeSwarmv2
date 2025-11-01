# Process Management - Technical Implementation Guide

## Overview
Manages the lifecycle of child processes (Vite dev server, Nodemon backend, Claude Code CLI) including spawning, monitoring, restarting, port assignment, and error detection.

---

## Architecture

### Managed Processes
1. **Frontend Dev Server** (Vite) - Port auto-assigned
2. **Backend Dev Server** (Nodemon) - Port auto-assigned (if template has backend)
3. **Claude Code CLI** (PTY) - No port needed

### Process States
- `stopped` - Not running
- `starting` - Spawning process
- `running` - Process active and healthy
- `stopping` - Killing process
- `crashed` - Process exited unexpectedly
- `error` - Failed to start

---

## Implementation Steps

### 1. ProcessManager Service

**File:** `main/services/ProcessManager.ts`

**Purpose:** Central service managing all child processes

**Properties:**
- `processes: Map<string, ChildProcess>` - Active processes by ID
- `ports: Map<string, number>` - Assigned ports
- `status: Map<string, ProcessState>` - Current state of each process
- `outputs: Map<string, string[]>` - Recent stdout/stderr lines (last 100)

**Key Methods:**

**startFrontend(projectPath)**
- Detect available port (start from 5173)
- Change to frontend directory
- Spawn: `npm run dev -- --port {port}`
- Monitor stdout for "Local: http://localhost:{port}"
- Set status to `running` when ready
- Return port number

**startBackend(projectPath)**
- Detect available port (start from 3000)
- Change to backend directory
- Set PORT environment variable
- Spawn: `npm run dev`
- Monitor stdout for "Server listening on port {port}" or similar
- Set status to `running` when ready
- Return port number

**stopProcess(processId)**
- Get process from map
- Send SIGTERM
- Wait 5 seconds for graceful shutdown
- If still running, send SIGKILL
- Remove from map
- Set status to `stopped`

**restartProcess(processId)**
- Get project path and process type from processId
- Stop process
- Wait 1 second
- Start process again
- Return new port if changed

**stopAll()**
- Iterate all processes
- Stop each one
- Clear all maps

**getOutput(processId)**
- Return last 100 lines of stdout/stderr
- Used for error detection

**getStatus(processId)**
- Return current process status

---

### 2. Port Detection

**File:** `main/services/PortService.ts`

**Purpose:** Find available ports automatically

**Method: findAvailablePort(startPort, endPort)**

**Logic:**
- Start from `startPort` (e.g., 5173 for frontend)
- Try to create server on port
- If successful, close server and return port
- If EADDRINUSE error, increment port and try again
- Repeat until available port found or `endPort` reached
- If no port available, throw error

**Implementation using detect-port library:**
- Import detect-port
- Call: `await detect(startPort)`
- Returns first available port >= startPort
- Cache in PortService to avoid conflicts
- Release when process stops

**Port Ranges:**
- Frontend: 5173-5200
- Backend: 3000-3100
- Ensures no conflicts with system services

---

### 3. Process Spawning

**Starting Vite Dev Server:**

**Directory:** `{projectPath}/frontend`

**Command:** `npm run dev -- --port {port} --host`

**Environment Variables:**
- Load from `.env.frontend`
- Add: `PORT={port}`
- Add: `NODE_ENV=development`

**Options:**
- `cwd`: Frontend directory
- `shell`: true
- `env`: Merged environment variables

**Detecting Ready State:**
- Parse stdout for patterns:
  - "Local:   http://localhost:{port}"
  - "ready in"
  - "VITE v"
- When detected, emit `frontend-ready` event
- Store port in PortService

**Starting Nodemon Backend:**

**Directory:** `{projectPath}/backend`

**Command:** `npm run dev`

**Environment Variables:**
- Load from `.env.backend`
- Add: `PORT={port}`
- Add: `NODE_ENV=development`

**Detecting Ready State:**
- Parse stdout for patterns:
  - "listening on port {port}"
  - "Server running"
  - "started on :{port}"
- When detected, emit `backend-ready` event
- Store port in PortService

---

### 4. Output Monitoring

**Purpose:** Capture stdout/stderr for error detection and user display

**Implementation:**

**For Each Process:**
- Listen to `stdout.on('data')` event
- Convert Buffer to string
- Split by newlines
- Add to outputs array (max 100 lines)
- Emit to renderer via IPC for display
- Parse for errors

**ANSI Color Handling:**
- Use strip-ansi library to remove color codes
- Store plain text for parsing
- Keep original for terminal display

**Log Levels:**
- INFO: Normal output
- WARN: Warning messages
- ERROR: Error messages
- Detect by keywords or color codes

---

### 5. Error Detection

**File:** `main/services/ErrorDetector.ts`

**Purpose:** Parse process output to detect errors

**detectErrors(output: string[]): Error[]**

**Error Patterns to Detect:**

**Syntax Errors:**
- "SyntaxError:"
- "Unexpected token"
- "Parse error"

**Runtime Errors:**
- "TypeError:"
- "ReferenceError:"
- "Cannot read property"
- "undefined is not"

**Module Errors:**
- "Cannot find module"
- "Module not found"
- "Failed to resolve"

**Network Errors:**
- "ECONNREFUSED"
- "EADDRINUSE"
- "fetch failed"

**Build Errors:**
- "Build failed"
- "Compilation failed"
- "Transform failed"

**Return Format:**
```
{
  type: 'syntax' | 'runtime' | 'module' | 'network' | 'build',
  message: string,
  file: string | null,
  line: number | null,
  column: number | null,
  stack: string | null
}
```

**Parsing Strategy:**
- Use regex to extract file path, line number
- Examples:
  - `at /path/to/file.ts:42:15` → Extract file and line
  - `Error in ./src/App.tsx` → Extract file
- Store full error context (5 lines before and after)

---

### 6. Health Checks

**Purpose:** Verify processes are still alive and responsive

**Implementation:**

**Process Alive Check:**
- Check if process.pid exists
- Check if process hasn't exited
- Run every 5 seconds

**HTTP Health Check (optional):**
- For frontend: GET `http://localhost:{port}`
- For backend: GET `http://localhost:{port}/health` (if endpoint exists)
- If returns 200, process is healthy
- If fails 3 times, mark as unhealthy

**Actions on Unhealthy:**
- Emit `process-unhealthy` event
- Attempt restart
- If restart fails, mark as crashed
- Show error to user

---

### 7. Process Restart Logic

**When to Restart:**
- After Claude makes file changes
- After error auto-fix attempt
- Manual user request (refresh button)
- After process crash

**Restart Sequence:**
1. Emit `restarting-processes` event to renderer
2. Stop frontend process (SIGTERM)
3. Stop backend process (SIGTERM)
4. Wait 2 seconds for clean shutdown
5. Clear console outputs
6. Start frontend (reuse same port if available)
7. Start backend (reuse same port if available)
8. Wait for both to be ready (parse "ready" messages)
9. Check for errors in first 10 seconds
10. If errors found, return error list
11. If no errors, emit `processes-ready` event
12. Renderer refreshes preview

**Timeout Handling:**
- Max 30 seconds for restart
- If timeout, kill forcefully (SIGKILL)
- Report failure to user

---

### 8. Graceful Shutdown

**On App Quit:**
1. Emit `app-quitting` event
2. Stop all processes gracefully
3. Wait max 5 seconds
4. Force kill any remaining processes
5. Clean up port assignments
6. Close database connections

**On Project Close:**
1. Stop processes for that project
2. Keep ProcessManager running for other projects
3. Release ports
4. Clear output buffers

---

### 9. Error Recovery Strategies

**Port Already in Use:**
- Find next available port
- Update .env files if needed
- Restart with new port
- Notify renderer of port change

**Process Crashes Repeatedly:**
- Track crash count
- If crashes 3 times in 5 minutes, stop trying
- Show error: "Process keeps crashing. Check console for errors."
- Offer to open project in external editor

**npm install Needed:**
- Detect "Cannot find module" errors
- Check if node_modules exists
- If not, run npm install automatically
- Show progress to user
- Restart after install completes

**Dependency Issues:**
- Detect version conflicts
- Suggest: "Try deleting node_modules and reinstalling"
- Offer button to do it automatically

---

### 10. IPC Handlers

**File:** `main/ipc/processes.ts`

**start-dev-servers**
- Input: `{ projectPath: string }`
- Action: Start frontend and backend
- Output: `{ frontendPort: number, backendPort: number | null }`

**stop-dev-servers**
- Input: `{ projectPath: string }`
- Action: Stop all processes for project

**restart-dev-servers**
- Input: `{ projectPath: string }`
- Action: Restart both processes
- Output: New ports if changed

**get-process-status**
- Input: `{ processId: string }`
- Output: `{ status: ProcessState, port: number | null }`

**get-process-output**
- Input: `{ processId: string }`
- Output: `{ output: string[] }` (last 100 lines)

**check-for-errors**
- Input: `{ projectPath: string }`
- Action: Run ErrorDetector on recent output
- Output: `{ errors: Error[] }`

**IPC Events (Main → Renderer):**
- `process-status-changed` - Process state updated
- `process-output` - New stdout/stderr line
- `processes-ready` - Both servers ready
- `process-error` - Error detected
- `process-crashed` - Process exited unexpectedly

---

### 11. Environment Variable Management

**Loading .env Files:**
- Use dotenv library
- Read `.env.frontend` and `.env.backend`
- Parse into object
- Merge with process.env when spawning

**Writing .env Files:**
- When user configures services in wizard
- Format: `KEY=value` (one per line)
- Quote values with spaces: `KEY="value with spaces"`
- Comments allowed: `# This is a comment`

**Variable Injection:**
- Frontend variables must start with `VITE_`
- Backend variables: any name
- Auto-add PORT variable
- Auto-add NODE_ENV=development

---

### 12. Logging

**File:** `main/utils/logger.ts`

**Log Levels:**
- DEBUG: Detailed process info
- INFO: Process lifecycle events
- WARN: Recoverable issues
- ERROR: Failures

**Log Output:**
- Write to: `~/Library/Logs/BeeSwarm/processes.log`
- Rotate daily
- Keep last 7 days
- Max 10MB per file

**What to Log:**
- Process start/stop with timestamps
- Port assignments
- Error detection results
- Restart attempts
- Crash events
- Performance metrics (startup time)

---

### 13. Performance Optimization

**Process Pooling:**
- Keep processes running between edits
- Only restart when necessary (file changes detected)
- Don't restart if only frontend changed and backend unchanged

**Startup Time:**
- Measure time from spawn to ready
- Log slow startups (>10 seconds)
- Cache node_modules to speed up installs

**Memory Management:**
- Monitor process memory usage
- Warn if over 500MB
- Kill and restart if over 1GB

---

### 14. Testing Checklist

**Manual Tests:**
- [ ] Start frontend dev server successfully
- [ ] Start backend dev server successfully
- [ ] Frontend auto-assigns port if 5173 occupied
- [ ] Backend auto-assigns port if 3000 occupied
- [ ] Process output captured and displayed
- [ ] Errors detected in console output
- [ ] Restart both processes successfully
- [ ] Stop processes on project close
- [ ] Graceful shutdown on app quit
- [ ] Handle process crash and auto-restart
- [ ] Handle "port in use" error gracefully
- [ ] npm install runs when node_modules missing
- [ ] .env variables loaded correctly
- [ ] Multiple projects can run simultaneously
- [ ] Switching projects stops old processes

**Edge Cases:**
- [ ] Kill process externally (from terminal) - app detects and restarts
- [ ] Change .env file manually - processes use new values on restart
- [ ] Delete node_modules - app detects and reinstalls
- [ ] Syntax error in code - error detected and reported
- [ ] Infinite loop in code - process hangs, timeout kills it
- [ ] Very slow startup (20+ seconds) - doesn't timeout prematurely

---

### 15. Future Enhancements

- Process resource monitoring (CPU, memory graphs)
- Custom npm scripts support (not just "dev")
- Support for other frameworks (Next.js, Nuxt, etc.)
- Docker container support for backend
- Hot reload optimization (skip full restart when possible)
- Process pooling across projects (share node_modules)
- Smart dependency caching
- Build time optimization
- Auto-detect framework and adjust accordingly