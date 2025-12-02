# Railway Deployment - Implementation Handover

## What's Ready
- Railway CLI binary bundled at `resources/binaries/{platform}/railway`
- `DeploymentService` resolves CLI path via `getCliPath('railway')`
- Token stored encrypted via `deployment:get-token('railway')`
- CLI env vars via `getCliEnv('railway', token)` → sets `RAILWAY_TOKEN` + `CI=true`

## Deploy Flow
1. Get token: `window.electronAPI.deployment.getToken('railway')`
2. Get CLI command: `deploymentService.getCliCommand('railway')` → `{ cmd, baseArgs }`
3. Spawn with env: `spawn(cmd, [...baseArgs, 'up', '--detach'], { env: getCliEnv('railway', token), cwd: projectPath })`

## Key Commands
- `railway up --detach` - Deploy (non-blocking)
- `railway domain` - Get deployed URL
- `railway status` - Check deployment status
- `railway variables set KEY=VALUE` - Set env vars before deploy

## Project Linking
Railway needs project linking. Options:
- `railway init --name <name>` - Create new project
- `railway link <project-id>` - Link existing
- Store project ID in project metadata for subsequent deploys

## Output Parsing
- Parse stdout for deployment progress
- Look for URL patterns in output
- Use `railway domain` as fallback to get URL

## Notes
- Requires `cwd` set to project directory
- `CI=true` enables non-interactive mode
- Full-stack deploy (backend + frontend if configured)
