# Paywall System - Implementation Guide

## Security Principle

**Golden Rule**: Never trust the client. All plan restrictions must be enforced server-side. The frontend should only provide UX hints (show/hide features, display upgrade prompts), but the actual blocking must happen on the backend.

---

## Current Plan Structure

### Plans
- **Free**: Basic access, no AI features
- **Plus**: Chat AI, limited features
- **Premium**: Full access to all features

### Where Plans are Stored
- MongoDB `users` collection contains `plan` field
- User data fetched fresh on every authenticated request
- JWT contains user ID only (not plan info - prevents tampering)

---

## Secure Implementation Pattern

### What NOT to Do (Insecure)
```
Frontend checks user.plan → Allows/blocks feature
```
This can be bypassed by modifying localStorage, React state, or Electron's renderer process.

### What TO Do (Secure)
```
Frontend checks user.plan → Shows UI hint only
User triggers action → Request sent to backend with JWT
Backend verifies JWT → Fetches fresh user from MongoDB
Backend checks user.plan → Allows/blocks and returns response
```

---

## Adding a New Paywalled Feature

### Step 1: Define the Feature Limit (Backend)

**File**: `CodeDeck-Backend/src/config/planLimits.js` (create if doesn't exist, or add to existing config)

Add your feature to the plan limits configuration:
- Define what each plan gets (boolean for access, number for quotas)
- Example features: `canUseCodeAnalysis`, `maxProjectsPerDay`, `canExportPDF`

### Step 2: Create/Update Backend Endpoint

**File**: `CodeDeck-Backend/src/routes/[feature].js`

For every paywalled endpoint:
1. Use auth middleware to verify JWT
2. Fetch user from MongoDB using ID from JWT
3. Check user's plan against required plan for feature
4. If not allowed, return 403 with clear error message
5. If allowed, proceed with feature logic
6. Track usage in MongoDB if feature has quotas

### Step 3: Create Electron IPC Handler

**File**: `electron/handlers/[feature]Handlers.ts`

The handler should:
1. Receive request from renderer
2. Call BackendService with JWT
3. Return result (success or error with plan requirement)

### Step 4: Update Frontend UI

**File**: `src/components/[Feature].tsx`

Frontend should:
1. Read `user.plan` from app store (for UX only)
2. Show feature to all users (don't hide it)
3. For users without access: show lock icon, disable inputs, show upgrade prompt
4. For users with access: normal functionality
5. Handle 403 errors gracefully (show upgrade modal)

---

## Backend Implementation Details

### Auth Middleware Pattern

Every protected route should use the auth middleware that:
1. Extracts JWT from `Authorization: Bearer <token>` header
2. Verifies JWT signature using server-side secret
3. Attaches user ID to request object
4. Does NOT attach plan info (always fetch fresh)

### Plan Check Helper Function

Create a reusable helper in `CodeDeck-Backend/src/utils/planCheck.js`:
- Function: `checkFeatureAccess(userId, featureName)`
- Fetches user from MongoDB
- Checks plan against feature requirements
- Returns `{ allowed: boolean, plan: string, required: string }`

### Usage Tracking Pattern

For features with quotas (not just boolean access):
1. Create/update document in `FeatureUsage` collection
2. Key by `{ userId, date }` for daily limits
3. Use atomic increment operations
4. Check limit BEFORE incrementing

---

## Frontend Implementation Details

### App Store User Data

**File**: `src/store/appStore.ts`

The user object should contain:
- `plan`: Current plan ('free', 'plus', 'premium')
- Other user info (id, email, etc.)

This data is fetched on app load and stored in Zustand store.

### Access Check Pattern

In any component that needs plan checking:

1. Get user from store: `const { user } = useAppStore()`
2. Define access: `const hasAccess = user?.plan === 'plus' || user?.plan === 'premium'`
3. Define required plan for upgrade prompt: `const requiredPlan = 'Plus'`
4. Render conditionally based on `hasAccess`

### Upgrade Flow

When user clicks upgrade:
1. Open external link to pricing page: `window.electronAPI.shell.openExternal('https://codedeckai.com/#pricing')`
2. User completes purchase on website
3. User data updates in MongoDB
4. On next app restart or manual refresh, new plan is reflected

---

## Features to Paywall (Checklist)

### Currently Implemented
- [x] Chat AI (Plus+)
- [x] Image Generation (Premium)

### Potential Future Features

For each feature below, follow the implementation pattern:

#### Code Analysis / AI Code Review
- Backend: Create `/api/ai/analyze` endpoint with plan check
- Electron: Add handler in `chatWidgetHandlers.ts` or new file
- Frontend: Add UI with plan gating

#### Export Features (PDF, etc.)
- Backend: Create `/api/export/pdf` endpoint with plan check
- Electron: Add handler for export operations
- Frontend: Show export button with lock for free users

#### Advanced Project Features
- Backend: Check plan on project creation if limiting project count
- Electron: Pass through to backend
- Frontend: Show limit reached message

#### Team/Collaboration Features
- Backend: Check plan for team operations
- Electron: Handle team-related IPC
- Frontend: Show team features with upgrade prompts

---

## MongoDB Collections for Paywall

### users
- `plan`: 'free' | 'plus' | 'premium'
- `planExpiresAt`: Date (for subscription expiry)
- `planStartedAt`: Date

### aiUsage (existing)
- `userId`: ObjectId
- `date`: String (YYYY-MM-DD)
- `chatTokens`: Number
- `imageCount`: Number

### featureUsage (create as needed)
- `userId`: ObjectId
- `date`: String (YYYY-MM-DD)
- `[featureName]Count`: Number

---

## Environment Configuration

### Backend Environment Variables
- `JWT_SECRET`: Must be strong, never exposed to client
- `MONGODB_URI`: Database connection

### Plan Configuration
Keep plan limits in a config file, not hardcoded in routes. This allows easy adjustment without code changes across multiple files.

---

## Testing Paywall Features

### Test Cases
1. **Free user tries Plus feature**: Should see 403, upgrade prompt
2. **Plus user tries Premium feature**: Should see 403, upgrade prompt
3. **Premium user uses all features**: Should work
4. **Tampered JWT**: Should fail authentication
5. **Modified client-side plan**: Backend should still block
6. **Usage limit reached**: Should see limit error, reset next day

### Testing Tools
- Modify user's plan directly in MongoDB for testing
- Use different test accounts for each plan level
- Monitor backend logs for plan check results

---

## Common Mistakes to Avoid

1. **Trusting client-side plan data for access control**
   - Always verify on backend

2. **Putting plan info in JWT payload**
   - User could use old JWT after downgrade

3. **Caching user plan data on backend**
   - Always fetch fresh from database

4. **Hiding features completely from free users**
   - Better UX: show feature, explain what they're missing

5. **Not handling 403 errors gracefully**
   - Always show clear upgrade path

6. **Forgetting to track usage for quota features**
   - Increment AFTER successful operation

---

## Quick Reference: Adding New Paywalled Feature

1. **Backend Config**: Add feature to plan limits
2. **Backend Route**: Create endpoint with auth + plan check
3. **Backend Usage**: Add tracking if quota-based
4. **Electron Handler**: Create IPC handler calling backend
5. **Electron Types**: Update `electron.d.ts` with new API
6. **Frontend Component**: Add UI with plan-based rendering
7. **Frontend Store**: Ensure user plan is available
8. **Test**: Verify all plan levels behave correctly
