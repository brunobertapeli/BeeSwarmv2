# BeeSwarm Template Structure Guide

## Overview
This guide explains how to structure templates for BeeSwarm v2 to ensure seamless local development and production deployment.

**CRITICAL**: BeeSwarm now includes automatic template validation. Templates MUST follow this structure exactly or project creation will fail.

**Production Improvements**:
- ✅ Root dependencies are now installed first (netlify-cli required)
- ✅ **Automatic port allocation** - each project gets unique Netlify + Vite port pair
- ✅ **Auto-configuration** - vite.config.ts and netlify.toml updated with allocated ports
- ✅ Port conflict auto-recovery (supports multiple simultaneous projects)
- ✅ Orphaned process cleanup on app restart
- ✅ HTTP health checks for reliable server detection
- ✅ Template structure validation after cloning

---

## Required Directory Structure

All BeeSwarm templates must follow this structure:

```
project-root/
├── frontend/                    # Vite + React application
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── netlify/
│   └── functions/               # Serverless functions
│       ├── hello.ts             # Example function
│       └── users.ts
│
├── .claude/                     # Claude Code instructions (optional)
│   └── instructions.md
│
├── config/
│   └── project-images.json      # Image metadata for BeeSwarm
│
├── netlify.toml                 # Netlify configuration
├── package.json                 # Root package.json for netlify dev
└── README.md
```

---

## Frontend Configuration

### package.json
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

### vite.config.ts
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

---

## Netlify Functions

### Directory Structure
Functions live in `netlify/functions/` and are auto-discovered by Netlify CLI.

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

  // Example logic
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

### Function Dependencies
Add to root `package.json`:

```json
{
  "dependencies": {
    "@netlify/functions": "^2.8.2"
  }
}
```

---

## Calling Functions from Frontend

### The Key: Relative Paths
Use relative paths starting with `/.netlify/functions/` - works in both dev and production.

### Example Frontend Code
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

**Local Development (netlify dev):**
- Netlify CLI runs at `localhost:8888`
- Frontend at `localhost:5174` (proxied)
- Functions at `localhost:8888/.netlify/functions/hello`
- Request to `/.netlify/functions/hello` → proxied to function

**Production (deployed):**
- Site at `https://yoursite.netlify.app`
- Functions at `https://yoursite.netlify.app/.netlify/functions/hello`
- Same relative path works!

**Zero configuration needed** - no environment variables, no conditional logic.

---

## Root Configuration

### package.json (Root) - **REQUIRED**
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
    "netlify-cli": "^17.37.3"  // CRITICAL: Required for dev server
  }
}
```

**CRITICAL**:
- Root package.json is **REQUIRED**
- `netlify-cli` must be in devDependencies
- BeeSwarm installs root dependencies FIRST (before frontend/backend)
- Missing `netlify-cli` will cause dev server to fail

### netlify.toml - **REQUIRED**
```toml
[build]
  # Build command for deployment
  command = "cd frontend && npm install && npm run build"
  # Output directory (relative to project root)
  publish = "frontend/dist"
  # Functions directory
  functions = "netlify/functions"

[dev]
  # Local dev server port (BeeSwarm allocates ports 8888-8999 automatically)
  # Port conflicts are handled with auto-retry
  port = 8888
  # Frontend framework detection
  framework = "#custom"
  # IMPORTANT: Use npm --prefix instead of cd to keep process running
  command = "npm --prefix frontend run dev"
  # Where frontend dev server runs (5174 to avoid conflict with BeeSwarm's port 5173)
  targetPort = 5174
  # Auto-open browser (BeeSwarm handles this)
  autoLaunch = false

# Redirect all unknown routes to index.html for SPA routing
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Port Management**:
- BeeSwarm automatically allocates unique port pairs for each project:
  - Netlify Dev: 8888-8999 (primary proxy server)
  - Vite Dev: 5174-5285 (frontend dev server)
  - Port mapping: Netlify 8888 → Vite 5174, Netlify 8889 → Vite 5175, etc.
- Supports up to 112 simultaneous projects
- Automatic port conflict detection and retry (3 attempts)
- **IMPORTANT**: BeeSwarm automatically updates `vite.config.ts` and `netlify.toml` with allocated ports after cloning
- Templates should use port 5174 as the default base port (will be updated dynamically)

**Important Notes:**
- Use `npm --prefix frontend run dev` instead of `cd frontend && npm run dev`
- The `--prefix` approach keeps the process running correctly within netlify dev
- Only use `vite.config.ts` - **DO NOT** include `vite.config.js` (will cause port conflicts)

---

## BeeSwarm Integration

### How BeeSwarm Runs Your Template

1. **Project Creation:**
   - Clone template from GitHub
   - **Validate template structure** (CRITICAL: validates all required files)
   - **Allocate unique port pair** (Netlify + Vite ports)
   - **Automatically update** `frontend/vite.config.ts` with allocated Vite port
   - **Automatically update** `netlify.toml` with allocated Vite port
   - Run `npm install` in **root FIRST** (installs netlify-cli)
   - Run `npm install` in frontend/ (installs React, Vite)
   - Run `npm install` in backend/ (if exists)

2. **Starting Dev Server:**
   - Clean up orphaned processes from previous sessions
   - Allocate available port (8888-8999)
   - BeeSwarm runs: `npx netlify dev --port {allocated_port}`
   - Netlify CLI detects `frontend/` and starts Vite automatically
   - Functions server starts alongside
   - **HTTP health check** ensures server is actually ready
   - If port conflict: auto-retry with new port (max 3 attempts)

3. **Preview Window:**
   - BeeSwarm opens iframe pointing to `localhost:{port}`
   - Waits for HTTP 200 response before showing preview
   - User sees frontend running
   - API calls to functions work seamlessly

4. **Multiple Projects:**
   - Run up to 112 projects simultaneously
   - Each gets unique port automatically
   - No manual port configuration needed
   - Processes tracked with PID file for cleanup

5. **Crash Recovery:**
   - On app restart: kills orphaned processes
   - Releases stale ports
   - Ensures clean slate every time

6. **Deployment:**
   - BeeSwarm runs: `netlify deploy --prod`
   - Netlify builds frontend (`npm run build`)
   - Uploads `frontend/dist` to CDN
   - Deploys functions
   - Site live at `https://yoursite.netlify.app`

### No Environment Variables Needed
Because functions use relative paths:
- ✅ No `VITE_API_URL` needed
- ✅ No conditional logic (`if (dev) ... else ...`)
- ✅ Same code runs in dev and prod
- ✅ Zero configuration for users

---

## Environment Variables (Optional)

If your template needs API keys (Supabase, Stripe, etc.):

### Frontend Environment Variables
**File:** `frontend/.env` (created by BeeSwarm wizard)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Access in frontend:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
```

### Function Environment Variables
**Locally:** Create `.env` in root:
```env
STRIPE_SECRET_KEY=sk_test_xxx
SUPABASE_SERVICE_KEY=eyJxxx...
```

**Production:** Set via Netlify dashboard or CLI:
```bash
netlify env:set STRIPE_SECRET_KEY sk_live_xxx
```

Access in functions:
```typescript
const stripeKey = process.env.STRIPE_SECRET_KEY
```

**BeeSwarm Wizard:**
- Prompts user for required keys during setup
- Writes to `frontend/.env` (for VITE_ vars)
- Writes to root `.env` (for function vars)
- Updates Netlify env on deployment (future feature)

---

## Template Manifest

### config/project-images.json
Metadata for BeeSwarm's image manager (future feature):

```json
{
  "images": [
    {
      "id": "hero-bg",
      "path": "frontend/public/images/hero-bg.jpg",
      "dimensions": { "width": 1920, "height": 1080 },
      "description": "Hero section background"
    },
    {
      "id": "logo",
      "path": "frontend/public/images/logo.svg",
      "dimensions": { "width": 200, "height": 60 },
      "description": "Site logo"
    }
  ]
}
```

---

## Testing Your Template

### Local Testing Checklist

1. **Install dependencies:**
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

2. **Run dev server:**
   ```bash
   npm run dev
   ```

3. **Verify:**
   - Frontend loads at `http://localhost:8888`
   - Can call functions: `http://localhost:8888/.netlify/functions/hello`
   - No CORS errors
   - Hot reload works

4. **Build test:**
   ```bash
   npm run build
   ```
   - Check `frontend/dist/` exists
   - No build errors

5. **Deploy test:**
   ```bash
   netlify deploy --prod
   ```

### BeeSwarm Testing

1. Add template to MongoDB `templates` collection
2. Open BeeSwarm → Select template
3. Enter project name
4. BeeSwarm clones and installs deps
5. Verify preview shows frontend
6. Test API calls work
7. Deploy from BeeSwarm

---

## Common Patterns

### Authenticated API Calls
```typescript
// frontend/src/api/auth.ts
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

  // User is authenticated, proceed...
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

---

## Best Practices

1. **Always use relative paths** for function calls (/.netlify/functions/...)
2. **Prefix frontend env vars** with `VITE_` (required by Vite)
3. **Keep functions small** - one responsibility per function
4. **Handle CORS** - add headers in function responses
5. **Validate input** - always validate/sanitize user input
6. **Error handling** - return proper status codes (400, 500, etc.)
7. **Type safety** - use TypeScript for functions
8. **Environment vars** - never hardcode secrets
9. **Git ignore** - add `.env` to `.gitignore`
10. **README** - document required env vars in template README

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
│   └── package.json
├── netlify/functions/
│   └── hello.ts
├── netlify.toml
└── package.json
```

### Full SaaS Template
```
saas-starter/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/           # API client code
│   │   └── lib/           # Supabase, utils
├── netlify/functions/
│   ├── auth/
│   │   ├── signup.ts
│   │   └── login.ts
│   ├── stripe/
│   │   ├── checkout.ts
│   │   └── webhook.ts
│   └── users/
│       └── profile.ts
├── .claude/
│   └── instructions.md
├── config/
│   └── project-images.json
├── netlify.toml
└── package.json
```

---

## Template Validation

BeeSwarm automatically validates template structure after cloning. Validation checks:

**Required Files/Directories:**
- ✅ `package.json` (root) - with netlify-cli
- ✅ `netlify.toml` - configuration
- ✅ `frontend/` - directory exists
- ✅ `frontend/package.json` - with React, Vite

**Optional But Recommended:**
- ⚠️ `frontend/vite.config.ts` - port 5174 configuration
- ⚠️ `netlify/functions/` - serverless functions

**Validation Failures:**
- Missing required files → Project creation fails
- Missing optional files → Warning logged, project continues

**Common Validation Errors:**
```
Missing required file: package.json
Missing required file: netlify.toml
Missing required directory: frontend
Missing netlify-cli in dependencies
```

To avoid validation failures:
1. Follow this structure exactly
2. Include all required files
3. Add `netlify-cli` to root package.json
4. Use port 5174 in frontend/vite.config.ts

---

## Troubleshooting

### Project Creation Fails with "Template validation failed"
**Cause**: Missing required files or incorrect structure

**Fix**:
1. Ensure root `package.json` exists
2. Ensure `netlify.toml` exists
3. Ensure `frontend/` directory exists
4. Add `netlify-cli` to devDependencies
5. Check console for specific missing files

### Dev Server Fails to Start
**Cause**: Missing netlify-cli or port conflict

**Fix**:
1. Verify netlify-cli in root package.json
2. BeeSwarm retries 3 times automatically
3. Check if ports 8888-8999 are available
4. Restart BeeSwarm to clean orphaned processes

### "Port already in use" Errors
**Cause**: Orphaned processes from crash

**Fix**:
1. Restart BeeSwarm (auto-cleans orphaned processes)
2. Manually kill processes on ports 8888-8999
3. BeeSwarm auto-retries with next available port

### Functions not working locally
- Check netlify.toml has correct `functions` path
- Verify function exports `handler`
- Check function dependencies installed in root package.json

### CORS errors
- Add CORS headers to function responses:
  ```typescript
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
  ```

### Environment variables not loading
- Ensure `.env` in root for functions
- Ensure `frontend/.env` for Vite vars
- Restart netlify dev after changing .env

### Build fails
- Check build command in netlify.toml
- Verify `frontend/dist` created
- Check for TypeScript errors

### Multiple Projects Won't Start
**Cause**: Port exhaustion or orphaned processes

**Fix**:
1. BeeSwarm supports up to 112 simultaneous projects
2. Restart BeeSwarm to clean up orphaned processes
3. Stop unused projects to free ports

---

## Resources

- [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)
- [Netlify CLI Docs](https://docs.netlify.com/cli/get-started/)
- [Vite Environment Variables](https://vite.dev/guide/env-and-mode.html)
- [TypeScript Netlify Functions](https://github.com/netlify/functions/tree/main/templates/typescript)
