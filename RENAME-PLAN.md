# Multi-User Isolation + BeeSwarm → CodeDeck Rename Plan

## Problem 1: Multi-User Sharing Projects

**Current behavior:**
- Two users (different Google accounts) on same macOS user → see same projects
- Projects: `~/Documents/BeeSwarm/Projects/`
- Database: `~/Library/Application Support/BeeSwarm/database.db`

**Solution: User ID isolation**
```
~/Documents/CodeDeck/{userId}/Projects/
~/Library/Application Support/codedeck/{userId}/database.db
```

---

## Problem 2: Rename BeeSwarm → CodeDeck

**77 references** found across codebase

---

## Changes Required

### 1. File Paths (CRITICAL)

**TemplateService.ts:18-20**
```typescript
// OLD
private getProjectsBaseDir(): string {
  const homeDir = app.getPath('home')
  return path.join(homeDir, 'Documents', 'BeeSwarm', 'Projects')
}

// NEW
private getProjectsBaseDir(userId: string): string {
  const homeDir = app.getPath('home')
  return path.join(homeDir, 'Documents', 'CodeDeck', userId, 'Projects')
}
```

**DatabaseService.ts:49-51**
```typescript
// OLD
const userDataPath = app.getPath('userData') // ~/Library/Application Support/BeeSwarm/
this.dbPath = path.join(userDataPath, 'database.db')

// NEW
init(userId: string): void {
  const userDataPath = app.getPath('userData') // ~/Library/Application Support/CodeDeck/
  this.dbPath = path.join(userDataPath, userId, 'database.db')
}
```

**Impact:**
- TemplateService needs userId parameter in all methods
- DatabaseService needs userId on init()
- Main.ts must pass userId from auth to services

---

### 2. Package & Build Config

**package.json**
```json
{
  "name": "codedeck",                    // Line 2
  "author": "CodeDeck",                  // Line 20
  "build": {
    "appId": "com.codedeck.app",         // Line 61
    "productName": "CodeDeck"            // Line 62
  }
}
```

**Impact:**
- `app.getPath('userData')` automatically becomes `~/Library/Application Support/CodeDeck/`
- App icon/name in macOS

---

### 3. localStorage Keys

**Current keys:**
- `beeswarm_auth_encrypted`
- `beeswarm_auth_fallback`
- `beeswarm_auth` (legacy)
- `beeswarm_currentProjectId`

**New keys:**
- `codedeck_auth_encrypted`
- `codedeck_auth_fallback`
- `codedeck_currentProjectId`

**Files to update:**
- `src/App.tsx` (lines 35-37)
- `src/store/appStore.ts` (lines 67-69, 115, 162, 169, 183)
- `src/components/TemplateSelector.tsx` (lines 213-214)

---

### 4. Protocol Handler

**Current:** `beeswarm://auth/callback`

**New:** `codedeck://auth/callback`

**Files to update:**
- `electron/services/AuthService.ts` (OAuth redirect URLs)
- Any registered protocol handlers in main.ts

---

### 5. Website URLs

**Current:** `beeswarm.app/upgrade`, `beeswarm.app/faq`

**Decision needed:**
- Change domain to `codedeck.app`?
- Or keep beeswarm.app for now?

**Files to update:**
- `src/components/TemplateSelector.tsx`
- Any marketing/upgrade flows

---

### 6. Migration Strategy

**Problem:** Existing users have data at old locations

**Solution:** Auto-migration on first launch

```typescript
async function migrateUserData(userId: string) {
  // 1. Check for old BeeSwarm data
  const oldProjectsDir = '~/Documents/BeeSwarm/Projects'
  const oldDbPath = '~/Library/Application Support/BeeSwarm/database.db'

  // 2. If exists, move to new location
  const newProjectsDir = `~/Documents/CodeDeck/${userId}/Projects`
  const newDbPath = `~/Library/Application Support/codedeck/${userId}/database.db`

  if (fs.existsSync(oldProjectsDir)) {
    fs.renameSync(oldProjectsDir, newProjectsDir)
  }

  if (fs.existsSync(oldDbPath)) {
    fs.renameSync(oldDbPath, newDbPath)
  }

  // 3. Update localStorage keys
  const oldAuth = localStorage.getItem('beeswarm_auth_encrypted')
  if (oldAuth) {
    localStorage.setItem('codedeck_auth_encrypted', oldAuth)
    localStorage.removeItem('beeswarm_auth_encrypted')
  }
}
```

---

## Implementation Order

### Phase 1: User Isolation (DO FIRST)
1. ✅ Add userId parameter to TemplateService methods
2. ✅ Add userId parameter to DatabaseService.init()
3. ✅ Update main.ts to pass userId from auth
4. ✅ Test: Two users should have separate projects/databases

### Phase 2: Rename (DO AFTER USER ISOLATION WORKS)
1. ✅ Update package.json (name, appId, productName)
2. ✅ Update localStorage keys in all files
3. ✅ Update protocol handler
4. ✅ Update website URLs (if changing domain)
5. ✅ Add migration logic for existing users
6. ✅ Test migration flow

---

## Files Requiring Changes

### Critical (User Isolation)
- `electron/services/TemplateService.ts` - Add userId param
- `electron/services/DatabaseService.ts` - Add userId param
- `electron/main.ts` - Pass userId from auth
- `electron/services/ProjectService.ts` - Pass userId through
- `electron/handlers/authHandlers.ts` - Store userId after login

### Critical (Rename)
- `package.json` - App name, ID, author
- `src/App.tsx` - localStorage keys
- `src/store/appStore.ts` - localStorage keys
- `src/components/TemplateSelector.tsx` - localStorage + URLs
- `electron/services/AuthService.ts` - Protocol handler

### Optional (Rename)
- `electron/services/DatabaseService.ts:49` - Comment
- UI text showing "BeeSwarm" anywhere
- README.md
- Documentation

---

## Testing Checklist

### User Isolation
- [ ] User A logs in → creates project → sees it
- [ ] User A logs out
- [ ] User B logs in → doesn't see User A's projects
- [ ] User B creates project → User A can't see it
- [ ] Check filesystem: two separate folders exist

### Rename
- [ ] Fresh install shows "CodeDeck" everywhere
- [ ] localStorage uses `codedeck_*` keys
- [ ] Database at `~/Library/Application Support/CodeDeck/{userId}/`
- [ ] Projects at `~/Documents/CodeDeck/{userId}/Projects/`

### Migration
- [ ] User with old BeeSwarm data → auto-migrates to CodeDeck
- [ ] Old projects still work
- [ ] Old auth session preserved
- [ ] No data loss

---

## Risk Assessment

### HIGH RISK (User Isolation)
- Breaking existing installations
- Database schema changes
- Data loss if migration fails

### MEDIUM RISK (Rename)
- localStorage key mismatch
- Protocol handler not updating
- Users lose session on update

### LOW RISK
- UI text changes
- Package name changes (Electron handles userData automatically)

---

## Recommendation

**Do in this order:**
1. **User isolation FIRST** (more complex, structural change)
2. **Rename SECOND** (simpler, mostly find-replace)
3. **Test thoroughly** before shipping

**Why this order?**
- User isolation changes database/file structure
- Rename is mostly cosmetic + localStorage keys
- Easier to test isolation without rename confusion
- Migration script can handle both at once

---

## Questions for You

1. **Website domain:** Keep `beeswarm.app` or change to `codedeck.app`?
2. **Migration:** Auto-migrate or show modal asking user?
3. **Multi-user on same OS:** Do you want to support this? (Most don't)
4. **User ID vs Email:** Use `user.id` or `user.email` for folder name?

Let me know and I'll implement!
