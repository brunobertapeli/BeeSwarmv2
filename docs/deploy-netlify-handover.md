# Netlify Deployment - Implementation Handover

## What's Ready
- Netlify CLI installed as npm dependency
- `DeploymentService` resolves CLI path via `getCliPath('netlify')`
- Token stored encrypted via `deployment:get-token('netlify')`
- CLI env vars via `getCliEnv('netlify', token)` → sets `NETLIFY_AUTH_TOKEN` + `NODE_ENV=production`

## Deploy Flow
1. Get token: `window.electronAPI.deployment.getToken('netlify')`
2. Get CLI command: `deploymentService.getCliCommand('netlify')` → `{ cmd: process.execPath, baseArgs: [cliPath] }`
3. **Build project first** (Netlify deploys static files only)
4. Spawn: `spawn(cmd, [...baseArgs, 'deploy', '--prod', '--dir', buildDir], { env, cwd: projectPath })`

## Key Commands
- `netlify deploy --prod --dir <buildDir>` - Deploy to production
- `netlify sites:create --name <name> --manual` - Create new site
- `netlify status` - Get site info and URL

## Site Linking
Netlify uses `.netlify/state.json` in project root:
```json
{ "siteId": "abc123" }
```
Create this file to link project to existing site.

## Build Directories (per template)
- React/Vite: `dist`
- Next.js: `.next` or `out` (static export)
- Static: `dist` or `build`

## Output Parsing
- Look for `Website URL:` or `Live URL:` in stdout
- Pattern: `https://[site-name].netlify.app`
- Fallback: use `netlify status` after deploy

## Notes
- Must build before deploy (static files only)
- Runs via Electron's Node.js (`process.execPath`)
- For serverless functions: add `--functions <dir>`
