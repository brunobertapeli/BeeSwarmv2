# Railway Deploy Service Implementation

This document outlines the implementation plan for automating Railway deployments from CodeDeck.

---

## Overview

The RailwayDeployService will handle:
1. OAuth authentication with Railway
2. Project creation on Railway
3. Backend deployment
4. Frontend deployment with backend URL injection
5. Deployment status monitoring

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User clicks "Deploy to Railway"               │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     1. Check Railway Auth                        │
│                                                                  │
│   - If no token → Start OAuth flow                              │
│   - If token exists → Validate token                            │
│   - If token expired → Refresh token                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. Create Railway Project                      │
│                                                                  │
│   POST projectCreate                                            │
│   Returns: projectId                                            │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. Deploy Backend Service                      │
│                                                                  │
│   a. Create service (name: "backend")                           │
│   b. Create environment: production                              │
│   c. Upload code from /backend directory                        │
│   d. Set env vars: PORT (auto), DATABASE_URL, etc.             │
│   e. Trigger deployment                                         │
│   f. Wait for deployment to complete                            │
│   g. Get public URL → backendUrl                                │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  4. Deploy Frontend Service                      │
│                                                                  │
│   a. Create service (name: "frontend")                          │
│   b. Create environment: production                              │
│   c. Upload code from /frontend directory                       │
│   d. Set env vars: VITE_API_URL = backendUrl                   │
│   e. Trigger deployment                                         │
│   f. Wait for deployment to complete                            │
│   g. Get public URL → frontendUrl                               │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     5. Return Results                            │
│                                                                  │
│   {                                                              │
│     projectId: "...",                                           │
│     backendUrl: "https://backend-xxx.up.railway.app",          │
│     frontendUrl: "https://frontend-xxx.up.railway.app",        │
│     dashboardUrl: "https://railway.app/project/xxx"            │
│   }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Railway API Reference

### Base URL
```
https://backboard.railway.app/graphql/v2
```

### Authentication Header
```
Authorization: Bearer {access_token}
```

---

## GraphQL Operations

### 1. Create Project

```graphql
mutation ProjectCreate($input: ProjectCreateInput!) {
  projectCreate(input: $input) {
    id
    name
    createdAt
    environments {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}

# Variables
{
  "input": {
    "name": "my-app",
    "description": "Deployed from CodeDeck",
    "isPublic": false
  }
}
```

### 2. Create Service

```graphql
mutation ServiceCreate($input: ServiceCreateInput!) {
  serviceCreate(input: $input) {
    id
    name
  }
}

# Variables
{
  "input": {
    "projectId": "xxx",
    "name": "backend"
  }
}
```

### 3. Create Service Domain (Public URL)

```graphql
mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
  serviceDomainCreate(input: $input) {
    id
    domain
  }
}

# Variables
{
  "input": {
    "serviceId": "xxx",
    "environmentId": "yyy"
  }
}
```

### 4. Set Environment Variable

```graphql
mutation VariableUpsert($input: VariableUpsertInput!) {
  variableUpsert(input: $input)
}

# Variables
{
  "input": {
    "projectId": "xxx",
    "serviceId": "yyy",
    "environmentId": "zzz",
    "name": "VITE_API_URL",
    "value": "https://backend-xxx.up.railway.app"
  }
}
```

### 5. Get Deployment Status

```graphql
query Deployment($id: String!) {
  deployment(id: $id) {
    id
    status
    staticUrl
    createdAt
  }
}
```

### 6. Get Service Deployments

```graphql
query Service($id: String!) {
  service(id: $id) {
    id
    name
    deployments {
      edges {
        node {
          id
          status
          staticUrl
        }
      }
    }
  }
}
```

---

## Service Implementation

### File: `electron/services/RailwayDeployService.ts`

```typescript
import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import tar from 'tar';

interface RailwayTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface DeploymentResult {
  projectId: string;
  projectUrl: string;
  backendUrl: string;
  frontendUrl: string;
}

interface DeploymentProgress {
  stage: 'auth' | 'project' | 'backend' | 'frontend' | 'complete';
  status: string;
  progress?: number;
}

class RailwayDeployService {
  private readonly API_URL = 'https://backboard.railway.app/graphql/v2';
  private readonly OAUTH_URL = 'https://railway.app/oauth/authorize';
  private readonly TOKEN_URL = 'https://railway.app/oauth/token';

  // These would come from your Railway OAuth app registration
  private readonly CLIENT_ID = process.env.RAILWAY_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.RAILWAY_CLIENT_SECRET;
  private readonly REDIRECT_URI = 'codedeck://railway/callback';

  private tokens: RailwayTokens | null = null;
  private progressCallback?: (progress: DeploymentProgress) => void;

  // ─────────────────────────────────────────────────────────────
  // OAuth Authentication
  // ─────────────────────────────────────────────────────────────

  async authenticate(): Promise<boolean> {
    // Check if we have valid tokens
    if (this.tokens && this.tokens.expiresAt > Date.now()) {
      return true;
    }

    // Try to load tokens from secure storage
    this.tokens = await this.loadTokens();
    if (this.tokens && this.tokens.expiresAt > Date.now()) {
      return true;
    }

    // Need to authenticate
    return this.startOAuthFlow();
  }

  private async startOAuthFlow(): Promise<boolean> {
    return new Promise((resolve) => {
      const authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const authUrl = `${this.OAUTH_URL}?` + new URLSearchParams({
        client_id: this.CLIENT_ID!,
        redirect_uri: this.REDIRECT_URI,
        response_type: 'code',
        scope: 'project:create project:read deployment:create deployment:read',
      });

      authWindow.loadURL(authUrl);

      // Handle the callback
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith(this.REDIRECT_URI)) {
          event.preventDefault();

          const urlParams = new URL(url).searchParams;
          const code = urlParams.get('code');

          if (code) {
            const success = await this.exchangeCodeForTokens(code);
            authWindow.close();
            resolve(success);
          } else {
            authWindow.close();
            resolve(false);
          }
        }
      });

      authWindow.on('closed', () => {
        resolve(false);
      });
    });
  }

  private async exchangeCodeForTokens(code: string): Promise<boolean> {
    try {
      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          code,
          redirect_uri: this.REDIRECT_URI,
        }),
      });

      const data = await response.json();

      this.tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in * 1000),
      };

      await this.saveTokens(this.tokens);
      return true;
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // GraphQL Client
  // ─────────────────────────────────────────────────────────────

  private async graphql<T>(query: string, variables?: Record<string, any>): Promise<T> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.tokens.accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data;
  }

  // ─────────────────────────────────────────────────────────────
  // Deployment Methods
  // ─────────────────────────────────────────────────────────────

  async deployProject(
    projectPath: string,
    projectName: string,
    onProgress?: (progress: DeploymentProgress) => void
  ): Promise<DeploymentResult> {
    this.progressCallback = onProgress;

    // Step 1: Authenticate
    this.emitProgress('auth', 'Authenticating with Railway...');
    const authenticated = await this.authenticate();
    if (!authenticated) {
      throw new Error('Failed to authenticate with Railway');
    }

    // Step 2: Create project
    this.emitProgress('project', 'Creating Railway project...');
    const projectId = await this.createProject(projectName);

    // Step 3: Get production environment ID
    const environmentId = await this.getProductionEnvironmentId(projectId);

    // Step 4: Deploy backend
    this.emitProgress('backend', 'Deploying backend service...');
    const backendUrl = await this.deployService(
      projectId,
      environmentId,
      'backend',
      path.join(projectPath, 'backend'),
      { /* backend env vars if needed */ }
    );

    // Step 5: Deploy frontend with backend URL
    this.emitProgress('frontend', 'Deploying frontend service...');
    const frontendUrl = await this.deployService(
      projectId,
      environmentId,
      'frontend',
      path.join(projectPath, 'frontend'),
      { VITE_API_URL: backendUrl }
    );

    // Step 6: Update backend CORS with frontend URL
    await this.updateServiceVariable(
      projectId,
      environmentId,
      'backend',
      'FRONTEND_URL',
      frontendUrl
    );

    this.emitProgress('complete', 'Deployment complete!');

    return {
      projectId,
      projectUrl: `https://railway.app/project/${projectId}`,
      backendUrl,
      frontendUrl,
    };
  }

  private async createProject(name: string): Promise<string> {
    const result = await this.graphql<{ projectCreate: { id: string } }>(`
      mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          id
        }
      }
    `, {
      input: {
        name,
        description: 'Deployed from CodeDeck',
      },
    });

    return result.projectCreate.id;
  }

  private async getProductionEnvironmentId(projectId: string): Promise<string> {
    const result = await this.graphql<{
      project: {
        environments: {
          edges: Array<{ node: { id: string; name: string } }>
        }
      }
    }>(`
      query Project($id: String!) {
        project(id: $id) {
          environments {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `, { id: projectId });

    const prodEnv = result.project.environments.edges.find(
      (e) => e.node.name === 'production'
    );

    return prodEnv?.node.id || result.project.environments.edges[0].node.id;
  }

  private async deployService(
    projectId: string,
    environmentId: string,
    serviceName: string,
    sourcePath: string,
    envVars: Record<string, string>
  ): Promise<string> {
    // 1. Create service
    const serviceId = await this.createService(projectId, serviceName);

    // 2. Set environment variables
    for (const [name, value] of Object.entries(envVars)) {
      await this.setVariable(projectId, serviceId, environmentId, name, value);
    }

    // 3. Upload code and trigger deployment
    const deploymentId = await this.uploadAndDeploy(serviceId, environmentId, sourcePath);

    // 4. Wait for deployment to complete
    await this.waitForDeployment(deploymentId);

    // 5. Create public domain and get URL
    const url = await this.createDomainAndGetUrl(serviceId, environmentId);

    return url;
  }

  private async createService(projectId: string, name: string): Promise<string> {
    const result = await this.graphql<{ serviceCreate: { id: string } }>(`
      mutation ServiceCreate($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
          id
        }
      }
    `, {
      input: { projectId, name },
    });

    return result.serviceCreate.id;
  }

  private async setVariable(
    projectId: string,
    serviceId: string,
    environmentId: string,
    name: string,
    value: string
  ): Promise<void> {
    await this.graphql(`
      mutation VariableUpsert($input: VariableUpsertInput!) {
        variableUpsert(input: $input)
      }
    `, {
      input: { projectId, serviceId, environmentId, name, value },
    });
  }

  private async uploadAndDeploy(
    serviceId: string,
    environmentId: string,
    sourcePath: string
  ): Promise<string> {
    // Create tarball of the source
    const tarballPath = await this.createTarball(sourcePath);

    // Upload to Railway (this might need their specific upload endpoint)
    // Railway uses a presigned URL flow for uploads

    // This is a simplified version - actual implementation may vary
    // based on Railway's upload API

    const result = await this.graphql<{
      deploymentCreate: { id: string }
    }>(`
      mutation DeploymentCreate($input: DeploymentCreateInput!) {
        deploymentCreate(input: $input) {
          id
        }
      }
    `, {
      input: {
        serviceId,
        environmentId,
        // source configuration
      },
    });

    // Clean up tarball
    fs.unlinkSync(tarballPath);

    return result.deploymentCreate.id;
  }

  private async createTarball(sourcePath: string): Promise<string> {
    const tarballPath = path.join(os.tmpdir(), `railway-deploy-${Date.now()}.tar.gz`);

    await tar.create(
      {
        gzip: true,
        file: tarballPath,
        cwd: sourcePath,
      },
      ['.']
    );

    return tarballPath;
  }

  private async waitForDeployment(deploymentId: string): Promise<void> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.graphql<{
        deployment: { status: string; staticUrl: string }
      }>(`
        query Deployment($id: String!) {
          deployment(id: $id) {
            status
            staticUrl
          }
        }
      `, { id: deploymentId });

      const status = result.deployment.status;

      if (status === 'SUCCESS') {
        return;
      }

      if (status === 'FAILED' || status === 'CRASHED') {
        throw new Error(`Deployment failed with status: ${status}`);
      }

      // Update progress
      this.emitProgress(
        this.progressCallback ? 'backend' : 'frontend',
        `Deployment status: ${status}`,
        Math.round((attempts / maxAttempts) * 100)
      );

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Deployment timed out');
  }

  private async createDomainAndGetUrl(
    serviceId: string,
    environmentId: string
  ): Promise<string> {
    const result = await this.graphql<{
      serviceDomainCreate: { domain: string }
    }>(`
      mutation ServiceDomainCreate($input: ServiceDomainCreateInput!) {
        serviceDomainCreate(input: $input) {
          domain
        }
      }
    `, {
      input: { serviceId, environmentId },
    });

    return `https://${result.serviceDomainCreate.domain}`;
  }

  // ─────────────────────────────────────────────────────────────
  // Helper Methods
  // ─────────────────────────────────────────────────────────────

  private emitProgress(
    stage: DeploymentProgress['stage'],
    status: string,
    progress?: number
  ): void {
    if (this.progressCallback) {
      this.progressCallback({ stage, status, progress });
    }
  }

  private async loadTokens(): Promise<RailwayTokens | null> {
    // Load from secure storage (keychain on macOS, credential manager on Windows)
    // Implementation depends on your secure storage solution
    return null;
  }

  private async saveTokens(tokens: RailwayTokens): Promise<void> {
    // Save to secure storage
  }

  // ─────────────────────────────────────────────────────────────
  // Public Utility Methods
  // ─────────────────────────────────────────────────────────────

  async isAuthenticated(): Promise<boolean> {
    if (!this.tokens) {
      this.tokens = await this.loadTokens();
    }
    return this.tokens !== null && this.tokens.expiresAt > Date.now();
  }

  async logout(): Promise<void> {
    this.tokens = null;
    // Clear from secure storage
  }

  async getProjects(): Promise<Array<{ id: string; name: string }>> {
    const result = await this.graphql<{
      me: {
        projects: {
          edges: Array<{ node: { id: string; name: string } }>
        }
      }
    }>(`
      query Me {
        me {
          projects {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      }
    `);

    return result.me.projects.edges.map((e) => e.node);
  }
}

export const railwayDeployService = new RailwayDeployService();
```

---

## IPC Handlers

### File: `electron/handlers/railwayHandlers.ts`

```typescript
import { ipcMain } from 'electron';
import { railwayDeployService } from '../services/RailwayDeployService';
import { databaseService } from '../services/DatabaseService';

export function registerRailwayHandlers(): void {
  // Check if authenticated
  ipcMain.handle('railway:is-authenticated', async () => {
    return railwayDeployService.isAuthenticated();
  });

  // Start authentication
  ipcMain.handle('railway:authenticate', async () => {
    return railwayDeployService.authenticate();
  });

  // Deploy project
  ipcMain.handle('railway:deploy', async (event, projectId: string) => {
    const project = databaseService.getProjectById(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    try {
      const result = await railwayDeployService.deployProject(
        project.path,
        project.name,
        (progress) => {
          // Send progress to renderer
          event.sender.send('railway:deploy-progress', progress);
        }
      );

      // Save deployment info to database
      databaseService.updateProjectDeployment(projectId, {
        railwayProjectId: result.projectId,
        backendUrl: result.backendUrl,
        frontendUrl: result.frontendUrl,
        deployedAt: new Date().toISOString(),
      });

      return { success: true, ...result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
      };
    }
  });

  // Logout
  ipcMain.handle('railway:logout', async () => {
    await railwayDeployService.logout();
    return { success: true };
  });
}
```

---

## Frontend Integration

### React Hook: `useRailwayDeploy.ts`

```typescript
import { useState, useCallback, useEffect } from 'react';

interface DeploymentProgress {
  stage: 'auth' | 'project' | 'backend' | 'frontend' | 'complete';
  status: string;
  progress?: number;
}

interface DeploymentResult {
  projectId: string;
  projectUrl: string;
  backendUrl: string;
  frontendUrl: string;
}

export function useRailwayDeploy() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState<DeploymentProgress | null>(null);
  const [result, setResult] = useState<DeploymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication status
    window.electronAPI.railway.isAuthenticated().then(setIsAuthenticated);

    // Listen for progress updates
    const unsubscribe = window.electronAPI.railway.onDeployProgress(setProgress);
    return unsubscribe;
  }, []);

  const authenticate = useCallback(async () => {
    const success = await window.electronAPI.railway.authenticate();
    setIsAuthenticated(success);
    return success;
  }, []);

  const deploy = useCallback(async (projectId: string) => {
    setIsDeploying(true);
    setProgress(null);
    setResult(null);
    setError(null);

    try {
      const response = await window.electronAPI.railway.deploy(projectId);

      if (response.success) {
        setResult(response);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeploying(false);
    }
  }, []);

  return {
    isAuthenticated,
    isDeploying,
    progress,
    result,
    error,
    authenticate,
    deploy,
  };
}
```

---

## Database Schema Updates

Add deployment info to projects table:

```sql
ALTER TABLE projects ADD COLUMN railwayProjectId TEXT;
ALTER TABLE projects ADD COLUMN railwayBackendUrl TEXT;
ALTER TABLE projects ADD COLUMN railwayFrontendUrl TEXT;
ALTER TABLE projects ADD COLUMN deployedAt TEXT;
```

---

## Environment Variables Required

Add to your `.env` or environment configuration:

```env
# Railway OAuth App credentials (register at railway.app)
RAILWAY_CLIENT_ID=your_client_id
RAILWAY_CLIENT_SECRET=your_client_secret
```

---

## Security Considerations

1. **Token Storage**: Store Railway tokens in the system keychain (macOS) or Windows Credential Manager, not in plain text
2. **Token Refresh**: Implement token refresh before expiry
3. **Scope Limits**: Only request necessary OAuth scopes
4. **Error Handling**: Don't expose sensitive error details to users

---

## Future Enhancements

1. **Re-deploy**: Update existing deployment instead of creating new
2. **Rollback**: Support rolling back to previous deployment
3. **Logs**: Stream deployment logs to CodeDeck terminal
4. **Custom Domains**: Allow users to set custom domains
5. **Environment Variables UI**: Let users add/edit env vars before deploy
6. **Multiple Environments**: Support staging/production environments
