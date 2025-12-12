# Build with envs:
  export APPLE_ID=bruno@bertapeli.com
  export APPLE_APP_SPECIFIC_PASSWORD=jrot-qzeo-jklg-hvsk
  export APPLE_TEAM_ID=2Q2RJ392ZP
  npm run electron:build

# Check Notarization command:
  xcrun notarytool history --apple-id "bruno@bertapeli.com" --password "jrot-qzeo-jklg-hvsk" --team-id "2Q2RJ392ZP"

# CodeDeck Release Guide

## Prerequisites

Before releasing, ensure:
1. Icons are in place: `build/icon.icns`, `build/icon.ico`, `build/icon.png`
2. Version is updated in `package.json`
3. GitHub repo details are set in `package.json` under `build.publish`

---

## Option A: Manual Release (Recommended for starting)

### Step 1: Bump Version

Edit `package.json`:
```json
"version": "1.0.1"
```

### Step 2: Build on Mac

```bash
npm run electron:build
source .env && npm run electron:build
```

Output files in `dist/`:
- `codedeck-darwin-arm64.dmg` (Apple Silicon)
- `codedeck-darwin-arm64.dmg.blockmap`
- `codedeck-darwin-x64.dmg` (Intel Mac)
- `codedeck-darwin-x64.dmg.blockmap`
- `latest-mac.yml`

### Step 3: Build on Windows

```bash
npm run electron:build
```

Output files in `dist/`:
- `codedeck-win.exe`
- `codedeck-win.exe.blockmap`
- `latest.yml`

### Step 4: Create GitHub Release

1. Go to your GitHub repo
2. Click **Releases** → **Create a new release**
3. Tag: `v1.0.1` (must match version with `v` prefix)
4. Title: `v1.0.1` or `CodeDeck v1.0.1`
5. Description: Add release notes (optional)

### Step 5: Upload Files

Upload these files to the release:

| File | Platform | Required |
|------|----------|----------|
| `codedeck-darwin-arm64.dmg` | Mac (Apple Silicon) | Yes |
| `codedeck-darwin-arm64.dmg.blockmap` | Mac (Apple Silicon) | Yes |
| `codedeck-darwin-x64.dmg` | Mac (Intel) | Yes |
| `codedeck-darwin-x64.dmg.blockmap` | Mac (Intel) | Yes |
| `latest-mac.yml` | Mac (both) | **Critical** |
| `codedeck-win.exe` | Windows | Yes |
| `codedeck-win.exe.blockmap` | Windows | Yes |
| `latest.yml` | Windows | **Critical** |

> **Important:** The `.yml` files are critical for auto-updates to work. Without them, the app won't detect new versions.

### Step 6: Publish

Click **Publish release**

---

## Option B: Auto-publish

### Step 1: Create GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Name: `electron-builder`
4. Expiration: No expiration (or your preference)
5. Scopes: Check `repo` (full control)
6. Click **Generate token**
7. Copy the token (starts with `ghp_`)

### Step 2: Set Environment Variable

**Mac/Linux:**
```bash
export GH_TOKEN=ghp_your_token_here
```

**Windows (Command Prompt):**
```cmd
set GH_TOKEN=ghp_your_token_here
```

**Windows (PowerShell):**
```powershell
$env:GH_TOKEN="ghp_your_token_here"
```

### Step 3: Build & Publish

```bash
npm run electron:build -- --publish always
```

This will:
1. Build the app
2. Create a draft release on GitHub
3. Upload all files automatically
4. You just need to publish the draft

### Optional: Save Token Permanently

**Mac/Linux** - Add to `~/.zshrc` or `~/.bashrc`:
```bash
export GH_TOKEN=ghp_your_token_here
```

**Windows** - Set as system environment variable:
1. Search "Environment Variables" in Start
2. Add new User variable: `GH_TOKEN` = `ghp_your_token_here`

---

## Checklist for Each Release

- [ ] Update version in `package.json`
- [ ] Build on Mac (generates 2 DMGs + yml)
- [ ] Build on Windows (generates EXE + yml)
- [ ] Create GitHub release with tag `vX.X.X`
- [ ] Upload all 8 files (or auto-publish)
- [ ] Publish the release
- [ ] Test update notification in app

---

## Troubleshooting

### App doesn't detect updates
- Ensure `latest.yml` and `latest-mac.yml` are uploaded
- Ensure release tag matches version (e.g., `v1.0.1` for version `1.0.1`)
- Ensure release is published (not draft)

### Build fails with permission error
- Check `GH_TOKEN` is set correctly
- Check token has `repo` permissions
- Check owner/repo in `package.json` matches your GitHub repo

### Users can't download update
- Check release is public (not in private repo without token)
- Check all `.dmg`, `.exe`, and `.blockmap` files are uploaded
