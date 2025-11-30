# Railway Support Implementation Plan

## Context

Currently all templates use Netlify with `netlify dev` CLI. We need to support Railway templates that have separate `/frontend` and `/backend` directories (full Node.js). Both Netlify and Railway projects must run in parallel on the same machine.

---

## Current Architecture (Netlify Only)

- `ProcessManager.ts` spawns `npx netlify dev --port X`
- `PortService.ts` allocates paired ports: Netlify (8888+) and Vite (5174+)
- One process per project
- Health check hits single port
- Preview shows single URL

---

## What Needs to Change

### 1. ProcessManager.ts

**Current:** Spawns single Netlify process per project.

**Needed:** Check `deployServices` from project/template before spawning. If Railway, spawn TWO processes (frontend + backend) instead of one. Track both processes under the same projectId but with different identifiers (e.g., `projectId-frontend`, `projectId-backend`).

### 2. PortService.ts

**Current:** Allocates 2 ports per project (Netlify + Vite).

**Needed:** For Railway templates, allocate 2 ports differently:
- Frontend dev server port (e.g., 5173+)
- Backend API server port (e.g., 3001+)

The port ranges should not conflict with Netlify port ranges. Suggested:
- Netlify: 8888-8999
- Railway Frontend: 5173-5272
- Railway Backend: 3001-3100

### 3. Project Database / Memory

**Current:** Stores single `port` per project.

**Needed:** For Railway projects, store both `frontendPort` and `backendPort`. Or store as JSON object with port mapping.

### 4. Health Checks

**Current:** Single HTTP check to Netlify port.

**Needed:** For Railway, check BOTH frontend and backend ports. Project is "healthy" only when both respond. Consider separate health status for each.

### 5. TemplateValidator.ts

**Current:** Validates `netlify.toml`, `netlify/functions/` exist.

**Needed:** Conditional validation:
- Netlify templates: current validation
- Railway templates: validate `/frontend/package.json` and `/backend/package.json` exist

### 6. TemplateService.ts

**Current:** Updates `netlify.toml` and `frontend/vite.config.ts` with allocated ports.

**Needed:** For Railway templates:
- Skip Netlify config updates
- Update frontend vite config with allocated frontend port
- Possibly update backend port in `.env` or config file

### 7. ProjectService.ts (createProject)

**Current:** Calls PortService for Netlify+Vite ports, updates configs.

**Needed:** Check `deployServices` and branch:
- Netlify: current flow
- Railway: allocate frontend+backend ports, update appropriate configs

### 8. PreviewService.ts

**Current:** Points BrowserView to single Netlify port.

**Needed:** For Railway, point to frontend port. Backend is API-only, not previewed.

### 9. DependencyService.ts

**No changes needed.** Already handles fullstack install order (root → frontend → backend).

### 10. Process Output/Logs

**Current:** Single output stream per project.

**Needed:** Aggregate output from both frontend and backend processes. Prefix logs with `[frontend]` or `[backend]` for clarity in terminal.

---

## Template Structure Difference

**Netlify Template:**
```
/project
  /frontend
  /backend (optional, for functions source)
  /netlify/functions
  netlify.toml
  package.json (has netlify-cli)
```

**Railway Template:**
```
/project
  /frontend (standalone Vite/React app)
  /backend (standalone Express/Node app)
  package.json (root, optional scripts)
```

---

## How Projects Identify Their Type

The `deployServices` field in template metadata (stored in project DB as JSON) determines the type:
- `["netlify"]` → Netlify flow
- `["railway"]` → Railway flow

This field already exists and is already stored in the database.

---

## Parallel Execution Example

User has 3 projects open:
1. Project A (Netlify) → port 8888
2. Project B (Railway) → frontend 5173, backend 3001
3. Project C (Netlify) → port 8889

All run simultaneously without conflicts.

---

## Key Files to Modify

1. `electron/services/ProcessManager.ts` - main spawning logic
2. `electron/services/PortService.ts` - port allocation
3. `electron/services/ProjectService.ts` - project creation branching
4. `electron/services/TemplateService.ts` - config updates
5. `electron/services/TemplateValidator.ts` - validation rules
6. `electron/handlers/processHandlers.ts` - may need to handle dual-process status

---

## Notes

- Railway CLI (`railway run`, `railway up`) is for deployment/env injection, NOT needed for local dev
- Local dev for Railway is just standard `npm run dev` in each directory
- No special Railway tooling required locally - it's plain Node.js
