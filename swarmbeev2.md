# BeeSwarm 🐝 - Technical Architecture Document

**Version:** 2.0  
**Purpose:** Visual wrapper for Claude Code CLI - enables non-technical users to build/edit web apps through natural language

---

## Core Concept

**What it is:** Electron desktop app that provides a visual interface for Claude Code CLI with pre-built templates.

**Business Model:** Subscription-based (managed via web app) - Electron app reads subscription status from MongoDB

**Key Principle:** Everything runs locally on user's machine. Authentication and subscription management happen on the website. Electron app only reads user/subscription data from MongoDB.

**Claude Code Integration:** BeeSwarm spawns the Claude Code CLI (NOT the SDK) via node-pty and streams its output to a visual interface. Users don't need to learn terminal commands - they just chat naturally.

---

## Technology Stack

### Desktop App
- **Electron + Chromium** (like VS Code, Cursor)
- **Main Process:** Node.js backend (IPC handlers, services, process management)
- **Renderer Process:** React + TypeScript + TailwindCSS + Zustand
- **Terminal:** node-pty for Claude Code CLI + xterm.js for display/parsing
- **Preview:** BrowserView (embedded Chromium)
- **Security:** safeStorage for API key encryption

### User's Local Environment
- **Claude Code CLI**: Terminal application installed automatically by BeeSwarm
  - Installed via: `npm install -g @anthropic-ai/claude-code` 
  - Spawned via node-pty from BeeSwarm's main process
- **Anthropic API Key**: User provides their own, stored encrypted locally
- **Dev Servers**: Vite dev server (frontend) + Nodemon (backend)
- **Git**: Local version control, auto-commit after each successful edit
- **Node.js**: Required for Claude Code CLI and dev servers

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
Claude Code CLI (local) → Edits files
    ↓
Dev Servers (local) → Preview
    ↓
Netlify (deployment)

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

**5. Editing Loop (Core Workflow)**
```
30. User types in action bar: "Change hero headline to 'Welcome to My App'"
31. Click Send
32. IPC: Renderer → Main Process
33. Main Process spawns Claude Code CLI via node-pty (if not already running)
34. Write to PTY stdin: user's message + "\n"
35. Claude Code CLI analyzes codebase + makes edits
36. PTY streams output (stdout/stderr) → Main Process captures
37. Main Process parses output:
    - "📝 Editing src/components/Hero.tsx" → Extract file name
    - Code diffs → Extract changes
38. IPC events → Renderer receives parsed data
39. Show in Chat Modal (xterm.js shows raw, UI sheet shows pretty cards)
40. File changes detected (chokidar watching project directory)
41. Restart dev servers (kill + restart Vite & Nodemon). 
42. Check console errors:
    - If errors: Send back to Claude Code CLI stdin: "/fix these errors: ..."
    - Retry max 3 times
43. If no errors OR fixes succeeded:
    - Git commit: "Changed hero headline"
    - Save commit to SQLite: chat_history
44. BrowserView auto-refreshes
45. User sees updated app
```

**6. Subsequent Edits**
```
46. User types: "Add a pricing section below the hero"
47. Repeat steps 31-45
48. Each iteration: Prompt → Edit → Commit → Restart → Preview
49. User can click "Show Terminal" to see raw Claude Code CLI output
50. Or just see parsed UI: "✓ Added PricingSection.tsx", "✓ Updated Hero.tsx"
```

**7. Deployment**
```
51. User clicks "Deploy" in action bar
52. Check: Is Netlify connected?
53. If NO:
    - Show modal: "Connect Netlify"
    - Click "Connect" → Opens system browser
    - Netlify OAuth flow → User authorizes BeeSwarm
    - Callback received → Store OAuth token encrypted
54. Show deploy modal:
    - Site name input (suggests project name)
    - Deploy button
55. User clicks "Deploy"
56. Main Process:
    - Run: npm run build (frontend)
    - Spawn Netlify CLI: netlify deploy --prod --dir=frontend/dist
    - Stream CLI output → Renderer
57. Show in modal (xterm.js): "Building...", "Uploading...", "Deploying..."
58. Netlify responds with URL
59. Show success: "✓ Deployed to https://my-app.netlify.app"
60. Save to SQLite: project.deploymentUrl, project.status = 'deployed'
61. Copy URL button + Visit Site button
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
│   ├── ipc/                        # IPC handlers
│   │   ├── auth.ts                 # Supabase auth + MongoDB user lookup
│   │   ├── templates.ts            # Fetch from MongoDB, clone from GitHub
│   │   ├── claude.ts               # Spawn Claude Code CLI via node-pty
│   │   ├── processes.ts            # Dev server management
│   │   ├── git.ts                  # Auto-commit after edits
│   │   ├── deployment.ts           # Netlify OAuth + CLI deployment
│   │   └── database.ts             # SQLite operations
│   │
│   ├── services/
│   │   ├── AuthService.ts          # Supabase JWT validation
│   │   ├── MongoService.ts         # MongoDB Atlas queries (read-only)
│   │   ├── DatabaseService.ts      # SQLite operations (local data)
│   │   ├── ClaudeService.ts        # PTY management for Claude Code CLI
│   │   ├── ProcessManager.ts       # Child process lifecycle
│   │   ├── GitService.ts           # Git operations
│   │   ├── TemplateService.ts      # Clone from GitHub
│   │   ├── DeploymentService.ts    # Netlify integration
│   │   ├── KeychainService.ts      # Encrypted storage (API keys, tokens)
│   │   └── OutputParser.ts         # Parse Claude Code CLI output
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
- projects (id, name, path, templateId, status, deploymentUrl, createdAt, lastOpenedAt)
- chat_history (id, projectId, role, message, timestamp)
- git_commits (id, projectId, hash, message, timestamp)
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
│   ├── .env                    # User's service keys
│   └── package.json
├── backend/                    # Node + Express
│   ├── src/
│   ├── .env
│   └── package.json
├── .config/                    # BeeSwarm metadata
│   ├── manifest.json
│   └── images.json
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

### 2. Claude Code CLI Integration
- Auto-install if not present (no permission, just notify)
- Spawn via node-pty
- Write user prompts to stdin
- Parse stdout/stderr in real-time
- Display parsed output in beautiful UI
- Keep raw terminal available in modal

### 3. Template System
- Fetch template list from MongoDB (filtered by user plan)
- Free users see free templates only
- Premium templates show badge + upgrade link
- Clone from GitHub when selected
- Configuration wizard for service credentials
- Write to .env files

### 4. Editing Workflow
- User types natural language
- Send to Claude Code CLI stdin
- Stream and parse output
- Detect file changes
- Restart dev servers
- Check console errors → Auto-fix (max 3 retries)
- Git auto-commit on success
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

### 9. Deployment
- Netlify OAuth (one-time setup)
- Site name input
- Deploy button → Runs build + netlify deploy
- Streams deployment logs
- Shows live URL on success

### 10. Git Integration
- Auto-commit after each successful edit loop
- Commit message: Brief description from Claude
- Store in SQLite for history
- Rollback feature (future)

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

### Phase 1: Foundation (Week 1-2)
- Electron app boilerplate with React
- IPC architecture
- Supabase auth integration
- MongoDB Atlas connection (read-only in app)
- SQLite setup with tables
- Login screen + JWT handling
- Template selector (fetch from MongoDB)

### Phase 2: Claude Integration (Week 3-4)
- Auto-install Claude Code CLI
- API key setup + validation
- Spawn Claude Code CLI via node-pty
- Stream output to renderer
- Basic output parsing
- Chat interface with xterm.js
- Stop/restart Claude process

### Phase 3: Project Management (Week 5-6)
- Template cloning from GitHub
- Configuration wizard (service credentials)
- Write to .env files
- npm install automation
- Dev server process management (Vite + Nodemon)
- BrowserView preview window
- Port auto-assignment

### Phase 4: Editing Loop (Week 7-8)
- Complete editing workflow
- File change detection
- Dev server restart logic
- Console error detection
- Error auto-fix loop (max 3 retries)
- Git auto-commit
- Preview auto-refresh
- Chat history in SQLite

### Phase 5: Advanced Features (Week 9-10)
- Image management system
- Image cropper with aspect ratio lock
- images.json tracking
- Git commit history viewer
- Rollback functionality (future)
- Settings modal
- Theme switching

### Phase 6: Deployment (Week 11-12)
- Netlify OAuth integration
- Deploy button + modal
- Build + deploy via Netlify CLI
- Stream deployment logs
- Save deployment URL to SQLite
- Copy/visit URL buttons

### Phase 7: Polish & Testing (Week 13-14)
- Improved output parsing (more patterns)
- Better error messages
- Loading states everywhere
- Onboarding flow
- Tutorial videos
- Help documentation
- Bug fixes
- Performance optimization

### Phase 8: Website (Parallel or After)
- Landing page
- Pricing page
- Stripe integration
- Supabase auth
- Customer portal
- Email notifications
- Analytics

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

## Next Steps: Detailed Implementation Guides

When ready to implement specific parts, generate these detailed MDs:

### 1. **auth-system.md**
- Supabase OAuth setup (Google, Facebook, Email)
- JWT token handling and refresh
- MongoDB user lookup queries
- Subscription status checks
- "Upgrade to Pro" banner logic
- Token encryption with safeStorage
- Session management
- Website redirect for subscription management

### 2. **claude-integration.md**
- Detecting if Claude Code CLI installed
- Auto-install via npm (silent, with notification)
- API key setup and validation flow
- Spawning Claude Code CLI via node-pty
- Writing to PTY stdin (user prompts, slash commands)
- Reading from PTY stdout/stderr
- Output parsing strategies (regex patterns, state machine)
- Handling Claude Code CLI errors
- Stop/restart logic
- System prompts via .claude/ directory

### 3. **process-management.md**
- Child process lifecycle (spawn, monitor, restart, kill)
- Port detection and auto-assignment
- Vite dev server management
- Nodemon backend server management
- Process crash recovery
- Logging stdout/stderr
- Console error detection (parsing error messages)
- Health checks for dev servers
- Graceful shutdown on app quit

### 4. **preview-system.md**
- BrowserView creation and lifecycle
- Embedding in Electron window
- Bounds calculation for responsive preview
- DevTools integration (F12 toggle)
- Navigation handling (external links)
- Reload/refresh logic
- Viewport size controls (mobile/tablet/desktop)
- Console log capturing
- Error page handling

### 5. **git-integration.md**
- Auto-commit strategy (after each successful edit)
- Commit message format (from Claude's description)
- Storing commits in SQLite
- Git history viewer UI
- Commit diff viewer
- Rollback/restore previous version
- Git status monitoring
- .gitignore handling
- Branch management (future)

### 6. **deployment-system.md**
- Netlify OAuth flow (browser popup)
- Storing OAuth tokens encrypted
- Site name validation (check availability)
- Build process (npm run build)
- Deploying via Netlify CLI
- Streaming deployment logs to UI
- Parsing Netlify CLI output
- Handling deployment errors
- Environment variable deployment
- Domain management (future)

### 7. **image-management.md**
- images.json schema and tracking
- Detecting images in templates
- Image grid UI
- File picker integration
- Image cropper component (aspect ratio lock)
- Crop + resize logic
- Replacing images in project
- Updating images.json
- Triggering dev server restart
- AI image generation integration (future)

### 8. **template-system.md**
- Template manifest.json schema
- Fetching templates from MongoDB
- Filtering by user plan (free vs premium)
- GitHub cloning logic
- Template categories and tags
- Configuration wizard (dynamic forms based on manifest)
- Service credential validation
- Writing to .env files
- npm install automation
- Template versioning
- Creating custom templates (future)

### 9. **database-system.md**
- SQLite schema design
- DatabaseService class implementation
- Project CRUD operations
- Chat history storage and retrieval
- Git commit tracking
- Querying recent projects
- Full-text search
- Database migrations
- Backup/restore
- MongoDB queries (read-only)

### 10. **output-parsing.md**
- Claude Code CLI output patterns
- Parser state machine
- Regex patterns for different message types
- Extracting filenames, line numbers, errors
- Building structured data from terminal output
- UI component mapping
- Real-time parsing during streaming
- Handling multi-line output
- ANSI color code handling

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

