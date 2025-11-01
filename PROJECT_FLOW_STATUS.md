# BeeSwarm v2 - Project Flow Implementation Status

**Last Updated:** October 31, 2025
**Current Phase:** Phase 3 - Project Configuration & Dev Servers

---

## ✅ Completed Phases

### Phase 1: Template Selection & MongoDB Integration
**Status:** ✅ Complete

**Implemented:**
- MongoDB integration for templates (`electron/services/MongoService.ts`)
- Template fetching from MongoDB Atlas
- IPC handlers for template operations (`electron/handlers/templateHandlers.ts`)
- UI updates to TemplateSelector component
- Loading/error states for template fetching
- Tech stack icon display with centralized configuration (`src/config/techStack.ts`)

**Files Modified:**
- `electron/services/MongoService.ts` - Added `getTemplates()`, `getTemplateById()`
- `electron/handlers/templateHandlers.ts` - NEW
- `src/components/TemplateSelector.tsx` - Removed mock data, added real MongoDB fetching
- `src/components/TechIcon.tsx` - Updated to use centralized config
- `src/config/techStack.ts` - NEW - Centralized tech stack configuration
- `electron/preload.js` - Exposed templates IPC methods
- `src/types/electron.d.ts` - Added Template interface

### Phase 2: Project Creation & SQLite Storage
**Status:** ✅ Complete

**Implemented:**
- SQLite database for local project metadata (`electron/services/DatabaseService.ts`)
- GitHub repository cloning (`electron/services/TemplateService.ts`)
- Project creation orchestration (`electron/services/ProjectService.ts`)
- Project IPC handlers (`electron/handlers/projectHandlers.ts`)
- Project selector with real database data
- Favorites functionality (toggle, persist to database)
- Auto-open last project on login
- Update lastOpenedAt when switching projects
- Auto-switch to newly created project
- Empty state handling (auto-open template selector)

**Files Created:**
- `electron/services/DatabaseService.ts` - SQLite operations for projects
- `electron/services/TemplateService.ts` - GitHub cloning via simple-git
- `electron/services/ProjectService.ts` - Project creation orchestration
- `electron/handlers/projectHandlers.ts` - IPC handlers for projects

**Files Modified:**
- `src/components/ProjectSelector.tsx` - Real project fetching, favorites
- `src/components/ProjectView.tsx` - Auto-open logic, real project data
- `src/components/TemplateSelector.tsx` - Auto-switch to new project
- `src/store/appStore.ts` - Persist currentProjectId to localStorage
- `electron/preload.js` - Added project IPC methods
- `src/types/electron.d.ts` - Added Project interface
- `electron/main.ts` - Initialize database, register handlers
- `vite.config.ts` - Externalized better-sqlite3, simple-git

**Database Schema:**
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  templateId TEXT NOT NULL,
  templateName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  isFavorite INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  lastOpenedAt INTEGER
)
```

**Project Structure:**
```
~/Documents/BeeSwarm/Projects/
  ├── my-saas-app/
  ├── e-commerce-dashboard/
  └── portfolio-site/
```

**Database Location:**
```
~/Library/Application Support/beeswarm/database.db
```

---

## 🚧 Remaining Phases

### Phase 3: Configuration Wizard & Environment Setup
**Status:** 🔴 Not Started
**Priority:** HIGH

**Goal:** After project creation, guide user through service configuration and create .env files

**Tasks:**
1. **Dynamic Configuration Detection**
   - Read template's `requiredServices` from MongoDB
   - Map services to required API keys (Stripe, Supabase, MongoDB, etc.)
   - Show configuration wizard modal after project creation

2. **Configuration Wizard UI**
   - File: `src/components/ProjectSettings.tsx` (expand existing component)
   - Show required services with input fields
   - Validate API keys (basic format validation)
   - Save to local state

3. **Environment File Generation**
   - Service: `electron/services/EnvService.ts` (NEW)
   - Create `.env` (or `.env.frontend`, `.env.backend` for fullstack)
   - Write key-value pairs based on user input
   - Encrypt sensitive values before storing in database (optional)

4. **Database Schema Extension**
   ```sql
   ALTER TABLE projects ADD COLUMN configCompleted INTEGER DEFAULT 0;
   ALTER TABLE projects ADD COLUMN envVars TEXT; -- JSON string of env vars
   ```

5. **Setup Mode Flow**
   - After project creation → `isProjectSetupMode = true`
   - Open ProjectSettings modal with `initialTab = 'apikeys'`
   - Block closing until all required keys entered
   - On complete → `configCompleted = 1`, `status = 'ready'`

**Files to Create:**
- `electron/services/EnvService.ts` - Write .env files

**Files to Modify:**
- `src/components/ProjectSettings.tsx` - Add API key inputs per service
- `electron/services/DatabaseService.ts` - Add configCompleted, envVars fields
- `src/components/TemplateSelector.tsx` - Open setup wizard after creation

**Tech Stack Configs (Already Defined):**
```typescript
TECH_CONFIGS = {
  stripe: {
    apiKeys: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']
  },
  mongodb: {
    apiKeys: ['MONGODB_URI']
  },
  supabase: {
    apiKeys: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  }
}
```

---

### Phase 4: npm install & Dependency Installation
**Status:** 🔴 Not Started
**Priority:** HIGH

**Goal:** Install project dependencies after configuration

**Tasks:**
1. **Dependency Installation Service**
   - Service: `electron/services/DependencyService.ts` (NEW)
   - Detect if `package.json` exists in project root
   - For fullstack: Check both `frontend/package.json` and `backend/package.json`
   - Run `npm install` in correct directories

2. **Installation Progress UI**
   - Show progress modal during installation
   - Stream npm install output to terminal modal
   - Show spinner: "Installing dependencies..."
   - Handle errors (missing npm, network issues)

3. **IPC Handlers**
   - `project:install-dependencies` - Trigger npm install
   - Stream progress events to renderer

4. **Database Updates**
   ```sql
   ALTER TABLE projects ADD COLUMN dependenciesInstalled INTEGER DEFAULT 0;
   ```

5. **Setup Flow Integration**
   - After env configuration complete
   - Auto-trigger dependency installation
   - Show progress in setup wizard
   - On complete → `dependenciesInstalled = 1`

**Files to Create:**
- `electron/services/DependencyService.ts` - npm install management

**Files to Modify:**
- `src/components/ProjectSettings.tsx` - Add dependency installation step
- `electron/handlers/projectHandlers.ts` - Add install-dependencies handler

---

### Phase 5: Dev Server Management
**Status:** 🔴 Not Started
**Priority:** HIGH

**Goal:** Start Vite (frontend) and/or Nodemon (backend) dev servers

**Tasks:**
1. **Process Manager Service**
   - Service: `electron/services/ProcessManager.ts` (NEW)
   - Start Vite dev server: `npm run dev` (default port 5173)
   - Start Nodemon server: `npm run dev` (default port 3000)
   - Track process PIDs
   - Restart on file changes
   - Kill on project switch

2. **Port Management**
   - Detect available ports (5173, 3000, etc.)
   - If busy → increment (5174, 3001)
   - Store ports in database per project

3. **Console Output Capture**
   - Capture stdout/stderr from dev servers
   - Parse for errors (syntax errors, missing modules)
   - Display in Terminal Modal
   - Detect server ready state ("Local: http://localhost:5173")

4. **IPC Handlers**
   - `dev-server:start` - Start servers
   - `dev-server:stop` - Kill servers
   - `dev-server:restart` - Restart servers
   - `dev-server:logs` - Stream logs

5. **Database Schema**
   ```sql
   ALTER TABLE projects ADD COLUMN devServerPort INTEGER;
   ALTER TABLE projects ADD COLUMN backendPort INTEGER;
   ALTER TABLE projects ADD COLUMN serverStatus TEXT; -- 'stopped', 'starting', 'running', 'error'
   ```

**Files to Create:**
- `electron/services/ProcessManager.ts` - Dev server lifecycle

**Files to Modify:**
- `src/components/ProjectView.tsx` - Auto-start servers on project load
- `src/components/TerminalModal.tsx` - Display server logs
- `electron/handlers/projectHandlers.ts` - Add dev-server handlers

---

### Phase 6: Live Preview with BrowserView
**Status:** 🔴 Not Started
**Priority:** MEDIUM

**Goal:** Embed live preview of running app inside Electron

**Tasks:**
1. **BrowserView Integration**
   - Use Electron's BrowserView (NOT iframe - better isolation)
   - Load `http://localhost:5173` after dev server ready
   - Embed in preview area (where placeholder currently is)
   - Auto-reload on file changes

2. **Preview Controls**
   - Refresh button
   - Open in external browser
   - Device frame (mobile/tablet preview)
   - Orientation toggle (portrait/landscape)

3. **File Watching**
   - Use chokidar to watch project directory
   - Detect file changes
   - Auto-reload BrowserView on change

4. **Error Handling**
   - Show error overlay if server crashes
   - Show "Server Starting..." while waiting
   - Show "Port in use" if port conflict

**Files to Create:**
- `electron/services/PreviewService.ts` - BrowserView management

**Files to Modify:**
- `electron/main.ts` - Create BrowserView
- `src/components/ProjectView.tsx` - Remove placeholder, add preview controls

---

### Phase 7: Claude Code CLI Integration
**Status:** 🔴 Not Started
**Priority:** HIGH (Core Feature)

**Goal:** Spawn Claude Code CLI and enable natural language editing

**Tasks:**
1. **Claude Code CLI Installation Check**
   - Service: `electron/services/ClaudeService.ts` (NEW)
   - Check if `claude-code` CLI is installed
   - If not → Install via `npm install -g @anthropic-ai/claude-code`
   - Show progress modal during installation

2. **API Key Management**
   - First-run: Prompt for Anthropic API key
   - Or: Use Claude OAuth2 flow (if supported)
   - Store encrypted using `safeStorage`
   - Validate key by running test command

3. **PTY Spawning**
   - Use node-pty to spawn Claude Code CLI
   - Run in project directory: `cd ~/Documents/BeeSwarm/Projects/my-app`
   - Keep process alive for entire session
   - Write to stdin for each user message

4. **Output Parsing**
   - Service: `electron/services/OutputParser.ts` (NEW)
   - Parse Claude's stdout for:
     - File being edited: "📝 Editing src/components/Hero.tsx"
     - Code diffs
     - Completion messages
     - Errors
   - Stream parsed events to renderer

5. **Chat Interface**
   - Component: `src/components/ChatModal.tsx` (currently exists but basic)
   - Input field in ActionBar
   - Stream Claude responses
   - Show file changes as cards
   - Show raw terminal output in TerminalModal

6. **Auto-fix Loop**
   - After Claude edit → Restart dev servers
   - Check console for errors
   - If errors → Send back to Claude: "/fix these errors: [error list]"
   - Retry max 3 times

7. **Git Auto-commit**
   - After successful edit (no errors)
   - Auto-commit with message: "Changed hero headline"
   - Store in SQLite chat_history table

**Files to Create:**
- `electron/services/ClaudeService.ts` - PTY management
- `electron/services/OutputParser.ts` - Parse Claude output
- `electron/services/GitService.ts` - Auto-commit

**Files to Modify:**
- `src/components/ActionBar.tsx` - Chat input sends to Claude
- `src/components/ChatModal.tsx` - Display parsed responses
- `src/components/TerminalModal.tsx` - Raw output display

**Database Schema:**
```sql
CREATE TABLE chat_history (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  userMessage TEXT NOT NULL,
  claudeResponse TEXT,
  filesChanged TEXT, -- JSON array
  commitHash TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id)
)
```

---

### Phase 8: Deployment (Netlify)
**Status:** 🔴 Not Started
**Priority:** MEDIUM

**Goal:** Deploy projects to Netlify with OAuth

**Tasks:**
1. **Netlify OAuth Flow**
   - Service: `electron/services/DeploymentService.ts` (NEW)
   - Click "Deploy" → Check if Netlify connected
   - If not → Open browser for OAuth
   - Receive callback → Store OAuth token (encrypted)

2. **Build & Deploy**
   - Run `npm run build` in project
   - Use Netlify CLI: `netlify deploy --prod --dir=dist`
   - Stream deployment output
   - Show progress in modal

3. **Deployment History**
   - Store deployment URL in database
   - Track deployment status
   - Show badge: "Live" on deployed projects

4. **IPC Handlers**
   - `deployment:connect-netlify` - OAuth flow
   - `deployment:deploy` - Build & deploy
   - `deployment:get-status` - Check deployment status

**Database Schema:**
```sql
ALTER TABLE projects ADD COLUMN deploymentUrl TEXT;
ALTER TABLE projects ADD COLUMN deployedAt INTEGER;
```

---

## 🔧 Technical Debt & Improvements

### High Priority
- [ ] Error handling for all IPC calls (consistent error responses)
- [ ] Loading states for all async operations
- [ ] Toast notifications for success/error states
- [ ] Proper TypeScript typing for all IPC handlers
- [ ] Input validation (project names, API keys)

### Medium Priority
- [ ] Project path validation (check if directory already exists)
- [ ] Template cloning progress (show % or file count)
- [ ] Database migrations system (for schema changes)
- [ ] Logs service (store app logs for debugging)
- [ ] Settings persistence (user preferences)

### Low Priority
- [ ] Project search/filter in ProjectSelector
- [ ] Project tags/categories
- [ ] Export/import projects
- [ ] Template preview screenshots
- [ ] Dark/light theme toggle

---

## 📊 Database Schema (Current + Planned)

### Current Schema
```sql
-- EXISTING
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  templateId TEXT NOT NULL,
  templateName TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating', -- 'creating' | 'ready' | 'error'
  isFavorite INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  lastOpenedAt INTEGER
)
```

### Planned Extensions
```sql
-- PHASE 3: Configuration
ALTER TABLE projects ADD COLUMN configCompleted INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN envVars TEXT; -- JSON string

-- PHASE 4: Dependencies
ALTER TABLE projects ADD COLUMN dependenciesInstalled INTEGER DEFAULT 0;

-- PHASE 5: Dev Servers
ALTER TABLE projects ADD COLUMN devServerPort INTEGER;
ALTER TABLE projects ADD COLUMN backendPort INTEGER;
ALTER TABLE projects ADD COLUMN serverStatus TEXT; -- 'stopped' | 'starting' | 'running' | 'error'

-- PHASE 8: Deployment
ALTER TABLE projects ADD COLUMN deploymentUrl TEXT;
ALTER TABLE projects ADD COLUMN deployedAt INTEGER;

-- PHASE 7: Chat History
CREATE TABLE chat_history (
  id TEXT PRIMARY KEY,
  projectId TEXT NOT NULL,
  userMessage TEXT NOT NULL,
  claudeResponse TEXT,
  filesChanged TEXT, -- JSON array: ["src/Hero.tsx", "src/App.tsx"]
  commitHash TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (projectId) REFERENCES projects(id)
);

-- User Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Store encrypted tokens
CREATE TABLE secure_storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- Encrypted
  createdAt INTEGER NOT NULL
);
```

---

## 🎯 Immediate Next Steps (Priority Order)

1. **Phase 3: Configuration Wizard**
   - Create EnvService.ts
   - Update ProjectSettings.tsx with API key inputs
   - Wire into project creation flow

2. **Phase 4: Dependencies**
   - Create DependencyService.ts
   - Add npm install step to setup wizard

3. **Phase 5: Dev Servers**
   - Create ProcessManager.ts
   - Start servers after dependencies installed
   - Show logs in Terminal Modal

4. **Phase 6: Preview**
   - Add BrowserView to main process
   - Load localhost:5173
   - Replace placeholder in ProjectView

5. **Phase 7: Claude Integration** (CORE VALUE)
   - ClaudeService.ts with node-pty
   - OutputParser.ts
   - Wire ActionBar chat to Claude
   - Auto-commit with Git

6. **Phase 8: Deployment**
   - Netlify OAuth
   - Build & deploy flow

---

## 🧪 Testing Checklist

### Phase 3 Testing
- [ ] Create project → Opens configuration wizard
- [ ] Required services detected from template
- [ ] API keys saved to .env files
- [ ] Validation prevents empty/invalid keys
- [ ] Setup wizard blocks closing until complete

### Phase 4 Testing
- [ ] npm install runs after configuration
- [ ] Progress shown in UI
- [ ] Handles errors (missing npm, network)
- [ ] Works for frontend-only templates
- [ ] Works for fullstack templates (installs both)

### Phase 5 Testing
- [ ] Dev servers start automatically
- [ ] Ports detected and incremented if busy
- [ ] Server logs visible in terminal
- [ ] Restart works correctly
- [ ] Servers killed on project switch

### Phase 6 Testing
- [ ] Preview loads after server ready
- [ ] Auto-refreshes on file changes
- [ ] Device frames work (mobile/tablet)
- [ ] Open in browser works
- [ ] Error overlay on server crash

### Phase 7 Testing
- [ ] Claude Code CLI installs successfully
- [ ] API key validation works
- [ ] Chat messages sent to Claude
- [ ] File changes parsed and displayed
- [ ] Auto-fix loop triggers on errors
- [ ] Git commits created after success
- [ ] Terminal shows raw output

### Phase 8 Testing
- [ ] Netlify OAuth flow works
- [ ] Build runs successfully
- [ ] Deploy to Netlify works
- [ ] Deployment URL saved
- [ ] "Live" badge shows on deployed projects

---

## 📝 Notes

**Current State:** Phases 1-2 are fully functional. User can:
- Authenticate with Supabase
- Fetch templates from MongoDB
- Create projects from templates (clones from GitHub)
- View real projects in ProjectSelector
- Toggle favorites
- Auto-open last project
- Switch between projects

**Next Milestone:** Complete Phase 3-5 to enable full project setup → preview loop

**Estimated Time:**
- Phase 3: ~4-6 hours
- Phase 4: ~2-3 hours
- Phase 5: ~6-8 hours
- Phase 6: ~4-5 hours
- Phase 7: ~12-16 hours (most complex)
- Phase 8: ~6-8 hours

**Total Remaining:** ~34-46 hours of development
