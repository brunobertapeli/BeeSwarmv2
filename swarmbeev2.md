# BeeSwarm 🐝 - Technical Architecture Document

**Version:** 1.0  
**Purpose:** Visual wrapper for Claude Code SDK - enables non-technical users to build/edit web apps through natural language

---

## Core Concept

**What it is:** Electron desktop app that abstracts Claude Code SDK into a visual interface with templates.

**Business Model:** Flat fee subscription (your server) + users bring own Anthropic API key

**Key Principle:** Everything runs locally on user's machine except auth/payment/license validation

---

## Technology Stack

### Desktop App
- **Electron + Chromium** (like VS Code, Cursor)
- **Main Process:** Node.js backend (IPC handlers, services, process management)
- **Renderer Process:** React + TypeScript + TailwindCSS + Zustand
- **Terminal:** node-pty for Claude Code SDK + xterm.js for display
- **Preview:** BrowserView (embedded Chromium)
- **Security:** safeStorage for API key encryption

### User's Local Environment
- **Claude Code SDK** (via node-pty, uses user's Anthropic key)
- **Dev Servers:** Vite (frontend) + Nodemon (backend) as child processes
- **Git:** simple-git for local version control
- **Ports:** Auto-assigned via detect-port

### Your Backend Server
- **Node.js + Express + MongoDB**
- **Purpose:** Auth (JWT), Stripe subscriptions, license validation ONLY
- **Does NOT handle:** Code, files, edits, or any project data

---

## Architecture Flow

```
User → Electron UI → Local Node Backend → Claude Code SDK → Local Files → Live Preview
                 ↓
          Your Server (Auth/Payment/License only)
```

### Data Flow: Making Changes
1. User types in chat → IPC to Main Process
2. Main spawns Claude Code SDK via node-pty (uses user's API key)
3. Claude analyzes/edits files locally
4. Main streams PTY output → Renderer displays in xterm.js
5. File changes detected → Restart dev servers
6. Check console errors → If errors, send back to Claude (max 3 retries)
7. Success → Git commit → BrowserView auto-refreshes
8. User sees changes in preview

### Authentication Flow
1. App launch → Check stored token → Validate with your server
2. No/invalid token → Show login/register
3. After auth → Check subscription (Stripe)
4. No subscription → Show payment screen
5. Active subscription → Request Anthropic API key
6. Validate key with Anthropic → Store encrypted
7. License check runs every 24h in background

---

## File Structure

### Electron App
```
beeswarm/
├── main/                    # Electron Main Process (Node.js)
│   ├── index.ts            # Entry point
│   ├── ipc/                # IPC handlers (auth, templates, claude, git, etc.)
│   ├── services/           # AuthService, ClaudeService, ProcessManager, etc.
│   └── utils/              # Helpers, encryption, logging
│
├── renderer/               # React UI
│   ├── components/         # Auth, TemplateSelector, ActionBar, Modals, etc.
│   ├── hooks/              # useAuth, useClaude, useIPC, etc.
│   ├── store/              # Zustand stores (auth, project, preview)
│   └── services/           # IPC wrappers
│
├── preload/                # Security bridge
│   └── index.ts            # Exposes safe IPC API
│
└── assets/                 # Icons, tutorial videos
```

### Your Server
```
beeswarm-server/
├── src/
│   ├── routes/             # auth, subscription, license
│   ├── controllers/        # Business logic
│   ├── models/             # User, Subscription (MongoDB)
│   └── middleware/         # JWT auth, rate limiting
```

### User Projects (Local)
```
~/Documents/BeeSwarm/Projects/project-name/
├── frontend/               # React + Vite
├── backend/                # Node + Express (optional)
├── .config/                # manifest.json, images.json
├── .env files              # Service credentials
└── .git/                   # Local version control
```

---

## Core Components Overview

### 1. Authentication System
- Login/Register screens
- Payment screen (Stripe Checkout in browser)
- API key setup (Anthropic)
- Background license validation (24h intervals)

### 2. Template Selector
- Grid of templates from your GitHub
- Search/filter by category
- Preview and clone to local disk
- Project name input

### 3. Configuration Wizard
- Dynamic form based on template's manifest.json
- Input fields for required services (MongoDB, Stripe, Supabase, etc.)
- Video tutorials for each service
- Writes to .env files → npm install → start dev servers

### 4. Main Workspace
- Full-screen BrowserView (preview of running app)
- Floating action bar (chat input + action buttons)
- Everything overlays on preview

### 5. Action Bar
- **Chat Input:** Text field for Claude commands
- **Working Indicator:** Shows Claude status (clickable for full terminal)
- **Images Button:** Opens image management modal
- **API Keys Button:** Opens .env editor
- **Settings Button:** Opens app settings
- **Deploy Button:** Opens Netlify deployment

### 6. Chat Modal
- Full terminal view (xterm.js)
- Streams Claude Code SDK output in real-time
- Shows files being edited, diffs, progress
- Draggable/resizable
- Stop button to kill Claude process

### 7. Image Management Modal
- Grid of all images from images.json
- Each card: thumbnail, path, dimensions, replace button
- Image cropper for uploaded images (locked aspect ratio)
- Save → Updates files → Restarts servers → Refreshes preview

### 8. API Keys Modal
- Tabs for Frontend/Backend .env files
- List all variables with edit/delete buttons
- Add new variables
- Password masking for sensitive values
- Save → Restarts dev servers

### 9. Deploy Modal
- Connect Netlify via OAuth
- Site name input with availability check
- Deploy button → Streams build/upload logs (xterm.js)
- Success → Shows live URL with copy/visit buttons
- Auto-deploys frontend .env to Netlify

### 10. Version History Modal
- List of Git commits (from simple-git)
- Each commit: message, timestamp, hash
- Click to view diff
- Rollback button to restore previous version

### 11. Settings Modal
- General: theme, language, auto-save interval
- Claude: max retries, show terminal by default
- Project: default directory, auto-start servers
- Account: email, subscription status, logout

---

## Template Structure

### Template Repository (Your GitHub)
```
template-name/
├── frontend/               # Complete React app
├── backend/                # Complete Node.js app (optional)
├── .config/
│   ├── manifest.json       # Metadata: name, services, ports, hasBackend
│   └── images.json         # Image inventory: id, path, width, height
└── README.md
```

### manifest.json Schema
```json
{
  "name": "SaaS Starter",
  "description": "...",
  "thumbnail": "preview.png",
  "category": "saas",
  "requiredServices": ["mongodb", "stripe"],
  "optionalServices": ["supabase"],
  "hasBackend": true,
  "ports": {
    "frontend": 5173,
    "backend": 3000
  }
}
```

### images.json Schema
```json
[
  {
    "id": "hero-bg",
    "path": "frontend/public/hero.jpg",
    "width": 1920,
    "height": 1080,
    "currentSrc": "/hero.jpg"
  }
]
```

### System Prompt for Claude
When Claude Code SDK runs, include in system prompt:
- Update images.json when adding/removing images
- Follow project's existing code style
- Test changes before finishing
- Commit message format: Brief description of change

---

## User Flows

### First Launch → Editing
1. Launch app → Check license
2. Not authenticated → Login/Register
3. No subscription → Payment (Stripe)
4. No API key → Enter Anthropic key
5. Select template → Enter project name
6. Clone template → Configure services (.env)
7. npm install + start dev servers
8. Show preview with action bar
9. User types change → Claude edits → Preview updates

### Error Recovery Loop
1. Claude makes changes
2. Restart dev servers
3. Check console for errors
4. If errors: Send to Claude → Fix → Retry (max 3x)
5. If no errors: Git commit → Done

### Deployment Flow
1. Connect Netlify (OAuth)
2. Enter site name
3. Deploy → Build + upload (streamed logs)
4. Success → Show URL

---

## Development Phases

### Phase 1: Foundation
- Electron app setup with React
- IPC architecture
- Auth screens + your server integration
- API key storage (encrypted)
- Template selector (hardcoded list initially)

### Phase 2: Core Editing
- Template cloning from GitHub
- Configuration wizard
- Dev server process management
- Claude Code SDK integration via node-pty
- Chat interface with xterm.js
- BrowserView preview

### Phase 3: Advanced Features
- Error detection and auto-fix loop
- Git integration (commits, history, rollback)
- Image management system
- API keys (.env) editor
- Settings modal

### Phase 4: Deployment
- Netlify OAuth integration
- Deployment flow with logs
- Environment variable deployment

### Phase 5: Polish
- Onboarding flow
- Tutorial videos
- Error handling and user feedback
- Performance optimization
- Testing and bug fixes

---

## Security Considerations

### Local Security
- API keys encrypted with Electron safeStorage
- .env files never transmitted
- JWT tokens encrypted locally
- No code/project data leaves user's machine

### Server Security
- JWT authentication for all endpoints
- Rate limiting on API
- Stripe webhook signature verification
- MongoDB connection with auth
- HTTPS only
- Input validation and sanitization

### Electron Security
- contextIsolation: true
- nodeIntegration: false in renderer
- Preload script for safe IPC exposure
- Content Security Policy headers
- External links open in system browser only

---

## API Endpoints (Your Server)

### Authentication
- POST /auth/register → Create account
- POST /auth/login → Get JWT token
- GET /auth/validate → Verify JWT

### Subscription
- POST /subscription/create → Create Stripe checkout session
- GET /subscription/status → Check if active
- POST /webhook/stripe → Handle payment events

### License
- GET /license/validate → Check if app license valid
- POST /license/revoke → Admin endpoint to revoke access

---

## Error Handling Strategy

### Console Error Detection
- Monitor stdout/stderr of dev servers
- Parse for common error patterns (syntax, runtime, compile)
- Extract error message, file, line number

### Claude Retry Logic
- Max 3 attempts to fix errors
- Each retry includes error details
- If all retries fail, show error to user with option to:
  - Try again manually
  - Rollback to last working version
  - Edit code directly (opens in system editor)

### User-Facing Errors
- Network errors (your server unreachable)
- Authentication failures
- Subscription expired
- Invalid API key
- Template clone failures
- Dev server crash
- Deployment failures

For each: Clear error message + actionable next steps

---

## Performance Considerations

### Optimization Targets
- App launch < 3 seconds
- Template clone < 30 seconds
- npm install progress feedback
- Dev server start < 10 seconds
- Claude response streaming (no buffering)
- Preview refresh < 1 second
- BrowserView smooth at 60fps

### Resource Management
- Kill child processes on app quit
- Clean up PTY sessions
- Limit log file sizes
- Cache template list locally
- Lazy load preview until servers ready

---

## Future Enhancements

### V2 Features
- AI image generation (DALL-E integration)
- Multiple projects open (tabs)
- Collaboration (real-time with other users)
- GitHub integration (push to remote)
- More deployment targets (Vercel, Railway)
- Template marketplace (community templates)
- Custom template creation tool
- Plugin system for extensions

---

## Notes for Implementation

### Critical Paths
1. Auth must work before anything else
2. API key must validate before accessing Claude
3. Dev servers must start before showing preview
4. Error detection must work before auto-fix loop

### Testing Priorities
1. Auth flow end-to-end
2. Claude Code SDK integration
3. Process management (start/stop/restart)
4. Error detection and retry logic
5. Git operations
6. Deployment flow

### Documentation Needed
- User guide (how to use app)
- Template creation guide (for your templates)
- API documentation (your server)
- Troubleshooting guide (common issues)

---

## Next Steps for Detailed Implementation

When ready to implement specific parts, create detailed MD for:
1. **auth-system.md** - Complete auth flow, JWT handling, license validation
2. **claude-integration.md** - PTY setup, streaming, parsing, system prompts
3. **process-management.md** - Child process lifecycle, port management, error detection
4. **preview-system.md** - BrowserView setup, DevTools, navigation handling
5. **git-integration.md** - Commit strategy, history, rollback, diff viewing
6. **deployment-system.md** - Netlify OAuth, build process, log streaming
7. **image-management.md** - Detection, tracking, cropping, replacement
8. **template-system.md** - Structure, manifest, cloning, configuration

Each detailed MD will contain:
- Step-by-step implementation instructions
- Code patterns and examples
- Edge cases and error handling
- Testing approach
- UI/UX specifications