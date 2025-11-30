# Railway Template Structure Guide

This document describes how to structure templates that support Railway deployment with separate frontend and backend services.

---

## Directory Structure

```
my-template/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── railway.json (optional)
├── backend/
│   ├── src/ or server.js
│   ├── package.json
│   ├── .env.example
│   └── railway.json (optional)
├── package.json (root - optional)
└── README.md
```

---

## Frontend Requirements

### package.json

```json
{
  "name": "my-app-frontend",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true, // Required for Railway
  },
  preview: {
    port: parseInt(process.env.PORT || '4173'),
    host: true,
  },
});
```

### API Configuration (Critical)

Create a centralized API configuration that works both locally and in production:

**src/lib/api.ts** or **src/config/api.ts**

```typescript
const getApiUrl = (): string => {
  // 1. Explicit env var (set by CodeDeck locally, or Railway in production)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // 2. Production without explicit URL - assume same origin
  // (only works with reverse proxy setup)
  if (import.meta.env.PROD) {
    return '';
  }

  // 3. Local development fallback
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();

// Helper for making API calls
export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  // Add put, delete, etc. as needed
};
```

### Usage in Components

```typescript
import { api, API_URL } from '@/lib/api';

// Option 1: Using the helper
const users = await api.get('/api/users');

// Option 2: Direct fetch with API_URL
const response = await fetch(`${API_URL}/api/users`);
```

### .env.example

```env
# API URL - Set automatically by CodeDeck for local dev
# Set manually in Railway dashboard for production
VITE_API_URL=http://localhost:3001
```

### railway.json (Optional)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run preview",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300
  }
}
```

---

## Backend Requirements

### package.json

```json
{
  "name": "my-app-backend",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.x",
    "cors": "^2.x"
  },
  "devDependencies": {
    "nodemon": "^3.x"
  }
}
```

### server.js (or src/index.ts)

```javascript
const express = require('express');
const cors = require('cors');

const app = express();

// PORT is set by CodeDeck locally, and by Railway in production
const PORT = process.env.PORT || 3001;

// CORS - Allow frontend origin
// FRONTEND_URL is set automatically by CodeDeck (local) and Railway (production)
const allowedOrigins = [
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allow Railway domains in production
    if (origin.includes('.up.railway.app')) {
      return callback(null, true);
    }

    // Allow configured frontend URL
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

// Health check endpoint (required for Railway)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Your routes here
app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'John' }]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 API server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
});
```

### .env.example

```env
# Port - Set automatically by CodeDeck and Railway
PORT=3001

# Database (example)
DATABASE_URL=

# Frontend URL for CORS (set in Railway)
FRONTEND_URL=
```

### railway.json (Optional)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

---

## Environment Variables Flow

### Local Development (CodeDeck)

CodeDeck automatically sets these when starting the dev server:

| Service  | Variable       | Value                           |
|----------|---------------|---------------------------------|
| Frontend | VITE_API_URL  | http://localhost:{backend_port} |
| Backend  | PORT          | {allocated_port}                |
| Backend  | FRONTEND_URL  | http://localhost:{frontend_port}|

### Production (Railway)

CodeDeck's deploy service will set these automatically:

| Service  | Variable       | Value                              |
|----------|---------------|------------------------------------|
| Backend  | PORT          | (Railway sets automatically)       |
| Frontend | VITE_API_URL  | https://backend-xxx.up.railway.app |
| Frontend | PORT          | (Railway sets automatically)       |
| Backend  | FRONTEND_URL  | https://frontend-xxx.up.railway.app|

---

## Template Checklist

Before marking a template as Railway-compatible:

### Frontend
- [ ] `package.json` has `dev`, `build`, and `preview` scripts
- [ ] `vite.config.ts` reads port from `process.env.PORT`
- [ ] API calls use `VITE_API_URL` environment variable
- [ ] Has centralized API configuration (not hardcoded URLs)
- [ ] `.env.example` documents required variables

### Backend
- [ ] `package.json` has `dev` and `start` scripts
- [ ] Server reads port from `process.env.PORT`
- [ ] Has `/api/health` endpoint for health checks
- [ ] CORS configured to allow Railway domains
- [ ] `.env.example` documents required variables

### Template Metadata
- [ ] `deployServices` includes `"railway"`
- [ ] Template has both `/frontend` and `/backend` directories

---

## Common Patterns

### Axios Configuration

```typescript
// src/lib/axios.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptors as needed
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

### React Query Setup

```typescript
// src/lib/query.ts
import { QueryClient } from '@tanstack/react-query';
import { API_URL } from './api';

export const queryClient = new QueryClient();

export const fetchApi = async (endpoint: string) => {
  const res = await fetch(`${API_URL}${endpoint}`);
  if (!res.ok) throw new Error('Network response was not ok');
  return res.json();
};
```

### WebSocket Configuration

```typescript
// src/lib/socket.ts
const getWsUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  if (import.meta.env.PROD) {
    // Convert https to wss
    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  return 'ws://localhost:3001';
};

export const WS_URL = getWsUrl();
```

---

## Troubleshooting

### "API not responding" locally
- Check that backend is running on the correct port
- Verify `VITE_API_URL` in frontend/.env matches backend port
- Restart the dev server (CodeDeck updates .env on start)

### CORS errors in production
- Ensure backend CORS config includes Railway domains
- Set `FRONTEND_URL` env var in Railway for backend service

### Build fails on Railway
- Check that `npm run build` works locally
- Verify all dependencies are in `dependencies` (not just `devDependencies`)
- Check Railway build logs for specific errors
