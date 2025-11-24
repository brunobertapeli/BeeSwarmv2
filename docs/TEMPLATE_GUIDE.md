# BeeSwarm Template Guide

## Overview

BeeSwarm templates are pre-built web applications that use **Netlify Dev + Netlify Functions** architecture. Templates are cloned from GitHub and automatically configured for immediate local development.

**Key Features:**
- Automatic port allocation (no conflicts between projects)
- Serverless backend with Netlify Functions
- Vite dev server for frontend (React + TypeScript)
- Zero-configuration deployment to Netlify
- Validation system ensures compatibility

**Why This Architecture:**
- ✅ Single dev server command (`netlify dev`)
- ✅ Functions and frontend work seamlessly together
- ✅ Same code runs in development and production
- ✅ No environment variables needed for API calls
- ✅ Built-in deployment to Netlify

---

## Required Directory Structure

All BeeSwarm templates MUST follow this structure:

```
project-root/
├── frontend/                    # Vite + React application (REQUIRED)
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json            # (REQUIRED)
│   ├── vite.config.ts          # (REQUIRED)
│   └── tsconfig.json
│
├── netlify/
│   └── functions/               # Serverless functions (Optional)
│       ├── hello.ts
│       └── users.ts
│
├── .claude/                     # Claude Code instructions (REQUIRED)
│   └── CLAUDE.md               # System prompt for Claude Code
│
├── config/
│   └── project-images.json      # Image metadata for BeeSwarm (Optional)
│
├── netlify.toml                 # Netlify configuration (REQUIRED)
├── package.json                 # Root package.json (REQUIRED)
└── README.md
```

**CRITICAL FILES:**
- ✅ `package.json` (root) - Must include `netlify-cli`
- ✅ `netlify.toml` - Configuration for Netlify Dev
- ✅ `frontend/` directory with Vite setup
- ✅ `frontend/package.json` - React + Vite dependencies
- ✅ `frontend/vite.config.ts` - Port configuration
- ✅ `.claude/CLAUDE.md` - Claude Code instructions

**Template Validation:**
BeeSwarm automatically validates template structure after cloning. Missing required files will cause project creation to fail.

---

## Claude Code Integration (.claude/CLAUDE.md)

### Why This File is Required

When users make edits to their projects in BeeSwarm, they use Claude Code's AI capabilities. The `.claude/CLAUDE.md` file is a **system prompt** that Claude Code automatically reads when starting a session. This file guides Claude Code to:

1. **Preserve BeeSwarm's architecture** (Netlify Functions, not traditional servers)
2. **Avoid breaking changes** (never modify port configs, never start dev servers)
3. **Use correct patterns** (relative paths for API calls, proper function structure)
4. **Communicate appropriately** (non-technical language for average users)

**Without this file:**
- ❌ Claude Code might create Express backends (won't work)
- ❌ Claude Code might run `npm run dev` (conflicts with BeeSwarm)
- ❌ Claude Code might modify port configs (breaks BeeSwarm's auto-allocation)
- ❌ Claude Code might use technical jargon (confuses non-technical users)

**With this file:**
- ✅ Claude Code creates proper Netlify Functions
- ✅ Claude Code only edits code (BeeSwarm manages servers)
- ✅ Claude Code preserves BeeSwarm's configuration
- ✅ Claude Code explains changes in simple terms

### What Goes in CLAUDE.md

The file should include:

**1. CRITICAL RULES** (Strong emphasis on breaking changes):
```markdown
### Dev Server Management
- **NEVER** run `npm run dev`, `npm start`, or `netlify dev`
- **WHY:** BeeSwarm manages dev servers automatically
```

**2. USER CONTEXT** (Non-technical audience):
```markdown
## User Context
The user is **not a developer**. They're using BeeSwarm to build apps without coding knowledge.
- Use simple, non-technical language
- Avoid jargon
```

**3. BACKEND PATTERN** (Netlify Functions only):
```markdown
## Backend Pattern
**ALWAYS use Netlify Functions** for backend logic.
**NEVER create Express servers** or traditional backends.
```

**4. API CALL PATTERN** (Relative paths):
```markdown
## Frontend API Calls
**ALWAYS use relative paths:**
fetch('/.netlify/functions/endpoint')  // ✅ Works everywhere
```

**5. TESTING APPROACH** (What Claude can run):
```markdown
## Testing
✅ CAN run: npm run build, npm test
❌ CANNOT run: npm run dev (BeeSwarm manages this)
```

**6. COMMON PATTERNS** (Examples for typical scenarios):
- Authentication with Supabase
- Database operations with MongoDB
- Payment processing with Stripe
- Environment variable handling

### Template File Location

**See:** `TEMPLATE_CLAUDE.md` (in project root)

This file contains the complete CLAUDE.md content. Copy it to `.claude/CLAUDE.md` in your templates:

```bash
# When creating a template:
mkdir -p .claude
cp TEMPLATE_CLAUDE.md .claude/CLAUDE.md
```

### How Claude Code Reads This File

**Automatic Loading:**
- Claude Code reads `.claude/CLAUDE.md` automatically when session starts
- No manual action needed from the user
- All instructions are in effect immediately

**File Discovery:**
- Looks for `.claude/CLAUDE.md` in project root
- Can also find `./CLAUDE.md` (both locations work)
- Loads at the start of every Claude Code session

**User Can Check:**
Users can verify Claude Code loaded the instructions with `/memory` command in Claude Code CLI.

### Customizing for Your Template

You can customize CLAUDE.md per template:

**Add Template-Specific Commands:**
```markdown
## This Template Uses

- Supabase for auth (use `@supabase/supabase-js`)
- Stripe for payments (functions in netlify/functions/stripe/)
- MongoDB for database (connection string in .env)
```

**Add Component Patterns:**
```markdown
## Component Structure

- All pages in src/pages/
- Reusable UI in src/components/ui/
- API client code in src/api/
```

**Add Common User Requests:**
```markdown
## Common Requests for This Template

### "Add a new product"
1. Update products in src/data/products.ts
2. Component will auto-update

### "Change pricing"
1. Edit netlify/functions/stripe/checkout.ts
2. Update amount (in cents)
```

**Add Library-Specific Patterns:**
```markdown
## Stripe Pattern for This Template

All Stripe functions are in netlify/functions/stripe/
- checkout.ts - Create checkout session
- webhook.ts - Handle payment webhooks
- Uses Stripe Secret Key from .env
```

### Example CLAUDE.md Structure

```markdown
# Template Name - Claude Code Instructions

## CRITICAL RULES - DO NOT BREAK THESE
[Breaking rules with strong emphasis]

## User Context
[Non-technical user info]

## Project Structure
[Directory layout]

## Backend Pattern - Netlify Functions
[Function examples and patterns]

## Frontend API Calls
[Relative path pattern]

## Common Patterns
[Template-specific examples]

## Testing & Verification
[What to run, what not to run]

## Summary
[Quick reference for Claude Code]
```

### Testing Your CLAUDE.md

**Before Adding to Template:**

1. **Test with Claude Code CLI:**
   - Add CLAUDE.md to a test project
   - Run Claude Code
   - Use `/memory` to verify it loaded
   - Ask Claude to add a feature and verify it follows rules

2. **Verify Critical Rules:**
   - Ask Claude "start the dev server" → Should refuse
   - Ask Claude "add a backend API" → Should create Netlify Function
   - Ask Claude "test the app" → Should run build, not dev

3. **Check User Communication:**
   - Ask Claude "what did you change?" → Should use simple language
   - Verify no technical jargon in explanations

### Common Issues & Solutions

**Issue:** Claude Code creates Express backend
**Solution:** Add stronger emphasis in CRITICAL RULES section:
```markdown
### Backend Architecture
- **NEVER** create Express, Fastify, or traditional servers
- **ALWAYS** use Netlify Functions ONLY
```

**Issue:** Claude Code runs `npm run dev`
**Solution:** Add to CRITICAL RULES:
```markdown
### Dev Server Management
- **NEVER** run any dev server commands
- **WHY:** BeeSwarm manages this automatically
```

**Issue:** Claude Code uses technical jargon
**Solution:** Emphasize in User Context:
```markdown
## User Context
User is **not a developer**. Use simple language.
- Say "form that saves data" not "POST endpoint"
- Say "login button" not "auth flow"
```

**Issue:** Claude Code modifies port configs
**Solution:** Add to CRITICAL RULES:
```markdown
### Configuration Files
- **NEVER** modify netlify.toml ports
- **NEVER** modify vite.config.ts ports
```

### Why This Matters for BeeSwarm

BeeSwarm's unique architecture requires:

1. **Single Dev Server:** Netlify Dev (not Vite + Backend separately)
2. **Auto Port Allocation:** Each project gets unique ports
3. **Serverless Backend:** Netlify Functions only
4. **Non-Technical Users:** Simple language required

The CLAUDE.md file is the **only way** to ensure Claude Code works correctly within BeeSwarm's constraints. Without it, Claude Code's default behavior will break BeeSwarm projects.

---

## Configuration Files

### 1. Root package.json (REQUIRED)

```json
{
  "name": "beeswarm-template",
  "version": "1.0.0",
  "scripts": {
    "dev": "netlify dev",
    "build": "cd frontend && npm run build",
    "deploy": "netlify deploy --prod"
  },
  "dependencies": {
    "@netlify/functions": "^2.8.2"
  },
  "devDependencies": {
    "netlify-cli": "^17.37.3"
  }
}
```

**CRITICAL:**
- `netlify-cli` MUST be in `devDependencies`
- BeeSwarm installs root dependencies FIRST (before frontend)
- Missing `netlify-cli` will cause dev server to fail

---

### 2. netlify.toml (REQUIRED)

```toml
[build]
  # Build command for deployment
  command = "cd frontend && npm install && npm run build"
  # Output directory (relative to project root)
  publish = "frontend/dist"
  # Functions directory
  functions = "netlify/functions"

[dev]
  # Local dev server port (BeeSwarm allocates 8888-8999 automatically)
  port = 8888
  # Frontend framework detection
  framework = "#custom"
  # IMPORTANT: Use npm --prefix to keep process running
  command = "npm --prefix frontend run dev"
  # Where frontend dev server runs (auto-updated by BeeSwarm)
  targetPort = 5174
  # Auto-open browser (BeeSwarm handles preview)
  autoLaunch = false

# Redirect all routes to index.html for SPA routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Port Configuration:**
- `port` - Netlify Dev server port (default 8888)
- `targetPort` - Vite dev server port (default 5174)
- **BeeSwarm automatically updates both** after cloning
- Use defaults in templates - BeeSwarm handles conflicts

**Command Format:**
- ✅ Use: `npm --prefix frontend run dev`
- ❌ Don't use: `cd frontend && npm run dev`
- The `--prefix` approach keeps the process running correctly

---

### 3. frontend/vite.config.ts (REQUIRED)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false
  }
})
```

**Port Configuration:**
- Use `5174` as base port
- Set `strictPort: false` to allow fallback
- **BeeSwarm automatically updates** after cloning

**Alternative formats supported:**
```typescript
// Environment variable (BeeSwarm updates this too)
port: parseInt(process.env.VITE_PORT || '5174')
```

---

### 4. frontend/package.json (REQUIRED)

```json
{
  "name": "template-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^6.0.0",
    "typescript": "^5.7.2"
  }
}
```

---

## Port Management System

BeeSwarm automatically allocates unique port pairs for each project to prevent conflicts.

### How It Works

**1. Port Allocation:**
- Netlify Dev: 8888-8999 (primary proxy server)
- Vite Dev: 5174-5285 (frontend dev server)
- Paired mapping: Netlify 8888 → Vite 5174, Netlify 8889 → Vite 5175, etc.

**2. Automatic Configuration:**
When you create a project:
1. BeeSwarm allocates available port pair (e.g., Netlify 8888, Vite 5174)
2. Clones template from GitHub
3. **Automatically updates** `frontend/vite.config.ts` with allocated Vite port
4. **Automatically updates** `netlify.toml` with same Vite port
5. Installs dependencies
6. Starts dev server on allocated ports

**3. Conflict Handling:**
- Port validation before starting
- Auto-retry with next port (max 3 attempts)
- Orphaned process cleanup on app restart
- Supports up to 112 simultaneous projects

**4. What This Means for Templates:**
- ✅ Use default ports (8888 Netlify, 5174 Vite)
- ✅ BeeSwarm handles all port conflicts automatically
- ✅ No manual configuration needed
- ✅ Multiple projects run simultaneously without issues

---

## Netlify Functions (Serverless Backend)

### Directory Structure

Functions live in `netlify/functions/` and are auto-discovered by Netlify CLI.

```
netlify/
└── functions/
    ├── hello.ts
    ├── get-user.ts
    └── create-post.ts
```

### Example Function (TypeScript)

**File:** `netlify/functions/hello.ts`

```typescript
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
) => {
  // Parse request body if POST/PUT
  const body = event.body ? JSON.parse(event.body) : null

  // Get query parameters
  const name = body?.name || event.queryStringParameters?.name || 'World'

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString()
    })
  }
}
```

### Calling Functions from Frontend

**The Key: Relative Paths**

Use `/.netlify/functions/` prefix - works in both dev and production.

```typescript
// src/api/client.ts

const API_BASE = '/.netlify/functions'

export async function sayHello(name: string) {
  const response = await fetch(`${API_BASE}/hello?name=${name}`)

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  return response.json()
}

// Usage in component:
// const data = await sayHello('Bruno')
```

### How It Works

**Local Development (`netlify dev`):**
- Netlify CLI at `localhost:8888`
- Frontend at `localhost:5174` (proxied through 8888)
- Functions at `localhost:8888/.netlify/functions/hello`
- Request to `/.netlify/functions/hello` → proxied to function

**Production (deployed):**
- Site at `https://yoursite.netlify.app`
- Functions at `https://yoursite.netlify.app/.netlify/functions/hello`
- Same relative path works!

**Zero configuration needed:**
- ✅ No `VITE_API_URL` environment variable
- ✅ No conditional logic (`if (dev) ... else ...`)
- ✅ Same code runs in dev and prod

### Function Dependencies

Add function dependencies to root `package.json`:

```json
{
  "dependencies": {
    "@netlify/functions": "^2.8.2",
    "@supabase/supabase-js": "^2.39.0",
    "stripe": "^14.0.0"
  }
}
```

---

## Environment Variables

### Frontend Environment Variables

**File:** `frontend/.env` (created by BeeSwarm wizard)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

**Access in frontend:**
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
```

**Rules:**
- Must prefix with `VITE_` (required by Vite)
- Exposed to client-side code (don't use for secrets)
- BeeSwarm wizard collects during project setup

### Function Environment Variables

**Locally:** Create `.env` in root:

```env
STRIPE_SECRET_KEY=sk_test_xxx
SUPABASE_SERVICE_KEY=eyJxxx...
MONGODB_URI=mongodb+srv://...
```

**Access in functions:**
```typescript
const stripeKey = process.env.STRIPE_SECRET_KEY
```

**Production:** Set via Netlify dashboard or CLI:
```bash
netlify env:set STRIPE_SECRET_KEY sk_live_xxx
```

**BeeSwarm Wizard:**
- Prompts user for required keys during setup
- Writes to `frontend/.env` (for `VITE_` vars)
- Writes to root `.env` (for function vars)
- Deployment env vars (future feature)

---

## Template Validation

BeeSwarm automatically validates template structure after cloning. Validation is **CRITICAL** - missing required files will cause project creation to fail.

### Validation Checks

**Required Files/Directories:**
- ✅ `package.json` (root) with `netlify-cli` in devDependencies
- ✅ `netlify.toml` with [build] and [dev] sections
- ✅ `frontend/` directory exists
- ✅ `frontend/package.json` with React and Vite

**Optional But Recommended:**
- ⚠️ `frontend/vite.config.ts` with port 5174
- ⚠️ `netlify/functions/` directory

**Validation Result:**
- ✅ All required files present → Project creation continues
- ❌ Missing required files → Project creation fails with error message

### Common Validation Errors

```
❌ Missing required file: package.json
❌ Missing required file: netlify.toml
❌ Missing required directory: frontend/
❌ Missing netlify-cli in devDependencies
❌ Missing frontend/package.json
```

**To Avoid Validation Failures:**
1. Follow this structure exactly
2. Include ALL required files
3. Add `netlify-cli` to root package.json devDependencies
4. Use port 5174 in frontend/vite.config.ts
5. Test locally before pushing template

---

## How BeeSwarm Uses Your Template

### 1. Project Creation Flow

```
1. User selects template in BeeSwarm
2. User enters project name
3. BeeSwarm clones template from GitHub
4. Validates template structure (must pass)
5. Allocates unique port pair (e.g., Netlify 8888, Vite 5174)
6. Updates frontend/vite.config.ts with allocated Vite port
7. Updates netlify.toml with allocated Vite port
8. Runs npm install in ROOT (installs netlify-cli)
9. Runs npm install in frontend/ (installs React, Vite)
10. Configuration wizard (if template requires env vars)
11. Project ready for development
```

### 2. Starting Dev Server

```
1. Clean up orphaned processes from previous sessions
2. Allocate available port (8888-8999)
3. Run: npx netlify dev --port {allocated_port}
4. Netlify CLI detects frontend/ and starts Vite automatically
5. Functions server starts alongside
6. HTTP health check ensures server is ready
7. If port conflict: auto-retry with new port (max 3 attempts)
8. Preview window shows: localhost:{port}
```

### 3. Preview Window

```
1. BeeSwarm opens BrowserView (embedded Chromium)
2. Points to localhost:{allocated_port}
3. Waits for HTTP 200 response
4. User sees frontend running
5. API calls to functions work seamlessly
6. DevTools available (F12)
```

### 4. Multiple Projects

```
1. Run up to 112 projects simultaneously
2. Each gets unique port automatically
3. No manual configuration needed
4. Processes tracked with PID for cleanup
5. Switch between projects instantly
```

---

## Common Patterns

### Authenticated API Calls

**Frontend:**
```typescript
// src/api/auth.ts
import { supabase } from './supabase'

export async function callAuthenticatedFunction(endpoint: string, data: any) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: JSON.stringify(data)
  })

  return response.json()
}
```

**Function:**
```typescript
// netlify/functions/protected.ts
import { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (event) => {
  const authHeader = event.headers.authorization

  if (!authHeader) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { statusCode: 401, body: 'Invalid token' }
  }

  // User is authenticated
  return {
    statusCode: 200,
    body: JSON.stringify({ userId: user.id })
  }
}
```

### Database Operations

```typescript
// netlify/functions/get-users.ts
import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URI!)

export const handler: Handler = async (event) => {
  try {
    await client.connect()
    const db = client.db('myapp')
    const users = await db.collection('users').find({}).limit(10).toArray()

    return {
      statusCode: 200,
      body: JSON.stringify(users)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  } finally {
    await client.close()
  }
}
```

### CORS Handling

Always include CORS headers in function responses:

```typescript
return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  },
  body: JSON.stringify(data)
}
```

---

## Best Practices

### 1. Always Use Relative Paths
```typescript
// ✅ Good
fetch('/.netlify/functions/hello')

// ❌ Bad
fetch('http://localhost:8888/.netlify/functions/hello')
fetch(`${process.env.VITE_API_URL}/hello`)
```

### 2. Prefix Frontend Env Vars
```env
# ✅ Good
VITE_SUPABASE_URL=xxx
VITE_STRIPE_KEY=xxx

# ❌ Bad (won't be exposed)
SUPABASE_URL=xxx
STRIPE_KEY=xxx
```

### 3. Keep Functions Small
```typescript
// ✅ Good - one responsibility
export const handler: Handler = async (event) => {
  // Just handle user creation
}

// ❌ Bad - too many responsibilities
export const handler: Handler = async (event) => {
  // Handles users, posts, comments, auth, etc.
}
```

### 4. Validate Input
```typescript
export const handler: Handler = async (event) => {
  const body = event.body ? JSON.parse(event.body) : null

  // ✅ Validate
  if (!body?.email || !body?.name) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    }
  }

  // Process...
}
```

### 5. Use TypeScript
```typescript
// ✅ Good - type safety
interface CreateUserBody {
  email: string
  name: string
}

export const handler: Handler = async (event) => {
  const body: CreateUserBody = JSON.parse(event.body!)
  // TypeScript will catch errors
}
```

### 6. Handle Errors Properly
```typescript
export const handler: Handler = async (event) => {
  try {
    // Your logic
    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (error) {
    console.error('Function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error'
      })
    }
  }
}
```

### 7. Never Hardcode Secrets
```typescript
// ✅ Good
const apiKey = process.env.STRIPE_SECRET_KEY

// ❌ Bad
const apiKey = 'sk_live_xxx...'
```

### 8. Add .env to .gitignore
```gitignore
# Environment files
.env
.env.local
frontend/.env
frontend/.env.local
```

### 9. Document Required Env Vars
Include in your template's README:

```markdown
## Environment Variables

This template requires:

**Frontend (.env in frontend/):**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anon key

**Functions (.env in root):**
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `STRIPE_SECRET_KEY` - Stripe secret key
```

### 10. Only One vite.config File
```
✅ Use: frontend/vite.config.ts
❌ Don't create: frontend/vite.config.js

Having both causes port conflicts!
```

---

## Testing Your Template

### Local Testing Checklist

**1. Install dependencies:**
```bash
# From project root
npm install
cd frontend && npm install && cd ..
```

**2. Run dev server:**
```bash
npm run dev
```

**3. Verify:**
- ✅ Frontend loads at `http://localhost:8888`
- ✅ Can call functions: `http://localhost:8888/.netlify/functions/hello`
- ✅ No CORS errors in console
- ✅ Hot reload works when editing files

**4. Build test:**
```bash
npm run build
```
- ✅ Check `frontend/dist/` directory exists
- ✅ No build errors
- ✅ TypeScript compiles successfully

**5. Deploy test (optional):**
```bash
netlify deploy --prod
```

### BeeSwarm Testing

**1. Add Template to MongoDB:**
```json
{
  "_id": ObjectId("..."),
  "id": "my-template",
  "name": "My Template",
  "description": "Description here",
  "category": "fullstack",
  "githubUrl": "https://github.com/username/template",
  "isPremium": false,
  "requiredServices": ["supabase", "stripe"],
  "thumbnail": "https://..."
}
```

**2. Test in BeeSwarm:**
1. Open BeeSwarm → Template selector
2. Select your template
3. Enter project name
4. Watch for validation errors
5. Complete configuration wizard
6. Verify dev server starts
7. Check preview shows frontend
8. Test API calls work
9. Try deployment (when implemented)

**3. Test Multiple Projects:**
1. Create second project with same template
2. Both should start successfully
3. Each on different ports
4. Switch between projects

---

## Troubleshooting

### Template Validation Fails

**Error:** "Template structure validation failed"

**Causes & Fixes:**
- Missing `package.json` → Create root package.json with netlify-cli
- Missing `netlify.toml` → Add netlify configuration file
- Missing `frontend/` → Create frontend directory with Vite setup
- Missing netlify-cli → Add to devDependencies in root package.json
- Check BeeSwarm console for specific missing files

### Dev Server Fails to Start

**Error:** "Failed to start dev server" or port errors

**Fixes:**
1. Verify netlify-cli in root package.json devDependencies
2. BeeSwarm retries 3 times automatically with different ports
3. Check if ports 8888-8999 are available
4. Restart BeeSwarm (auto-cleans orphaned processes)
5. Manually kill processes: `lsof -ti:8888 | xargs kill`

### Functions Not Working Locally

**Causes & Fixes:**
- Check netlify.toml has correct `functions = "netlify/functions"`
- Verify function exports `handler`
- Check function dependencies installed in ROOT package.json
- Look for errors in Netlify Dev output
- Test function URL directly: `curl http://localhost:8888/.netlify/functions/hello`

### CORS Errors

**Fix:** Add CORS headers to ALL function responses:
```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
}
```

Also handle OPTIONS preflight:
```typescript
if (event.httpMethod === 'OPTIONS') {
  return {
    statusCode: 200,
    headers: { /* CORS headers */ }
  }
}
```

### Environment Variables Not Loading

**Fixes:**
- Ensure `.env` in root for functions
- Ensure `frontend/.env` for Vite vars with `VITE_` prefix
- Restart netlify dev after changing .env
- Check .env is not in .gitignore during local testing
- Verify syntax: `KEY=value` (no quotes, no spaces around =)

### Build Fails

**Causes & Fixes:**
- Check build command in netlify.toml is correct
- Verify `frontend/dist/` is created locally when building
- Look for TypeScript errors: `cd frontend && npm run build`
- Check all imports are correct
- Ensure all dependencies are in package.json

### Port Conflicts

**Error:** "Port already in use"

**Fixes:**
1. Restart BeeSwarm (auto-cleans orphaned processes)
2. BeeSwarm auto-retries with next available port
3. Manually kill: `lsof -ti:8888-8999 | xargs kill`
4. Check for stuck processes: `lsof -i:8888`

### Multiple Projects Won't Start

**Causes & Fixes:**
- Port exhaustion (limit: 112 projects) - Stop unused projects
- Orphaned processes - Restart BeeSwarm
- Check available ports: `lsof -i:8888-8999`

---

## Example Templates

### Minimal Template (Hello World)

```
hello-world/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── netlify/
│   └── functions/
│       └── hello.ts
├── netlify.toml
└── package.json
```

### Full SaaS Template

```
saas-starter/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Hero.tsx
│   │   │   ├── Pricing.tsx
│   │   │   └── Dashboard.tsx
│   │   ├── pages/
│   │   ├── api/              # API client code
│   │   └── lib/              # Supabase, utils
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── netlify/
│   └── functions/
│       ├── auth/
│       │   ├── signup.ts
│       │   └── login.ts
│       ├── stripe/
│       │   ├── checkout.ts
│       │   └── webhook.ts
│       └── users/
│           └── profile.ts
├── .claude/
│   └── instructions.md
├── config/
│   └── project-images.json
├── netlify.toml
└── package.json
```

---

## Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Netlify CLI Docs](https://docs.netlify.com/cli/get-started/)
- [Vite Environment Variables](https://vite.dev/guide/env-and-mode.html)
- [TypeScript Netlify Functions](https://github.com/netlify/functions/tree/main/templates/typescript)
- [BeeSwarm Unified Terminal](./UNIFIED_TERMINAL.md)

---

**Last Updated:** 2024-11-01
**Version:** 2.0
**Status:** Production Ready ✅
