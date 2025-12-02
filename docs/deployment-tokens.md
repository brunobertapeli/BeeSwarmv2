# Deployment Tokens Usage

## Retrieving Tokens in Electron

```typescript
// Get token for a service
const result = await window.electronAPI?.deployment?.getToken('netlify')
// or
const result = await window.electronAPI?.deployment?.getToken('railway')

if (result?.success && result.token) {
  const token = result.token // decrypted token string
}
```

## Using with Netlify CLI

```typescript
import { spawn } from 'child_process'

const token = result.token
const projectPath = '/path/to/project'

// Option 1: Environment variable
const deploy = spawn('npx', ['netlify', 'deploy', '--prod'], {
  cwd: projectPath,
  env: { ...process.env, NETLIFY_AUTH_TOKEN: token }
})

// Option 2: Direct flag
const deploy = spawn('npx', ['netlify', 'deploy', '--prod', '--auth', token], {
  cwd: projectPath
})
```

## Using with Railway CLI

```typescript
import { spawn } from 'child_process'

const token = result.token
const projectPath = '/path/to/project'

// Railway uses RAILWAY_TOKEN env var
const deploy = spawn('railway', ['up'], {
  cwd: projectPath,
  env: { ...process.env, RAILWAY_TOKEN: token }
})
```

## Storage Location

Tokens stored encrypted at:
```
~/Library/Application Support/CodeDeck/deployment-tokens.json
```

## Available Methods

| Method | Description |
|--------|-------------|
| `saveToken(serviceId, token)` | Save encrypted token |
| `getToken(serviceId)` | Get decrypted token |
| `isConnected(serviceId)` | Check if token exists |
| `getConnectedServices()` | List all connected services |
| `disconnect(serviceId)` | Remove token |
