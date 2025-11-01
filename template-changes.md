# Template Configuration Changes for Multi-Project Support

BeeSwarm now automatically allocates unique ports for each project to support running multiple projects simultaneously. Templates must be configured to use the ports that BeeSwarm assigns.

## Changes Required

### 1. frontend/vite.config.ts

The Vite port configuration will be automatically updated by BeeSwarm after cloning. You can use any of these formats:

**Option A: Static port (recommended for templates)**
```typescript
export default defineConfig({
  server: {
    port: 5174,
    strictPort: false,
    // ... other config
  }
})
```

**Option B: Environment variable**
```typescript
export default defineConfig({
  server: {
    port: parseInt(process.env.VITE_PORT || '5174'),
    strictPort: false,
    // ... other config
  }
})
```

BeeSwarm will automatically replace the port number with the allocated port (5174, 5175, 5176, etc.) after cloning.

### 2. netlify.toml

The `targetPort` must match the Vite port. BeeSwarm will automatically update this after cloning:

```toml
[dev]
  command = "cd frontend && npm run dev"
  targetPort = 5174
  port = 8888
  autoLaunch = false
```

BeeSwarm will replace the `targetPort` value with the allocated Vite port.

## How It Works

1. **Project Creation**: When a user creates a new project, BeeSwarm:
   - Allocates a unique Netlify port (8888, 8889, 8890, etc.)
   - Calculates the corresponding Vite port (5174, 5175, 5176, etc.)
   - Clones the template
   - Automatically updates `vite.config.ts` with the allocated Vite port
   - Automatically updates `netlify.toml` with the same Vite port

2. **Port Mapping**: Ports are paired to avoid conflicts:
   - Netlify 8888 → Vite 5174
   - Netlify 8889 → Vite 5175
   - Netlify 8890 → Vite 5176
   - ... and so on

3. **Multiple Projects**: Each project gets its own port pair, allowing users to run multiple dev servers simultaneously without conflicts.

## What You Need to Do

1. Ensure your template has `frontend/vite.config.ts` with a `port` configuration
2. Ensure your template has `netlify.toml` with a `targetPort` configuration
3. Use port `5174` as the base port (this is the default starting port)
4. Set `strictPort: false` in Vite config to allow fallback if needed

BeeSwarm handles everything else automatically!

## Testing

To verify your template works correctly:

1. Create a project using your template in BeeSwarm
2. Create a second project using the same template
3. Both should start successfully on different ports
4. Switch between projects - each should display correctly

## Example Template Files

See the current template structure at: `template-structure.md`
