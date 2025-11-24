# Claude Authentication Flow for Desktop Apps

Complete guide for implementing Claude Code authentication in your Electron desktop application (similar to Cursor).

---

## Overview

This document describes how to implement a beautiful authentication flow for Claude Code in your desktop app, supporting both:
- **Subscription-based auth** (Pro/Max plans - no per-token charges)
- **API key auth** (Pay-per-token)

---

## Authentication Options

### Option 1: Subscription-Based (Pro/Max Plans)
- **Cost:** Fixed monthly ($17-$200/month)
- **Billing:** No per-token charges
- **Best for:** Regular users with existing Claude subscriptions
- **How it works:** OAuth flow via browser

### Option 2: API Key (Pay-per-token)
- **Cost:** $3 input / $15 output per 1M tokens (Sonnet 4.5)
- **Billing:** Per-token usage
- **Best for:** Light/occasional users
- **How it works:** Direct API key input

---

## The Complete Flow

### 1. User Selects Authentication Method
```
┌─────────────────────────────────────┐
│   Welcome to [Your App]!            │
│                                     │
│   To use Claude features, please    │
│   authenticate:                     │
│                                     │
│   ┌───────────────────────────┐    │
│   │  🔑 Use API Key           │    │
│   │  Pay per token            │    │
│   │  [$3-$15 per 1M tokens]   │    │
│   └───────────────────────────┘    │
│                                     │
│   ┌───────────────────────────┐    │
│   │  📱 Use Subscription      │    │
│   │  Pro/Max plan required    │    │
│   │  [Fixed monthly cost]     │    │
│   └───────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### 2. Subscription Flow (OAuth)
```
User clicks "Use Subscription"
         ↓
Your app runs: spawn('claude', ['setup-token'])
         ↓
Browser opens automatically
         ↓
User logs in at console.anthropic.com
         ↓
User approves connection
         ↓
OAuth token saved to ~/.claude/credentials.json
         ↓
Process exits with code 0 (success)
         ↓
Your app shows success message
         ↓
Continue with authenticated session
```

### 3. API Key Flow
```
User clicks "Use API Key"
         ↓
Your app shows input dialog
         ↓
User enters API key (sk-ant-api...)
         ↓
Your app tests connection
         ↓
If valid: save to environment/settings
         ↓
Continue with authenticated session
```

---

## Implementation

### File Structure
```
your-app/
├── main.js                    # Electron main process
├── renderer.js                # Electron renderer process
└── claude-auth-manager.js     # Authentication logic
```

### Complete ClaudeAuthManager Class

**File: `claude-auth-manager.js`**

```javascript
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

class ClaudeAuthManager {
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.credentialsFile = path.join(this.claudeDir, 'credentials.json');
    this.settingsFile = path.join(this.claudeDir, 'settings.json');
  }

  /**
   * Check if Claude Code CLI is installed
   * @returns {Promise<boolean>}
   */
  isInstalled() {
    return new Promise((resolve) => {
      const process = spawn('claude', ['--version']);
      
      process.on('error', () => resolve(false));
      process.on('close', (code) => resolve(code === 0));
    });
  }

  /**
   * Check if user is already authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return fs.existsSync(this.credentialsFile);
  }

  /**
   * Get current authentication method
   * @returns {string|null} 'subscription', 'api_key', 'unknown', or null
   */
  getAuthMethod() {
    if (!this.isAuthenticated()) return null;

    try {
      const creds = JSON.parse(fs.readFileSync(this.credentialsFile, 'utf8'));
      
      if (creds.oauth_token || creds.access_token) {
        return 'subscription';
      }
      if (creds.api_key) {
        return 'api_key';
      }
      return 'unknown';
    } catch (e) {
      return null;
    }
  }

  /**
   * Authenticate using subscription (OAuth flow)
   * This will open the browser for user to log in
   * @returns {Promise<Object>}
   */
  authenticateWithSubscription() {
    return new Promise((resolve, reject) => {
      console.log('Launching OAuth flow...');
      
      // Spawn the CLI command that triggers browser OAuth
      const process = spawn('claude', ['setup-token']);
      
      let output = '';
      let errorOutput = '';
      
      // Capture output (optional, for logging)
      process.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Claude CLI:', data.toString());
      });
      
      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Claude CLI error:', data.toString());
      });
      
      // Wait for process to complete
      process.on('close', (code) => {
        if (code === 0) {
          console.log('✓ Authentication successful!');
          resolve({
            success: true,
            method: 'subscription',
            output: output
          });
        } else {
          console.error('✗ Authentication failed');
          reject({
            success: false,
            error: errorOutput || 'User cancelled or authentication failed',
            code: code
          });
        }
      });
      
      // Handle errors (e.g., claude not installed)
      process.on('error', (error) => {
        reject({
          success: false,
          error: 'Claude Code CLI not found. Please install it first.',
          details: error.message
        });
      });
    });
  }

  /**
   * Authenticate using API key
   * @param {string} apiKey - The Anthropic API key
   * @returns {Promise<Object>}
   */
  authenticateWithApiKey(apiKey) {
    return new Promise((resolve, reject) => {
      // Validate API key format
      if (!apiKey.startsWith('sk-ant-')) {
        reject({
          success: false,
          error: 'Invalid API key format. Should start with sk-ant-'
        });
        return;
      }

      // Create .claude directory if it doesn't exist
      if (!fs.existsSync(this.claudeDir)) {
        fs.mkdirSync(this.claudeDir, { recursive: true });
      }

      // Write settings.json with API key
      const settings = { apiKey: apiKey };

      try {
        fs.writeFileSync(this.settingsFile, JSON.stringify(settings, null, 2));
        
        // Test the API key
        this.testConnection(apiKey)
          .then(() => resolve({ success: true, method: 'api_key' }))
          .catch((error) => reject({ success: false, error: error.message }));
      } catch (error) {
        reject({ success: false, error: error.message });
      }
    });
  }

  /**
   * Test if connection works
   * @param {string} apiKey - Optional API key to test
   * @returns {Promise<void>}
   */
  testConnection(apiKey = null) {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (apiKey) {
        env.ANTHROPIC_API_KEY = apiKey;
      }

      const testProcess = spawn('claude', ['--version'], { env });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Connection test failed'));
        }
      });

      testProcess.on('error', () => {
        reject(new Error('Claude CLI not accessible'));
      });
    });
  }

  /**
   * Clear all authentication data
   * @returns {boolean}
   */
  clearAuth() {
    try {
      if (fs.existsSync(this.credentialsFile)) {
        fs.unlinkSync(this.credentialsFile);
      }
      if (fs.existsSync(this.settingsFile)) {
        fs.unlinkSync(this.settingsFile);
      }
      return true;
    } catch (e) {
      console.error('Error clearing auth:', e);
      return false;
    }
  }

  /**
   * Get authentication status
   * @returns {Promise<Object>}
   */
  async getStatus() {
    return {
      installed: await this.isInstalled(),
      authenticated: this.isAuthenticated(),
      method: this.getAuthMethod()
    };
  }
}

module.exports = ClaudeAuthManager;
```

---

## Electron Main Process Integration

**File: `main.js`**

```javascript
const { app, ipcMain, BrowserWindow } = require('electron');
const ClaudeAuthManager = require('./claude-auth-manager');

const authManager = new ClaudeAuthManager();

// Handle subscription authentication request
ipcMain.handle('claude-auth-subscription', async () => {
  try {
    const result = await authManager.authenticateWithSubscription();
    return result;
  } catch (error) {
    throw error;
  }
});

// Handle API key authentication request
ipcMain.handle('claude-auth-apikey', async (event, apiKey) => {
  try {
    const result = await authManager.authenticateWithApiKey(apiKey);
    return result;
  } catch (error) {
    throw error;
  }
});

// Check auth status
ipcMain.handle('claude-auth-status', async () => {
  return await authManager.getStatus();
});

// Clear authentication
ipcMain.handle('claude-auth-clear', async () => {
  return authManager.clearAuth();
});

// Test connection
ipcMain.handle('claude-auth-test', async (event, apiKey = null) => {
  try {
    await authManager.testConnection(apiKey);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(() => {
  // Your app initialization
  createWindow();
});
```

---

## Electron Renderer Process (UI)

**File: `renderer.js`**

```javascript
const { ipcRenderer } = require('electron');

// Main authentication handler
async function handleAuthSelection() {
  // Check if already authenticated
  const status = await ipcRenderer.invoke('claude-auth-status');
  
  if (status.authenticated) {
    showInfo(`Already authenticated via ${status.method}`);
    proceedToMainInterface();
    return;
  }
  
  // Show auth choice dialog
  const choice = await showAuthDialog();
  
  if (choice === 'subscription') {
    await handleSubscriptionAuth();
  } else if (choice === 'api_key') {
    await handleApiKeyAuth();
  }
}

// Handle subscription authentication
async function handleSubscriptionAuth() {
  // Show loading dialog
  showLoadingDialog({
    title: 'Authenticating...',
    message: 'Opening browser for login.\nPlease authorize the connection in your browser.'
  });
  
  try {
    // Call main process to trigger OAuth
    const result = await ipcRenderer.invoke('claude-auth-subscription');
    
    if (result.success) {
      closeLoadingDialog();
      showSuccessDialog({
        title: '✓ Connected!',
        message: 'You\'re now authenticated with your Max subscription.\n\nNo per-token charges apply!'
      });
      
      // Continue with your app flow
      proceedToMainInterface();
    }
  } catch (error) {
    closeLoadingDialog();
    showErrorDialog({
      title: 'Authentication Failed',
      message: error.error || 'Authentication was cancelled or failed.\n\nPlease try again or use API key instead.',
      buttons: ['Retry', 'Use API Key', 'Cancel']
    });
  }
}

// Handle API key authentication
async function handleApiKeyAuth() {
  const apiKey = await showApiKeyInputDialog({
    title: 'Enter API Key',
    placeholder: 'sk-ant-api...',
    helpText: 'Get your API key from console.anthropic.com/settings/keys'
  });
  
  if (!apiKey) return; // User cancelled
  
  showLoadingDialog({
    title: 'Testing connection...',
    message: 'Verifying your API key'
  });
  
  try {
    const result = await ipcRenderer.invoke('claude-auth-apikey', apiKey);
    
    if (result.success) {
      closeLoadingDialog();
      showSuccessDialog({
        title: '✓ Connected!',
        message: 'Your API key is valid.\n\nYou\'ll be charged per token:\n• Input: $3 per 1M tokens\n• Output: $15 per 1M tokens'
      });
      
      proceedToMainInterface();
    }
  } catch (error) {
    closeLoadingDialog();
    showErrorDialog({
      title: 'Invalid API Key',
      message: 'The API key you entered is invalid.\n\nPlease check and try again.',
      buttons: ['Retry', 'Cancel']
    });
  }
}

// Check auth status on startup
async function checkAuthOnStartup() {
  const status = await ipcRenderer.invoke('claude-auth-status');
  
  if (!status.installed) {
    showErrorDialog({
      title: 'Claude Code Not Installed',
      message: 'Please install Claude Code CLI:\n\nnpm install -g @anthropic-ai/claude-code',
      buttons: ['Exit']
    });
    return;
  }
  
  if (status.authenticated) {
    console.log(`Authenticated via ${status.method}`);
    proceedToMainInterface();
  } else {
    handleAuthSelection();
  }
}

// Run on page load
window.addEventListener('DOMContentLoaded', () => {
  checkAuthOnStartup();
});
```

---

## UI Dialog Examples

### Auth Selection Dialog
```javascript
function showAuthDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'auth-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h2>Authenticate with Claude</h2>
        <p>Choose your authentication method:</p>
        
        <button class="auth-option subscription" data-choice="subscription">
          <span class="icon">📱</span>
          <div class="text">
            <strong>Use Subscription</strong>
            <small>Pro/Max plan required - Fixed monthly cost</small>
          </div>
        </button>
        
        <button class="auth-option api-key" data-choice="api_key">
          <span class="icon">🔑</span>
          <div class="text">
            <strong>Use API Key</strong>
            <small>Pay per token - $3-$15 per 1M tokens</small>
          </div>
        </button>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    dialog.querySelectorAll('.auth-option').forEach(button => {
      button.addEventListener('click', () => {
        const choice = button.dataset.choice;
        document.body.removeChild(dialog);
        resolve(choice);
      });
    });
  });
}
```

### API Key Input Dialog
```javascript
function showApiKeyInputDialog(options) {
  return new Promise((resolve) => {
    const dialog = document.createElement('div');
    dialog.className = 'input-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h2>${options.title}</h2>
        <p>${options.helpText}</p>
        
        <input 
          type="password" 
          class="api-key-input" 
          placeholder="${options.placeholder}"
          autocomplete="off"
        />
        
        <div class="dialog-buttons">
          <button class="btn-cancel">Cancel</button>
          <button class="btn-submit">Connect</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    
    const input = dialog.querySelector('.api-key-input');
    const submitBtn = dialog.querySelector('.btn-submit');
    const cancelBtn = dialog.querySelector('.btn-cancel');
    
    submitBtn.addEventListener('click', () => {
      const apiKey = input.value.trim();
      document.body.removeChild(dialog);
      resolve(apiKey);
    });
    
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
      resolve(null);
    });
    
    input.focus();
  });
}
```

---

## Behind the Scenes: OAuth Flow

When `claude setup-token` is executed:

1. **CLI starts local server** on `http://localhost:PORT`
2. **Opens default browser** to Anthropic's OAuth page
3. **User logs in** with claude.ai credentials
4. **User approves** the connection
5. **Anthropic redirects** to `http://localhost:PORT/callback?code=...`
6. **CLI exchanges code** for OAuth access token
7. **Token saved** to `~/.claude/credentials.json`
8. **Process exits** with code 0 (success)

---

## File Locations

### macOS/Linux
```
~/.claude/
├── credentials.json    # OAuth tokens or API key
├── settings.json       # User settings
└── session.json        # Current session data
```

### Windows
```
C:\Users\<username>\.claude\
├── credentials.json
├── settings.json
└── session.json
```

---

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOENT: claude not found` | Claude CLI not installed | Install: `npm install -g @anthropic-ai/claude-code` |
| Exit code 1 | User cancelled OAuth | Show retry option |
| Invalid API key | Wrong format or revoked | Validate format: `sk-ant-api...` |
| Connection timeout | Network issues | Check internet connection |
| Permission denied | Can't write to `~/.claude/` | Check file permissions |

---

## Testing

### Test Subscription Auth
```javascript
async function testSubscriptionAuth() {
  const authManager = new ClaudeAuthManager();
  
  console.log('Starting OAuth flow...');
  console.log('Browser should open shortly...');
  
  try {
    const result = await authManager.authenticateWithSubscription();
    console.log('✓ SUCCESS!', result);
  } catch (error) {
    console.error('✗ FAILED!', error);
  }
}

testSubscriptionAuth();
```

### Test API Key Auth
```javascript
async function testApiKeyAuth() {
  const authManager = new ClaudeAuthManager();
  const testKey = 'sk-ant-api-test-key';
  
  console.log('Testing API key...');
  
  try {
    const result = await authManager.authenticateWithApiKey(testKey);
    console.log('✓ SUCCESS!', result);
  } catch (error) {
    console.error('✗ FAILED!', error);
  }
}

testApiKeyAuth();
```

---

## Session Usage Tracking

After authentication, track usage per session:

```javascript
const sessionStats = {
  totalInput: 0,
  totalOutput: 0,
  totalCacheRead: 0,
  totalCacheWrite: 0,
  totalCost: 0.0,
  turns: 0,
  currentContext: 0
};

function updateSessionStats(resultMessage) {
  const usage = resultMessage.usage || {};
  
  // Accumulate across turns
  sessionStats.totalInput += usage.input_tokens || 0;
  sessionStats.totalOutput += usage.output_tokens || 0;
  sessionStats.totalCacheRead += usage.cache_read_input_tokens || 0;
  sessionStats.totalCacheWrite += usage.cache_creation_input_tokens || 0;
  
  // Latest values (already cumulative)
  sessionStats.totalCost = resultMessage.total_cost_usd || 0;
  sessionStats.turns = resultMessage.num_turns || 0;
  
  // Current context
  sessionStats.currentContext = (
    (usage.system_prompt_tokens || 0) +
    (usage.system_tools_tokens || 0) +
    (usage.memory_tokens || 0) +
    (usage.input_tokens || 0)
  );
  
  displayStats();
}

function displayStats() {
  const contextPct = (sessionStats.currentContext / 200000 * 100).toFixed(1);
  
  console.log(`
╔══════════════════════════════════════╗
║        SESSION STATISTICS            ║
╠══════════════════════════════════════╣
║ Context: ${sessionStats.currentContext.toLocaleString()} / 200,000 (${contextPct}%) ║
╠══════════════════════════════════════╣
║ Token Usage:                         ║
║   Input:    ${sessionStats.totalInput.toLocaleString().padStart(10)} tokens   ║
║   Output:   ${sessionStats.totalOutput.toLocaleString().padStart(10)} tokens   ║
║   Cached:   ${sessionStats.totalCacheRead.toLocaleString().padStart(10)} tokens ✓ ║
╠══════════════════════════════════════╣
║ Turns:      ${sessionStats.turns.toString().padStart(10)}           ║
║ Total Cost: $${sessionStats.totalCost.toFixed(3).padStart(9)}        ║
╚══════════════════════════════════════╝
  `);
}
```

---

## Security Considerations

### DO:
- ✅ Store API keys encrypted in your app's settings
- ✅ Never log or display full API keys
- ✅ Use environment variables when possible
- ✅ Clear credentials when user logs out
- ✅ Validate API key format before testing

### DON'T:
- ❌ Store API keys in plain text
- ❌ Commit credentials to version control
- ❌ Share credentials between users
- ❌ Log sensitive authentication data
- ❌ Display full tokens in UI

---

## FAQ

### Q: Can users switch between auth methods?
**A:** Yes, call `clearAuth()` then run authentication flow again.

### Q: Does this work offline?
**A:** No, authentication requires internet connection. Once authenticated, the credentials are cached.

### Q: What if user has both Pro and API key?
**A:** User can choose. Subscription = no per-token charges. API key = pay-per-token.

### Q: Can I use this in production?
**A:** Yes! This is the official authentication method for Claude Code.

### Q: Is the OAuth flow secure?
**A:** Yes, it's Anthropic's official OAuth implementation with localhost callback.

---

## Summary

**For Subscription Users:**
1. Click "Use Subscription"
2. Browser opens → log in
3. Approve connection
4. Done! No per-token charges

**For API Key Users:**
1. Click "Use API Key"
2. Enter key from console.anthropic.com
3. Test connection
4. Done! Pay per token used

**Your app handles:**
- ✅ Beautiful UI for both flows
- ✅ Status checking and validation
- ✅ Error handling and retry logic
- ✅ Session usage tracking

**Anthropic handles:**
- ✅ OAuth security
- ✅ Token management
- ✅ Billing (subscription or API)

---

## Resources

- **Claude Code Installation:** `npm install -g @anthropic-ai/claude-code`
- **API Keys:** https://console.anthropic.com/settings/keys
- **Pricing:** https://www.anthropic.com/pricing
- **Documentation:** https://docs.claude.com/en/api/agent-sdk/overview
- **Support:** https://support.anthropic.com

---

**Last Updated:** November 2025  
**Claude Agent SDK Version:** Latest  
**Compatible with:** Electron, Node.js 18+