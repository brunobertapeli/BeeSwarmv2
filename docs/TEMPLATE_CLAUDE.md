# BeeSwarm Template - Claude Code Instructions

> **COPY THIS FILE to `.claude/CLAUDE.md` in your BeeSwarm templates**

## CRITICAL RULES - DO NOT BREAK THESE

**YOU MUST follow these rules or the project will break in BeeSwarm:**

### Dev Server Management
- **NEVER** run `npm run dev`, `npm start`, or `netlify dev`
- **NEVER** start, stop, or restart any dev servers
- **NEVER** run commands that spawn long-running processes
- **WHY:** BeeSwarm manages all dev servers automatically. Running these commands will cause port conflicts and break the preview.

### Configuration Files
- **NEVER** modify `netlify.toml` port settings (`port` or `targetPort`)
- **NEVER** modify `frontend/vite.config.ts` port configuration
- **NEVER** delete or rename `netlify.toml`
- **WHY:** BeeSwarm automatically configures ports for each project. Manual changes will cause conflicts.

### Backend Architecture
- **NEVER** create a `backend/` directory
- **NEVER** create Express, Fastify, Koa, or any traditional server
- **NEVER** use `http.createServer` or similar Node.js server APIs
- **ALWAYS** use Netlify Functions for ALL backend logic
- **WHY:** BeeSwarm uses serverless architecture (Netlify Functions). Traditional servers won't work.

### Package Scripts
- **NEVER** modify the `dev` script in root `package.json`
- **NEVER** change the build command structure
- **WHY:** BeeSwarm relies on these scripts to run the project.

---

## User Context

**IMPORTANT:** The user running this project is **not a developer**. They are using BeeSwarm, a visual app that wraps Claude Code to make web development accessible to non-technical users. They can't even see the codebase.

- Use **simple, non-technical language** when explaining changes
- Avoid jargon like "API endpoint", "serverless function", "hot reload"
- Instead say: "I created a form that saves data", "I added a button that...", "I fixed the styling on..."
- Think of explaining to a friend who doesn't know coding

**Environment:**
- This code runs inside **BeeSwarm** (an Electron desktop app)
- Dev server is managed automatically by BeeSwarm
- Preview updates automatically when you save files
- User sees the preview in BeeSwarm's window

---

## What You CAN Do

### ✅ Code Editing
- Edit any `.ts`, `.tsx`, `.js`, `.jsx` files
- Create/modify React components
- Create/modify Netlify Functions
- Edit CSS/Tailwind styles
- Modify HTML in components

### ✅ Package Management
- Install npm packages: `npm install package-name`
- Add to `frontend/package.json` or root `package.json`
- Update dependencies

### ✅ Testing & Building
- Run `npm run build` to check for build errors
- Run `npm test` to run tests (if they exist)
- Check TypeScript errors: `tsc --noEmit`

### ✅ File Operations
- Create new files/folders (except `backend/`)
- Delete files (except config files)
- Rename files
- Move files

---

## What You MUST NOT Do

### ❌ Server Commands
- `npm run dev`
- `npm start`
- `netlify dev`
- `vite`
- Any command that starts a dev server

### ❌ Configuration Changes
- Modifying ports in any config file
- Changing `netlify.toml` structure
- Altering `vite.config.ts` server settings
- Deleting critical config files

### ❌ Architecture Violations
- Creating traditional backend servers
- Using Express, Fastify, etc.
- Creating `backend/` or `server/` directories
- WebSocket servers (use Netlify Functions instead)

---

## Project Structure

```
project-root/
├── frontend/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/
│   ├── .env                    # Frontend env vars (VITE_ prefix)
│   ├── package.json
│   └── vite.config.ts
│
├── netlify/
│   └── functions/              # Serverless backend (THE ONLY BACKEND!)
│       ├── hello.ts           # Example function
│       └── users.ts
│
├── .env                        # Function env vars (in root)
├── netlify.toml                # DO NOT MODIFY ports
├── package.json                # Root package.json
└── .claude/
    └── CLAUDE.md              # This file
```

---

## Backend Pattern - Netlify Functions

**THIS IS THE ONLY WAY to create backend/API logic in BeeSwarm projects.**

### Creating a Function

**File:** `netlify/functions/create-user.ts`

```typescript
import { Handler, HandlerEvent } from '@netlify/functions'

export const handler: Handler = async (event: HandlerEvent) => {
  // Parse request body
  const body = event.body ? JSON.parse(event.body) : null

  // Your logic here
  const name = body?.name
  const email = body?.email

  // Validate
  if (!name || !email) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'  // CORS
      },
      body: JSON.stringify({ error: 'Name and email required' })
    }
  }

  // Process (save to database, call API, etc.)
  // ...

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'User created',
      userId: '123'
    })
  }
}
```

### Key Points

- **Location:** Always `netlify/functions/filename.ts`
- **Export:** Must export `handler` function
- **Return:** Object with `statusCode`, `headers`, `body`
- **CORS:** Always include `Access-Control-Allow-Origin: *`
- **Body:** Always JSON.stringify the response body

### Accessing Environment Variables

```typescript
const apiKey = process.env.STRIPE_SECRET_KEY
const dbUrl = process.env.MONGODB_URI
```

Environment variables are set in root `.env` file (for local dev) or Netlify dashboard (for production).
**IMPORTANT** When adding a service or API that requires an environment variable, do not ask the user to edit any files manually. Instead, create or update the existing .env file with "SERVICE=" and the frontend will automatically detect it and display it nicely to the user. Say: “Please add the API key for  in your project settings.”

---

## Frontend API Calls

**ALWAYS use relative paths with `/.netlify/functions/` prefix.**

### Pattern

```typescript
// ✅ CORRECT - Relative path (works in dev AND production)
const response = await fetch('/.netlify/functions/create-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'John', email: 'john@example.com' })
})

const data = await response.json()
```

```typescript
// ❌ WRONG - Absolute URL (breaks between dev/prod)
const response = await fetch('http://localhost:8888/.netlify/functions/create-user', ...)

// ❌ WRONG - Environment variable (unnecessary complexity)
const response = await fetch(`${import.meta.env.VITE_API_URL}/create-user`, ...)
```

### Why Relative Paths Work

**Development:**
- Netlify Dev runs at `localhost:8888`
- Request to `/.netlify/functions/hello` → `localhost:8888/.netlify/functions/hello`

**Production:**
- Site at `https://myapp.netlify.app`
- Request to `/.netlify/functions/hello` → `https://myapp.netlify.app/.netlify/functions/hello`

**Same code, zero configuration.**

---

## Common Patterns

### Authentication (Supabase Example)

```typescript
// netlify/functions/auth-endpoint.ts
import { createClient } from '@supabase/supabase-js'

export const handler: Handler = async (event) => {
  const authHeader = event.headers.authorization

  if (!authHeader) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { statusCode: 401, body: 'Invalid token' }
  }

  // User is authenticated
  return {
    statusCode: 200,
    body: JSON.stringify({ userId: user.id })
  }
}
```

### Database Operations (MongoDB Example)

```typescript
// netlify/functions/get-posts.ts
import { MongoClient } from 'mongodb'

const client = new MongoClient(process.env.MONGODB_URI!)

export const handler: Handler = async (event) => {
  try {
    await client.connect()
    const db = client.db('myapp')
    const posts = await db.collection('posts')
      .find({})
      .limit(10)
      .toArray()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts)
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database error' })
    }
  } finally {
    await client.close()
  }
}
```

### Payment Processing (Stripe Example)

```typescript
// netlify/functions/create-checkout.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export const handler: Handler = async (event) => {
  const body = JSON.parse(event.body!)

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: body.productName },
        unit_amount: body.amount  // in cents
      },
      quantity: 1
    }],
    mode: 'payment',
    success_url: `${body.origin}/success`,
    cancel_url: `${body.origin}/cancel`
  })

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId: session.id })
  }
}
```

---

## Environment Variables

### Frontend Variables (Client-Side)

**File:** `frontend/.env`

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

**Access in code:**
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
```

**Rules:**
- Must prefix with `VITE_`
- Exposed to client (don't put secrets here)
- Only use for public keys

### Function Variables (Server-Side)

**File:** `.env` (in root)

```env
STRIPE_SECRET_KEY=sk_test_xxx
MONGODB_URI=mongodb+srv://...
SUPABASE_SERVICE_KEY=eyJxxx...
```

**Access in functions:**
```typescript
const secretKey = process.env.STRIPE_SECRET_KEY
```

**Rules:**
- No prefix required
- Never exposed to client
- Use for API keys, secrets

---

## Testing & Verification

### When User Asks "Does it work?" or "Test it"

1. **Check for build errors:**
   ```bash
   npm run build
   ```
   If it builds successfully, the code is valid.

2. **Check TypeScript errors:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

3. **Run tests (if they exist):**
   ```bash
   npm test
   ```

4. **Explain to user:**
   "I've made the changes and verified the code compiles correctly. The preview will update automatically in BeeSwarm. You can now test the new feature!"

### **DO NOT:**
- Run `npm run dev` to "test"
- Try to open localhost URLs
- Say "let me start the server to check"

### **WHY:**
- BeeSwarm's dev server is already running
- Preview updates automatically when you save files
- No manual testing needed - just verify code is valid

---

## Code Style & Conventions

### TypeScript
- Always use TypeScript, never plain JavaScript
- Enable strict mode
- Define interfaces for props and API responses

### React
- Functional components with hooks
- Use `useState`, `useEffect`, `useContext`
- Avoid class components

### Imports
- Named exports preferred over default exports
- Group imports: React → Third-party → Local

### Formatting
- 2-space indentation
- Single quotes for strings
- Semicolons at end of statements
- Trailing commas in objects/arrays

---

## Common User Requests & How to Handle

### "Add a contact form"
1. Create frontend component with form inputs
2. Create Netlify Function to handle submission
3. Call function from form onSubmit
4. Show success message to user

### "Connect to database"
1. Ask user for database credentials
2. Store in root `.env` file
3. Create Netlify Function that connects to DB
4. Use function in frontend via fetch

### "Add authentication"
1. Set up Supabase (or other auth provider)
2. Store keys in `.env` files
3. Create auth functions (login, signup, logout)
4. Add auth UI components
5. Protect routes with auth checks

### "Make it look better"
1. Improve styling with Tailwind classes
2. Add responsive design
3. Improve color scheme
4. Add animations/transitions

### "Add payment"
1. Set up Stripe
2. Store keys in `.env` files
3. Create checkout function
4. Add payment UI with Stripe Elements
5. Handle success/cancel flows

---

## When to Install Packages

### Frontend Packages
Install in `frontend/`:
```bash
cd frontend && npm install package-name
```

**Common packages:**
- `@supabase/supabase-js` - Supabase client
- `@stripe/stripe-js` - Stripe frontend
- `react-router-dom` - Routing
- `axios` - HTTP client (alternative to fetch)
- `framer-motion` - Animations

### Function Packages
Install in root:
```bash
npm install package-name
```

**Common packages:**
- `@netlify/functions` - Types for functions
- `stripe` - Stripe backend SDK
- `mongodb` - MongoDB driver
- `@supabase/supabase-js` - Supabase admin
- `nodemailer` - Send emails

---

## Error Handling

### Build Errors
If `npm run build` fails:
1. Read the error message carefully
2. Fix the TypeScript/syntax issue
3. Run build again to verify

### Runtime Errors
If preview shows errors:
1. Check browser console (user can press F12)
2. Fix the JavaScript error
3. Save file - preview updates automatically

### Function Errors
If API calls fail:
1. Check function code for errors
2. Verify CORS headers are present
3. Check environment variables are set
4. Test function in isolation

---

## Summary for Claude Code

**YOU ARE EDITING CODE FOR A NON-TECHNICAL USER IN BEESWARM**

✅ **DO:**
- Edit code files freely
- Create Netlify Functions for backend
- Use relative paths for API calls
- Run build/test commands to verify
- Explain changes in simple terms
- Check for errors before finishing

❌ **DON'T:**
- Start dev servers (BeeSwarm handles this)
- Modify port configurations
- Create traditional backend servers
- Use technical jargon with user
- Assume user knows coding concepts

🎯 **GOAL:**
Make the user's idea work by writing clean, functional code that runs perfectly in BeeSwarm's environment.

---

**This file is automatically read by Claude Code when working on this project. Following these instructions ensures smooth collaboration between Claude Code and BeeSwarm.**
