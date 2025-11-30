# Adding New Services Guide

This document explains how to add new third-party services (like OpenAI, Clerk, Firebase, etc.) to CodeDeck templates.

---

## Overview

When a template requires external services (Stripe, MongoDB, etc.), users are prompted to enter API keys during project creation. These keys are then written to the appropriate `.env` file(s).

**Key files involved:**
- `src/components/ProjectCreationFlow.tsx` - Service definitions and UI
- `shared/envKeyTargets.ts` - Env key routing (frontend vs backend)

---

## Step 1: Add Service to SERVICE_IDENTIFIERS

Location: `src/components/ProjectCreationFlow.tsx`

```typescript
const SERVICE_IDENTIFIERS: Record<string, {...}> = {
  // Add your new service here
  openai: {
    name: 'OpenAI',
    provider: 'openai',
    icon: 'openai',
    required: ['OPENAI_API_KEY'],
    optional: ['OPENAI_ORG_ID'],
    description: 'AI and GPT integration'
  },
}
```

### Fields explained:
| Field | Description |
|-------|-------------|
| `name` | Display name shown to user |
| `provider` | Unique identifier (used in template's `requiredServices`) |
| `icon` | Icon name for UI (must exist in your icon set) |
| `required` | Array of required env variable names |
| `optional` | Array of optional env variable names |
| `description` | Help text shown to user |

---

## Step 2: Add Key Validation (Optional but Recommended)

Location: `src/components/ProjectCreationFlow.tsx`

```typescript
const KEY_CONFIGS: Record<string, {...}> = {
  OPENAI_API_KEY: {
    label: 'API Key',
    description: 'Your OpenAI API key',
    validate: (key) => key.startsWith('sk-') && key.length > 20
  },
}
```

---

## Step 3: Configure Env Key Target (If Needed)

Location: `shared/envKeyTargets.ts`

**Default behavior:** Unknown keys go to `backend/.env` (safe for secrets)

**Only update this file if the key should go to frontend:**

```typescript
const ENV_KEY_TARGETS: Record<string, EnvTarget> = {
  // Frontend keys (safe to expose in browser)
  STRIPE_PUBLISHABLE_KEY: 'frontend',
  SUPABASE_URL: 'frontend',
  SUPABASE_ANON_KEY: 'frontend',

  // Backend keys (secrets - this is the default, no need to add)
  // OPENAI_API_KEY: 'backend',  // Not needed - defaults to backend
}
```

### Routing Rules:
1. `VITE_*` prefix → Always frontend
2. Explicit mapping → Uses mapped value
3. Unknown keys → Defaults to `backend`

---

## How Templates Use Services

In your template metadata, specify required services:

```json
{
  "name": "AI Chat App",
  "requiredServices": ["openai", "supabase_auth"],
  "deployServices": ["railway"],
  "envFiles": [
    { "path": "frontend/.env", "label": "Frontend", "description": "React app config" },
    { "path": "backend/.env", "label": "Backend", "description": "API server config" }
  ]
}
```

---

## Complete Example: Adding Clerk Auth

### 1. Add to SERVICE_IDENTIFIERS:
```typescript
clerk: {
  name: 'Clerk Authentication',
  provider: 'clerk',
  icon: 'clerk',
  required: ['CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'],
  optional: ['CLERK_WEBHOOK_SECRET'],
  description: 'User authentication and management'
},
```

### 2. Add to KEY_CONFIGS:
```typescript
CLERK_PUBLISHABLE_KEY: {
  label: 'Publishable Key',
  description: 'Public key for frontend',
  validate: (key) => key.startsWith('pk_')
},
CLERK_SECRET_KEY: {
  label: 'Secret Key',
  description: 'Secret key for backend',
  validate: (key) => key.startsWith('sk_')
},
```

### 3. Add to ENV_KEY_TARGETS (only frontend key):
```typescript
CLERK_PUBLISHABLE_KEY: 'frontend',
// CLERK_SECRET_KEY defaults to backend - no entry needed
```

---

## Quick Reference: Common Services

| Service | Keys | Target |
|---------|------|--------|
| **OpenAI** | `OPENAI_API_KEY` | backend |
| **Anthropic** | `ANTHROPIC_API_KEY` | backend |
| **Clerk** | `CLERK_PUBLISHABLE_KEY` | frontend |
| | `CLERK_SECRET_KEY` | backend |
| **Firebase** | `FIREBASE_API_KEY` | frontend |
| | `FIREBASE_SERVICE_ACCOUNT` | backend |
| **Resend** | `RESEND_API_KEY` | backend |
| **Twilio** | `TWILIO_ACCOUNT_SID` | backend |
| | `TWILIO_AUTH_TOKEN` | backend |
| **AWS** | `AWS_ACCESS_KEY_ID` | backend |
| | `AWS_SECRET_ACCESS_KEY` | backend |

---

## Testing

1. Create a template with your new `requiredServices`
2. Create a project from that template
3. Verify the env setup screen shows your service
4. Enter test values and check they're written to correct `.env` files:
   - Netlify templates: root `.env`
   - Railway templates: `frontend/.env` and/or `backend/.env`
