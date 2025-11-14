# CodeDeck Backend

Secure Node.js backend for CodeDeck that proxies all sensitive operations and database access.

## Purpose

This backend ensures security by:
- Hiding MongoDB credentials from the Electron app
- Validating user plans server-side
- Controlling template distribution
- Centralizing all database operations

## Architecture

```
Electron App → BackendService (HTTP) → Backend API (Render) → MongoDB
```

**All sensitive operations MUST go through this backend, never directly from the Electron app.**

## Deployment

**IMPORTANT:** After making changes to `/backend`, you MUST:

1. Copy files to the separate backend repository
2. Push to GitHub: https://github.com/CodeDeckAI/CodeDeck-Backend
3. Render will auto-deploy (or deploy manually from dashboard)

**Backend URL:** https://codedeck-backend.onrender.com

## Environment Variables (Render)

```env
MONGODB_URI=mongodb+srv://...
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## API Endpoints

### Health & Status
- `GET /health` - Health check
- `GET /api/v1/status` - API status

### Users
- `GET /api/v1/users/:email` - Get user by email
- `POST /api/v1/users` - Create new user
- `POST /api/v1/users/validate-plan` - Validate user plan for premium features

### Templates
- `GET /api/v1/templates` - List all templates
- `GET /api/v1/templates/:id` - Get template by ID
- `GET /api/v1/templates/:id/download` - Download template zip file (requires `x-user-email` header)

## Security Features

- Input sanitization (prevents MongoDB injection)
- Path traversal prevention (for template downloads)
- Rate limiting (100 req/15min per IP)
- CORS protection
- Helmet security headers
- Request size limits (10mb)
- **Server-side plan validation** (enforces premium access control)

## Template Distribution

Templates are stored in `/templates` as zip files:
- `templates/saas1-template.zip`
- `templates/ecommerce-template.zip`
- etc.

Each MongoDB template document must have a `sourcePath` field pointing to the zip file name.

## Plan Validation Flow

All premium features are protected by server-side plan validation to prevent client-side bypass:

### Two-Tier Security Architecture

**Tier 1: Frontend (UX Only)**
- Uses localStorage to show/hide premium features in UI
- Displays upgrade prompts and badges
- **NOT trusted for security** - can be manipulated by user

**Tier 2: Backend (Enforcement)**
- Validates user plan before allowing access
- Checks subscription status (active/expired/canceled)
- Returns 403 Forbidden if access denied
- **Cannot be bypassed** - enforced on server

### Template Download Flow (Example)

```
1. User clicks "Create Project" in Electron app
   └─> Frontend shows template (Tier 1: display only)

2. ProjectHandler gets authenticated user email
   └─> getCurrentUserEmail() from session

3. Email passed through service chain
   └─> ProjectService → TemplateService → BackendService

4. BackendService adds email to HTTP header
   └─> Header: x-user-email: user@example.com

5. Backend API receives download request
   └─> GET /api/v1/templates/:id/download

6. SECURITY: Backend validates user plan
   ├─> Fetch user from MongoDB by email
   ├─> Check subscription status (must be 'active')
   ├─> Compare plan hierarchy: free (0) < plus (1) < premium (2)
   └─> If insufficient: Return 403 with error details

7. If validation passes: Stream template zip file
   └─> User receives template and project is created

8. If validation fails: Frontend displays upgrade prompt
   └─> Error: "This template requires a premium plan"
```

### Plan Hierarchy

```javascript
const planHierarchy = {
  free: 0,
  plus: 1,
  premium: 2
}
```

### Error Responses

**401 Unauthorized** - Missing `x-user-email` header
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**403 Forbidden** - Insufficient plan or inactive subscription
```json
{
  "success": false,
  "error": "Plan upgrade required",
  "requiredPlan": "premium",
  "userPlan": "free",
  "subscriptionStatus": "active"
}
```

**403 Forbidden** - Inactive subscription
```json
{
  "success": false,
  "error": "Active subscription required",
  "requiredPlan": "plus",
  "userPlan": "plus",
  "subscriptionStatus": "expired"
}
```

## Adding New Proxied Features

When you need to add a new feature that requires MongoDB or must be secure:

1. **Create route** in `/backend/src/routes/`
2. **Add to server.js** - Import and mount the router
3. **Update Electron's BackendService** - Add method to call the endpoint
4. **Copy to GitHub** - Push to CodeDeckAI/CodeDeck-Backend
5. **Deploy** - Wait for Render auto-deploy

### Adding Plan Validation to New Features

To protect a new premium feature with server-side plan validation:

**Backend (API Route):**
```javascript
// 1. Get user email from header
const userEmail = req.headers['x-user-email'];
if (!userEmail || typeof userEmail !== 'string') {
  return res.status(401).json({ success: false, error: 'Authentication required' });
}

// 2. Fetch user from MongoDB
const user = await User.findOne({ email: userEmail });
if (!user) {
  return res.status(404).json({ success: false, error: 'User not found' });
}

// 3. Check subscription status (for non-free features)
if (user.subscriptionStatus !== 'active' && requiredPlan !== 'free') {
  return res.status(403).json({
    success: false,
    error: 'Active subscription required',
    requiredPlan,
    userPlan: user.plan,
    subscriptionStatus: user.subscriptionStatus
  });
}

// 4. Validate plan hierarchy
const planHierarchy = { free: 0, plus: 1, premium: 2 };
if (planHierarchy[user.plan] < planHierarchy[requiredPlan]) {
  return res.status(403).json({
    success: false,
    error: 'Plan upgrade required',
    requiredPlan,
    userPlan: user.plan,
    subscriptionStatus: user.subscriptionStatus
  });
}

// 5. Proceed with feature logic...
```

**Electron (BackendService):**
```typescript
async yourNewFeature(param: string, userEmail: string): Promise<Result> {
  const url = new URL('/api/v1/your-feature', this.baseUrl);
  const options = {
    headers: {
      'x-user-email': userEmail  // Always pass user email
    }
  };
  // Make request...
}
```

**Electron (Service Chain):**
```typescript
// 1. Handler gets user email
const userEmail = getCurrentUserEmail();
if (!userEmail) {
  return { success: false, error: 'User email not found' };
}

// 2. Pass through services
yourService.doSomething(param, userEmail);
  └─> backendService.yourNewFeature(param, userEmail);
```

## Project Structure

```
/backend
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── models/
│   │   ├── User.js               # User schema
│   │   └── Template.js           # Template schema
│   ├── routes/
│   │   ├── users.js              # User endpoints
│   │   └── templates.js          # Template endpoints
│   └── server.js                 # Main Express server
├── templates/                    # Template zip files
│   └── saas1-template.zip
├── package.json
├── .env                          # Local env (not committed)
└── README.md
```

## Development

```bash
cd backend
npm install
npm start          # Production
npm run dev        # Development with auto-reload
```

## Notes

- Never expose MongoDB credentials to the Electron app
- All user plan checks must happen server-side
- Template downloads are streamed (efficient for large files)
- Keep this backend lightweight and focused on security/data operations
