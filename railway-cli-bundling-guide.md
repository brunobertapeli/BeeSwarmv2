# Railway CLI - Electron Integration

## Core Approach
Bundle Railway CLI as standalone Go binaries (one per platform). No Node.js dependency needed beyond Electron's embedded runtime.

## Binary Sources
GitHub releases: `https://github.com/railwayapp/cli/releases`

**Platform binaries:**
- Windows: `railway_windows_amd64.zip` → `railway.exe`
- macOS Intel: `railway_darwin_amd64.tar.gz` → `railway`
- macOS ARM: `railway_darwin_arm64.tar.gz` → `railway`
- Linux: `railway_linux_amd64.tar.gz` → `railway`

## File Structure
```
resources/binaries/
  ├── win32-x64/railway.exe
  ├── darwin-x64/railway
  ├── darwin-arm64/railway
  └── linux-x64/railway
```

## Runtime Path Resolution
- **Dev**: `__dirname/../../resources/binaries/${platform}-${arch}/railway[.exe]`
- **Production**: `process.resourcesPath/binaries/railway[.exe]`
- Must verify binary exists and is executable (chmod 755 on Unix)

## Authentication
User creates Personal Access Token at `https://railway.com/account/tokens`

Set via environment variable:
- `RAILWAY_TOKEN` for CLI execution
- `CI=true` enables non-interactive mode
- Store token encrypted in electron-store

## Key Commands
- `railway init --name <name>` - Create new project
- `railway link <project-id>` - Link existing project
- `railway up --detach` - Deploy code
- `railway domain` - Get deployment URL
- `railway variables set KEY=VALUE` - Set env vars
- `railway status` - Get project status
- `railway logs` - View logs

## Execution Pattern
Spawn binary with Node's `child_process.spawn()`:
- Windows requires `shell: true`
- Set `RAILWAY_TOKEN` in env
- Capture stdout/stderr for progress
- Parse output for deployment URLs and status

## Electron Builder Config
Use `extraResources` to bundle platform-specific binaries. Map `${platform}-${arch}` directories to output `binaries` folder.

## Template-Specific Env Vars
Railway templates need:
- `NODE_ENV=production`
- WebSocket URLs for real-time apps
- Port configurations
- Database URLs (if applicable)


