# BeeSwarm 🐝 - Technical Architecture Document

**Version:** 2.0
**Last Updated:** 2024-11-01
**Purpose:** Visual wrapper for Claude Code CLI - enables non-technical users to build/edit web apps through natural language

**Implementation Status:**
- ✅ Phases 1-4 Complete: Auth, Templates, Projects, Dev Servers, Preview, Terminal
- ⚠️ Phase 5+ Coming Soon: Claude Code integration, Editing Loop, Deployment

**See Also:**
- `TEMPLATE_GUIDE.md` - Complete template structure and requirements
- `UNIFIED_TERMINAL.md` - Terminal system documentation

---

## Core Concept

**What it is:** Electron desktop app that provides a visual interface for Claude Code CLI with pre-built templates.

**Business Model:** Subscription-based (managed via web app) - Electron app reads subscription status from MongoDB

**Key Principle:** Everything runs locally on user's machine. Authentication and subscription management happen on the website. Electron app only reads user/subscription data from MongoDB.

**Claude Code Integration:** BeeSwarm uses the Claude Code SDK (@anthropic-ai/claude-agent-sdk) to provide AI-powered code editing. The SDK provides structured responses that we parse and display beautifully in the unified terminal. Users don't need to learn terminal commands - they just chat naturally.

---

## Technology Stack

### Desktop App
- **Electron + Chromium** (like VS Code, Cursor)
- **Main Process:** Node.js backend (IPC handlers, services, process management)
- **Renderer Process:** React + TypeScript + TailwindCSS + Zustand
- **Terminal:** node-pty for interactive shell + xterm.js for display
- **Unified Terminal:** TerminalAggregator combines output from all sources (dev server, shell, npm, git, Claude)
- **Preview:** BrowserView (embedded Chromium)
- **Security:** safeStorage for API key encryption

### User's Local Environment
- **Claude Code SDK**: Programmatic agent library ✅ **IMPLEMENTED**
  - Uses: `@anthropic-ai/claude-agent-sdk`
  - Integrated directly into BeeSwarm's main process
  - Provides structured message streaming (tool_use, tool_result, system, assistant)
- **Anthropic API Key**: User provides their own, stored encrypted locally ✅ **IMPLEMENTED**
- **Dev Server**: Netlify Dev (single server that proxies Vite frontend)
  - Netlify CLI runs on ports 8888-8999 (auto-allocated)
  - Vite dev server on ports 5174-5285 (auto-calculated, paired with Netlify port)
  - Automatic port configuration to prevent conflicts
- **Backend**: Netlify Functions (serverless, no separate backend server)
- **Git**: Local version control (auto-commit: Coming Soon)
- **Node.js**: Required for Netlify CLI and dev servers

### Cloud Services

#### Your Website/Web App
- **Frontend**: React for marketing + subscription management
- **Purpose**: User registration, Stripe checkout, subscription management
- **Auth**: Supabase (Google, Facebook, email/password)
- **Payment**: Stripe integration (checkout, webhooks, portal)

#### Your Backend (MongoDB Atlas)
- **Database**: MongoDB Atlas
- **Collections**:
  - `users`: userId, email, auth provider, plan, subscription status, createdAt
  - `subscriptions`: userId, stripeSubscriptionId, plan, status, validUntil
  - `templates`: id, name, category, requiredServices, githubUrl, allowedPlans
- **Purpose**: User data, subscription status, template catalog

#### Supabase
- **Auth Only**: Google OAuth, Facebook OAuth, Email/Password
- **Returns**: JWT token for session management

### Deployment Integration
- **Platform**: Netlify (primary deployment target)
- **Method**: Netlify CLI + OAuth
- **Runs**: Locally on user's machine

---

## Architecture Flow

```
Electron App (Local)
    ↓
Supabase Auth (reads only) → JWT Token
    ↓
MongoDB Atlas (reads user/subscription/templates)
    ↓
Claude Code CLI (local) → Edits files (Coming Soon)
    ↓
Netlify Dev (local) → Proxies Vite + Functions → Preview
    ↓
Netlify (deployment - Coming Soon)

Website (Separate)
    ↓
Supabase Auth + Stripe → Manages subscriptions
    ↓
MongoDB Atlas (writes user/subscription data)
```

### Complete User Flow

**1. Installation & Authentication**
```
1. User downloads BeeSwarm.dmg/.exe
2. Install electron app
3. Launch app → Login screen
4. Click "Login with Google" (or Facebook/Email)
5. Supabase auth popup → User authorizes
6. App receives JWT token
7. App queries MongoDB: GET user by email
8. MongoDB returns: { plan: 'free', subscriptionStatus: 'active' }
9. We have a free plan, plus and premium. When user wants to change subscription → Links to website
10. macOS shows permission dialog: "BeeSwarm wants to access your Documents folder" → User clicks Allow
```

**2. Claude Code CLI Setup**
```
11. App checks: Is Claude Code CLI installed?
12. If NO:
    - Show sheet: "Installing Claude Code CLI..."
    - Run: npm install -g @anthropic-ai/claude-code
    - No permission asked, just notify
    - Installation completes
13. Prompt user for Anthropic API key OR oauth2. I think claude code returns a link where user can click and authorize on their website. We need to check how to parse this and show beautifuly to the frontend.
14. User enters key → Validate by spawning Claude Code CLI with test message 
15. Store key encrypted in OS keychain (safeStorage)
```

**3. Template Selection**
```
16. Fetch templates from MongoDB 
17. Free users see: all plans, but cant use templates above their plan
18. Premium templates show "Pro" badge + "Upgrade" link
19. User selects template (e.g., "SaaS Starter")
20. User enters project name
21. Clone template from GitHub to: ~/Documents/BeeSwarm/Projects/project-name/
22. Save to SQLite: project metadata (id, name, path, templateId, status). 
```

**4. Configuration Wizard**
```
23. Show configuration wizard (dynamic based on manifest.json)
24. User enters required service credentials:
    - Supabase URL + Anon Key
    - Stripe Public + Secret Key
    - MongoDB Connection String
25. App writes to .env.frontend and .env.backend
26. Run npm install (both frontend & backend)
27. Start dev servers (Vite + Nodemon)
28. Create BrowserView → Load localhost:5173
29. Show preview with action bar
```

**5. Editing Loop (Core Workflow)** ⚠️ **Coming Soon**

> **Current Status:** Claude Code CLI integration not yet implemented. Terminal infrastructure (PTY, output streaming, aggregation) is complete and ready.

**Planned Flow:**
```
30. User types in action bar: "Change hero headline to 'Welcome to My App'"
31. Click Send
32. IPC: Renderer → Main Process
33. Main Process spawns Claude Code CLI via node-pty (if not already running)
34. Write to PTY stdin: user's message + "\n"
35. Claude Code CLI analyzes codebase + makes edits
36. PTY streams output → TerminalAggregator → Unified Terminal
37. Main Process parses output for UI display
38. File changes detected
39. Restart Netlify Dev server
40. Check for console errors → Auto-fix if needed (max 3 retries)
41. Git auto-commit on success (Coming Soon)
42. Preview auto-refreshes
43. User sees updated app
```

**6. Subsequent Edits** ⚠️ **Coming Soon**
```
46. User types: "Add a pricing section below the hero"
47. Repeat editing loop
48. Each iteration: Prompt → Edit → Commit → Restart → Preview
49. User can view raw output in Unified Terminal
50. Or see parsed UI showing changes
```

**7. Deployment** ⚠️ **Coming Soon**

> **Current Status:** Netlify deployment not yet implemented. Templates are ready for deployment (Netlify Functions, proper build configuration).

**Planned Flow:**
```
51. User clicks "Deploy" in action bar
52. Netlify OAuth flow (one-time setup)
53. Deploy modal with site name input
54. Run: npm run build (frontend)
55. Deploy via Netlify CLI: netlify deploy --prod
56. Stream deployment logs to Unified Terminal
57. Save deployment URL to database
58. Show success with visit/copy URL buttons
```

**8. Subscription Management (Separate Flow)**
```
- User wants to upgrade/cancel/manage subscription
- Clicks "Manage Subscription" in settings
- Opens system browser → your website
- Website: User logs in with same Supabase auth
- Website: Stripe Customer Portal OR custom subscription UI
- User upgrades/cancels
- Website updates MongoDB: subscriptions collection
- Next time user opens Electron app → Reads new subscription status from MongoDB
- App now shows premium templates (if upgraded)
```

---

## File Structure

### Electron App
```
beeswarm/
├── main/                           # Electron Main Process
│   ├── index.ts                    # Entry point
│   ├── handlers/                   # IPC handlers
│   │   ├── authHandlers.ts         # Supabase auth + MongoDB user lookup
│   │   ├── templateHandlers.ts     # Fetch from MongoDB, clone from GitHub
│   │   ├── projectHandlers.ts      # Project CRUD, dependencies, env config
│   │   ├── processHandlers.ts      # Netlify Dev server management
│   │   ├── previewHandlers.ts      # BrowserView control (navigate, devtools)
│   │   └── terminalHandlers.ts     # Terminal sessions (create, input, history)
│   │   # Coming Soon:
│   │   # ├── claudeHandlers.ts     # Claude Code CLI spawning
│   │   # └── deploymentHandlers.ts # Netlify deployment
│   │
│   ├── services/
│   │   ├── AuthService.ts          # Supabase OAuth (Google, Facebook, GitHub)
│   │   ├── MongoService.ts         # MongoDB Atlas queries (read-only)
│   │   ├── DatabaseService.ts      # SQLite operations (local data)
│   │   ├── ProcessManager.ts       # Netlify Dev server lifecycle
│   │   ├── PortService.ts          # Dynamic port allocation (Netlify + Vite)
│   │   ├── ProcessPersistence.ts   # PID tracking for orphan cleanup
│   │   ├── TemplateService.ts      # Clone from GitHub + auto-config
│   │   ├── TemplateValidator.ts    # Validate template structure
│   │   ├── EnvService.ts           # Read/write .env files
│   │   ├── DependencyService.ts    # npm install orchestration
│   │   ├── TerminalService.ts      # PTY-based interactive shell sessions
│   │   ├── TerminalAggregator.ts   # Unified output from all sources
│   │   └── PreviewService.ts       # BrowserView management
│   │   # Coming Soon:
│   │   # ├── ClaudeService.ts      # PTY management for Claude Code CLI
│   │   # ├── GitService.ts         # Git auto-commit
│   │   # └── DeploymentService.ts  # Netlify deployment
│   │
│   └── utils/
│       ├── paths.ts
│       ├── encryption.ts
│       └── logger.ts
│
├── renderer/                       # React UI
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.tsx           # Supabase auth buttons
│   │   │   ├── ApiKeySetup.tsx     # Anthropic key input
│   │   │   └── SubscriptionBanner.tsx  # "Upgrade to Pro" banner
│   │   │
│   │   ├── TemplateSelector/
│   │   │   ├── TemplateSelector.tsx    # Grid with free/premium badges
│   │   │   └── TemplateCard.tsx
│   │   │
│   │   ├── ConfigurationWizard/
│   │   │   └── ConfigurationWizard.tsx # Service inputs
│   │   │
│   │   ├── ActionBar/
│   │   │   ├── ActionBar.tsx       # Chat input + action buttons
│   │   │   └── ChatInput.tsx
│   │   │
│   │   ├── Preview/
│   │   │   └── PreviewContainer.tsx    # BrowserView wrapper
│   │   │
│   │   ├── Modals/
│   │   │   ├── ChatModal.tsx       # Parsed Claude output
│   │   │   ├── TerminalModal.tsx   # Raw xterm.js output
│   │   │   ├── ImagesModal.tsx
│   │   │   ├── DeployModal.tsx
│   │   │   └── SettingsModal.tsx
│   │   │
│   │   └── ImageManager/
│   │       ├── ImageGrid.tsx
│   │       └── ImageCropper.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts              # Supabase auth
│   │   ├── useClaude.ts            # Claude streaming
│   │   ├── useSubscription.ts      # Read from MongoDB
│   │   └── useIPC.ts
│   │
│   └── store/
│       ├── authStore.ts
│       ├── projectStore.ts
│       └── subscriptionStore.ts
│
└── preload/
    └── index.ts                    # IPC bridge
```

### Local Storage (SQLite)
```
~/Library/Application Support/BeeSwarm/database.db

Tables:
- projects
  Current fields:
    • id, name, path, templateId, templateName, status
    • isFavorite, configCompleted, dependenciesInstalled
    • envVars (JSON), createdAt, lastOpenedAt
  Planned fields (Coming Soon):
    • deploymentUrl, deployedAt, devServerPort

- chat_history (Coming Soon)
  Planned: id, projectId, role, message, timestamp

- git_commits (Coming Soon)
  Planned: id, projectId, hash, message, timestamp
```

### MongoDB Atlas Collections
```
users {
  _id: ObjectId,
  email: string,
  authProvider: 'google' | 'facebook' | 'email',
  plan: 'free' | 'pro' | 'enterprise',
  subscriptionStatus: 'active' | 'expired' | 'canceled',
  stripeCustomerId: string,
  createdAt: Date
}

subscriptions {
  _id: ObjectId,
  userId: ObjectId,
  stripeSubscriptionId: string,
  plan: 'pro' | 'enterprise',
  status: 'active' | 'past_due' | 'canceled',
  currentPeriodEnd: Date
}

templates {
  _id: ObjectId,
  id: string,
  name: string,
  description: string,
  category: 'frontend' | 'fullstack' | 'saas',
  githubUrl: string,
  isPremium: boolean,
  requiredServices: ['supabase', 'stripe', 'mongodb'],
  thumbnail: string
}
```

### User Project Structure (Local)
```
~/Documents/BeeSwarm/Projects/my-saas-app/
├── frontend/                   # React + Vite
│   ├── src/
│   ├── .env                    # Frontend env vars (VITE_ prefix)
│   ├── package.json
│   └── vite.config.ts          # Auto-configured with allocated port
├── netlify/
│   └── functions/              # Serverless functions (backend logic)
│       ├── hello.ts
│       └── users.ts
├── .env                        # Function env vars (in root)
├── .claude/                    # Claude Code instructions (optional)
│   └── instructions.md
├── config/                     # BeeSwarm metadata (optional)
│   └── project-images.json
├── netlify.toml                # Auto-configured with allocated ports
├── package.json                # Root package.json (netlify-cli)
└── .git/                       # Local git
```

---

## Core Components

### 1. Authentication System
- Login via Supabase (Google/Facebook/Email OAuth)
- JWT token received from Supabase
- Query MongoDB for user + subscription status
- No payment in app - redirect to website for subscription management
- Show "Upgrade to Pro" banner if free user
- Store JWT encrypted locally

### 2. Claude Code CLI Integration ⚠️ **Coming Soon**
- Auto-install will be implemented
- Spawn via node-pty (infrastructure ready)
- Write user prompts to stdin
- Output streamed to Unified Terminal
- Parse stdout/stderr for UI display
- Infrastructure complete: TerminalService, TerminalAggregator, xterm.js

### 3. Template System
- Fetch template list from MongoDB (filtered by user plan)
- Free users see free templates only
- Premium templates show badge + upgrade link
- Clone from GitHub when selected
- Configuration wizard for service credentials
- Write to .env files

### 4. Editing Workflow ⚠️ **Coming Soon**
- User types natural language
- Send to Claude Code CLI stdin
- Stream to Unified Terminal
- Parse output for UI display
- Detect file changes
- Restart Netlify Dev server
- Check console errors → Auto-fix (max 3 retries)
- Git auto-commit on success (Coming Soon)
- Preview auto-refreshes

### 5. Preview Window
- BrowserView embedding localhost
- F12 opens DevTools
- Viewport size controls (mobile/tablet/desktop)
- External links open in system browser

### 6. Action Bar
- Chat input for natural language
- Images button → Image management modal
- Deploy button → Netlify deployment
- Settings button → App settings

### 7. Chat Interface
- Parsed view (default): Pretty UI cards showing what Claude is doing
- Raw terminal view (optional): xterm.js showing full Claude Code CLI output
- User can toggle between views
- Stop button to kill Claude process

### 8. Image Management
- Grid of images from images.json
- Upload + crop to exact dimensions
- Replace images in project
- Auto-restart dev servers after changes

### 9. Deployment ⚠️ **Coming Soon**
- Netlify OAuth (one-time setup)
- Site name input
- Deploy button → Runs build + netlify deploy
- Stream deployment logs to Unified Terminal
- Shows live URL on success

### 10. Git Integration ⚠️ **Coming Soon**
- Auto-commit after each successful edit loop
- Commit message from Claude's description
- Store in SQLite for history
- Rollback feature (future)

### 11. Unified Terminal System ✅ **Implemented**
- **TerminalService**: PTY-based interactive shell sessions (one per project)
- **TerminalAggregator**: Merges output from multiple sources
  - dev-server (Netlify Dev output) - Cyan
  - shell (user commands) - Green
  - npm (dependency installs) - Yellow
  - git (version control) - Magenta
  - claude (AI operations) - Blue (Coming Soon)
  - system (app notifications) - Gray
- **TerminalModal**: xterm.js frontend with color-coded source tags
- Real-time streaming, timestamps, command input
- Session history (1000 lines per project)
- See `UNIFIED_TERMINAL.md` for complete documentation

---

## Data Storage Strategy

### SQLite (Local - User's Machine)
**Location:** `~/Library/Application Support/BeeSwarm/database.db`
**Purpose:** Fast local queries, offline access
**Data:**
- Projects (id, name, path, status, deploymentUrl, createdAt, lastOpenedAt)
- Chat history per project
- Git commit history
- Last opened templates
- App preferences (theme, viewport size)

### MongoDB Atlas (Cloud - Your Database)
**Purpose:** User accounts, subscriptions, template catalog
**Data:**
- Users (email, plan, subscriptionStatus, authProvider)
- Subscriptions (stripeSubscriptionId, status, currentPeriodEnd)
- Templates (name, category, githubUrl, isPremium, requiredServices)
- (Optional) Project cloud backups for premium users

### OS Keychain (Encrypted)
**Purpose:** Maximum security for sensitive data
**Data:**
- Anthropic API key
- Supabase JWT token
- Netlify OAuth token

### File System
**Purpose:** Template cache, user projects
**Data:**
- Cloned templates from GitHub
- User's project files (in ~/Documents/BeeSwarm/Projects/)

---

## Output Parsing Strategy

### Claude Code CLI Output Examples
```
📝 Editing src/components/Hero.tsx
   - Changed headline text
   - Updated button color

🔄 Running tests...

✅ All tests passed
```

### Parser Logic
**Detect patterns:**
- `📝 Editing {filename}` → Show file card with editing status
- `✅` → Success state
- `❌` → Error state
- `🔄` → Loading state
- File paths → Make clickable in UI
- Code blocks → Syntax highlight

**Transform to UI:**
```json
{
  "type": "file_edit",
  "filename": "Hero.tsx",
  "status": "editing",
  "changes": [
    "Changed headline text",
    "Updated button color"
  ]
}
```

**Display in UI:**
```
┌────────────────────────────────┐
│ 📝 Editing Hero.tsx            │
│ • Changed headline text        │
│ • Updated button color         │
│ [View Changes]                 │
└────────────────────────────────┘
```

---

## Subscription Flow (Website)

### On Your Website/Web App

**Tech Stack:**
- Next.js or React SPA
- Supabase Auth (same config as Electron app)
- Stripe Checkout + Customer Portal
- MongoDB Atlas (same database)

**User Journey:**
```
1. User clicks "Upgrade to Pro" in Electron app
2. Opens system browser → your-website.com/pricing
3. User logs in with same Supabase account (Google/Facebook/Email)
4. Shows pricing plans
5. User clicks "Subscribe to Pro - $20/month"
6. Stripe Checkout modal opens
7. User enters payment info
8. Stripe processes payment
9. Stripe webhook → Your server
10. Server updates MongoDB: 
    - users.plan = 'pro'
    - users.subscriptionStatus = 'active'
    - Create subscription document with stripeSubscriptionId
11. Website shows: "✅ You're now a Pro user!"
12. User returns to Electron app
13. App fetches user data from MongoDB
14. Now shows premium templates
```

**Website Pages:**
- `/` - Landing page
- `/pricing` - Pricing plans + Stripe checkout
- `/login` - Supabase auth
- `/dashboard` - Account management
- `/billing` - Stripe Customer Portal iframe (manage/cancel subscription)

---

## Development Phases

### Phase 1: Foundation ✅ **COMPLETE**
- ✅ Electron app boilerplate with React
- ✅ IPC architecture (handlers/ directory)
- ✅ Supabase auth integration (Google, Facebook, GitHub)
- ✅ MongoDB Atlas connection (read-only)
- ✅ SQLite setup with projects table
- ✅ Login screen + JWT handling
- ✅ Template selector (fetch from MongoDB)

### Phase 2: Project Management ✅ **COMPLETE**
- ✅ Template cloning from GitHub
- ✅ Template validation system
- ✅ Configuration wizard (dynamic env var collection)
- ✅ Write to .env files (frontend + root)
- ✅ npm install automation (root → frontend → backend)
- ✅ Automatic port allocation (Netlify + Vite pairs)
- ✅ Auto-configuration (vite.config.ts, netlify.toml)

### Phase 3: Dev Server Management ✅ **COMPLETE**
- ✅ Netlify Dev process management
- ✅ Process states (starting, running, crashed, error)
- ✅ HTTP health checks (reliable server detection)
- ✅ Port conflict handling (auto-retry, 3 attempts)
- ✅ Orphaned process cleanup (PID tracking)
- ✅ Output capture and streaming
- ✅ Process crash recovery

### Phase 4: Preview & Terminal ✅ **COMPLETE**
- ✅ BrowserView preview window
- ✅ DevTools integration (F12 toggle)
- ✅ Console message capture
- ✅ Navigation handling
- ✅ TerminalService (PTY-based interactive shell)
- ✅ TerminalAggregator (unified output from all sources)
- ✅ TerminalModal (xterm.js with color-coded source tags)
- ✅ Real-time output streaming to terminal

### Phase 5: Claude Integration ✅ **COMPLETE**
- ✅ Claude Code SDK integration (@anthropic-ai/claude-agent-sdk)
- ✅ API key setup + validation
- ✅ Session management with resume capability
- ✅ Rich output parsing for beautiful terminal display
- ✅ Chat interface with message streaming
- ✅ Stop/abort Claude operations
- ✅ Tool execution tracking (Read, Write, Edit, Bash, etc.)
- ✅ Progress indicators with elapsed time
- ✅ Visual blocks for different message types

### Phase 6: Editing Loop ✅ **COMPLETE**
- ✅ Complete editing workflow (prompt → Claude → commit → restart)
- ✅ File change detection (via Claude SDK tool results)
- ✅ Dev server restart logic with beautiful terminal blocks
- ✅ Git auto-commit with detailed progress display
- ✅ Preview auto-refresh
- ✅ Context persistence (tokens, cost, model)
- ⏳ Console error detection (future enhancement)
- ⏳ Error auto-fix loop (future enhancement)
- ⏳ Chat history in SQLite (future enhancement)

### Phase 7: Deployment ⚠️ **NOT STARTED**
- ⏳ Netlify OAuth integration
- ⏳ Deploy button + modal
- ⏳ Build + deploy via Netlify CLI
- ⏳ Stream deployment logs to Unified Terminal
- ⏳ Save deployment URL to SQLite
- ⏳ Copy/visit URL buttons

### Phase 8: Advanced Features ⚠️ **NOT STARTED**
- ⏳ Image management system
- ⏳ Image cropper with aspect ratio lock
- ⏳ images.json tracking
- ⏳ Git commit history viewer
- ⏳ Rollback functionality
- ⏳ Settings modal enhancements

### Phase 9: Website (Separate Track)
- Landing page
- Pricing page
- Stripe integration
- Supabase auth
- Customer portal
- Email notifications

---

## Current Status Summary

**✅ Completed Features:**
- Complete authentication system (Supabase + MongoDB)
- Template management (fetch, clone, validate, auto-config)
- Project management (CRUD, favorites, env vars)
- Dev server management (Netlify Dev with auto-port allocation)
- Live preview (BrowserView with DevTools)
- Unified terminal system (aggregated output from all sources)
- Configuration wizard (dynamic based on template requirements)
- Dependency installation (orchestrated npm install)

**⚠️ Coming Soon (Core Features):**
- Claude Code CLI integration (the main editing capability)
- Git auto-commit workflow
- Netlify deployment

**Status:** BeeSwarm has a complete project management shell ready for Phase 5 (Claude Code integration), which will enable the core AI editing functionality.

---

## Security Considerations

### Electron App Security
- contextIsolation: true
- nodeIntegration: false in renderer
- Preload script for safe IPC
- Content Security Policy headers
- API keys encrypted with safeStorage
- JWT tokens encrypted
- External links open in system browser only
- No eval() or remote code execution

### MongoDB Security
- Read-only access from Electron app
- Connection string stored encrypted
- No sensitive data in MongoDB (payment info stays in Stripe)
- Proper indexes for query performance

### Supabase Security
- OAuth only (no password storage in app)
- JWT tokens short-lived
- Refresh token flow
- Proper RLS policies (if using Supabase database later)

### Claude Code CLI
- Uses user's own API key (they control costs)
- No code sent to your servers
- Everything local

---

## Available Documentation

### Implemented Systems

**UNIFIED_TERMINAL.md** ✅
- Complete documentation of the terminal system
- TerminalService, TerminalAggregator, TerminalModal
- How to add terminal output from any source
- Color-coded source types (dev-server, shell, npm, git, claude, system)
- Implementation guide with examples
- Best practices and troubleshooting

**TEMPLATE_GUIDE.md** ✅
- Complete template structure requirements
- Netlify Dev + Functions architecture
- Automatic port allocation system
- Configuration file examples
- Validation requirements
- Testing and troubleshooting

### Next Implementation Priorities

1. **Claude Code CLI Integration** (Phase 5)
   - Install/detect Claude Code CLI
   - API key setup flow
   - Spawn via node-pty
   - Output streaming to Unified Terminal
   - Parse output for UI display
   - Infrastructure is ready

2. **Editing Loop** (Phase 6)
   - Complete workflow from prompt to preview
   - File change detection
   - Dev server restart
   - Console error detection and auto-fix
   - Preview auto-refresh

3. **Git Auto-Commit** (Phase 6)
   - Commit after successful edits
   - Store commit history
   - Future: Commit viewer and rollback

4. **Netlify Deployment** (Phase 7)
   - OAuth integration
   - Build + deploy workflow
   - Stream logs to Unified Terminal
   - Save deployment URLs

---

## Critical Notes

### Claude Code CLI vs SDK
**BeeSwarm uses Claude Code CLI (the interactive terminal tool), NOT the SDK:**
- CLI is installed via: `npm install -g @anthropic-ai/claude-code`
- Launched via: `claude` command
- We spawn this via node-pty and control via stdin/stdout
- SDK is a different library for programmatic agent building
- We want the full interactive experience, not programmatic control

### Why This Architecture Works
- Users get full Claude Code CLI features (file ops, bash, web search, MCP)
- Authentication handled by Claude Code CLI itself (uses user's API key)
- No need to reimplement agent logic
- System prompts configurable via `.claude/` directory
- Terminal output is parseable and can be displayed beautifully
- Users can always see raw terminal if needed

### Subscription Separation
- **Electron app**: Reads subscription status from MongoDB (read-only)
- **Website**: Manages subscriptions (Stripe checkout, webhooks, customer portal)
- **Communication**: Same Supabase auth, same MongoDB, seamless experience

