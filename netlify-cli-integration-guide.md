# Netlify CLI - Electron Integration

## Core Approach
Bundle Netlify CLI as npm dependency. Use Electron's embedded Node.js to execute the CLI programmatically.

## Installation
`npm install netlify-cli --save`

No binary downloads needed. The package is ~80 MB when installed.

## Runtime Path Resolution
```
const cliPath = require.resolve('netlify-cli/bin/run');
const nodePath = process.execPath; // Electron's Node.js
```

Execute via: `spawn(nodePath, [cliPath, ...args])`

## Authentication
User creates Personal Access Token at `https://app.netlify.com/user/applications`

Set via environment variable:
- `NETLIFY_AUTH_TOKEN` for CLI execution
- Store token encrypted in electron-store

## Key Commands
- `sites:create --name <n> --manual` - Create new site
- `deploy --prod --dir <dir>` - Deploy to production
- `deploy --prod --dir <dir> --site <id>` - Deploy to specific site
- `deploy --prod --dir <dir> --functions <funcs>` - Deploy with serverless functions
- `status` - Get site info and URL
- `logs` - View deployment logs

## Site Linking
Netlify CLI uses `.netlify/state.json` in project directory:
```json
{ "siteId": "abc123" }
```

Create this file manually to link existing sites instead of using CLI link command.

## Execution Pattern
Spawn CLI with Node's `child_process.spawn()`:
- Use Electron's Node.js (`process.execPath`)
- Set `NETLIFY_AUTH_TOKEN` in env
- Set `NODE_ENV=production`
- Capture stdout/stderr for progress
- Parse output for deployment URLs

## Deployment Output Parsing
Look for patterns in stdout:
- `Website URL: https://...`
- `Live URL: https://...`
- `https://[site-name].netlify.app`

Fallback: use `status` command to get URL after deployment.

## Environment Variables
Netlify CLI doesn't set env vars during deploy. Use Netlify API directly:
```
POST https://api.netlify.com/api/v1/accounts/{slug}/env/{key}
Authorization: Bearer <token>
Body: { "context": ["production"], "value": "..." }
```

## Build Requirements
Netlify deploys built static files. Must build project before deploying:
- Build output directory (e.g., `dist`, `build`, `.next`)
- Specify with `--dir` flag

## Template-Specific Configs
- **Next.js**: `buildDir: '.next'`, no functions dir
- **React SPA**: `buildDir: 'dist'`, `functionsDir: 'netlify/functions'`
- **Static sites**: `buildDir: 'dist'`

## Electron Builder Config
No special configuration needed beyond standard npm bundling. Netlify CLI will be in `node_modules`.

Optional: use `asarUnpack` for `node_modules/netlify-cli/**/*` if issues arise.

## Critical Notes
- Requires Node.js (already in Electron)
- Larger bundle size than Railway (~80 MB)
- Must build project before deployment
- `.netlify` directory in project for site linkage
- Token validation: test with API call to `/user` endpoint
- Windows/macOS/Linux work identically (same code)

## Best For
- Static sites and SPAs
- JAMstack applications
- Sites with serverless functions
- React, Next.js, Vue, Svelte apps
- Sites requiring CDN and edge functions
