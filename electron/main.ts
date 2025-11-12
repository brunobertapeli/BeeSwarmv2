// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config()

// Now import everything else
import { app, BrowserWindow, Menu, shell, ipcMain, globalShortcut } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { registerAuthHandlers } from './handlers/authHandlers.js'
import { registerTemplateHandlers } from './handlers/templateHandlers.js'
import { registerProjectHandlers } from './handlers/projectHandlers.js'
import { registerProcessHandlers, setProcessHandlersWindow } from './handlers/processHandlers.js'
import { registerPreviewHandlers, setPreviewHandlersWindow } from './handlers/previewHandlers.js'
import { registerLayoutHandlers, setLayoutHandlersWindow } from './handlers/layoutHandlers.js'
import { registerShellHandlers } from './handlers/shellHandlers.js'
import { registerTerminalHandlers, setTerminalHandlersWindow } from './handlers/terminalHandlers.js'
import { registerClaudeHandlers, setClaudeHandlersWindow } from './handlers/claudeHandlers.js'
import { registerChatHandlers, setChatHandlersWindow } from './handlers/chatHandlers.js'
import { registerSupportHandlers } from './handlers/supportHandlers.js'
import { registerGitHandlers, setGitHandlersWindow } from './handlers/gitHandlers.js'
import { registerSecureStorageHandlers } from './handlers/secureStorageHandlers.js'
import { registerWebsiteImportHandlers} from './handlers/websiteImportHandlers.js'
import { registerClaudeMdHandlers } from './handlers/claudeMdHandlers.js'
import { registerImageHandlers } from './handlers/imageHandlers.js'
import { databaseService } from './services/DatabaseService.js'
import { layoutManager } from './services/LayoutManager.js'
import { mongoService } from './services/MongoService.js'

// Global state for current user
let currentUserId: string | null = null

/**
 * Set current user and reinitialize user-scoped services
 */
export function setCurrentUser(userId: string) {
  currentUserId = userId

  // Reinitialize database for this user
  databaseService.init(userId)

  try {
    // Ensure user data directory structure exists
    const userDataDir = path.join(app.getPath('home'), 'Documents', 'CodeDeck', userId)
    const userLogsDir = path.join(userDataDir, 'Logs')
    const userProjectsDir = path.join(userDataDir, 'Projects')

    // Create directories if they don't exist
    if (!fs.existsSync(userLogsDir)) {
      fs.mkdirSync(userLogsDir, { recursive: true })
    }
    if (!fs.existsSync(userProjectsDir)) {
      fs.mkdirSync(userProjectsDir, { recursive: true })
    }

  } catch (error) {
    console.error('❌ Error setting up user directories:', error)
  }
}

/**
 * Get current user ID
 */
export function getCurrentUserId(): string | null {
  return currentUserId
}

/**
 * Clear current user (on logout)
 */
export function clearCurrentUser() {
  currentUserId = null
}
import { previewService } from './services/PreviewService.js'
import { processManager } from './services/ProcessManager.js'
import { processPersistence } from './services/ProcessPersistence.js'
import { terminalService } from './services/TerminalService.js'
import { claudeService } from './services/ClaudeService.js'
import { chatHistoryManager } from './services/ChatHistoryManager.js'
import { projectLockService } from './services/ProjectLockService.js'
import { keywordService } from './services/KeywordService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Debug: Log if environment variables are loaded
const isDev = process.env.NODE_ENV !== 'production'

// Suppress Electron security warnings in development (we need unsafe-eval for Vite HMR)
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}



let mainWindow: BrowserWindow | null = null

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('codedeck', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('codedeck')
}

function createMenu() {
  const template: any[] = [
    {
      label: 'CodeDeck',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            mainWindow?.webContents.send('check-updates')
          }
        },
        { type: 'separator' },
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Discord',
          click: async () => {
            await shell.openExternal('https://discord.gg/codedeck')
          }
        },
        {
          label: 'Wiki',
          click: async () => {
            await shell.openExternal('https://wiki.codedeck.app')
          }
        },
        {
          label: 'FAQ',
          click: async () => {
            await shell.openExternal('https://codedeck.app/faq')
          }
        }
      ]
    }
  ]

  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'toggleDevTools' }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0F1116',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Needed for some Electron features
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 10, y: 10 },
  })

  // Suppress harmless DevTools Autofill protocol errors
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('Autofill.enable') || message.includes('Autofill.setAddresses')) {
      event.preventDefault()
    }
  })

  // === CRASH REPORTING & ERROR HANDLING ===

  // Renderer process crashed
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('💥 RENDERER PROCESS CRASHED:', {
      reason: details.reason,
      exitCode: details.exitCode,
      timestamp: new Date().toISOString()
    })

    // Log to file for debugging
    const crashLog = `
================================================================================
RENDERER CRASH - ${new Date().toISOString()}
================================================================================
Reason: ${details.reason}
Exit Code: ${details.exitCode}
User: ${currentUserId || 'not logged in'}
================================================================================
`
    writeCrashLog(crashLog)
    const crashLogPath = getCrashLogPath()

    // Show error dialog to user
    if (details.reason !== 'clean-exit') {
      const { dialog } = require('electron')
      dialog.showErrorBox(
        'Application Crashed',
        `The application has encountered an error and needs to restart.\n\nReason: ${details.reason}\n\nCrash log saved to:\n${crashLogPath}`
      )

      // Reload the window after crash
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload()
        }
      }, 1000)
    }
  })

  // Renderer became unresponsive
  mainWindow.on('unresponsive', () => {
    console.warn('⚠️ WINDOW UNRESPONSIVE:', new Date().toISOString())

    const { dialog } = require('electron')
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Application Not Responding',
      message: 'The application is not responding. Would you like to wait or reload?',
      buttons: ['Wait', 'Reload'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 1 && mainWindow) {
        mainWindow.reload()
      }
    })
  })

  // Renderer became responsive again
  mainWindow.on('responsive', () => {
  })

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*", // unsafe-eval needed for Vite HMR
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts
                "font-src 'self' https://fonts.gstatic.com data:", // Allow Google Fonts
                "img-src 'self' https://* http://* data: blob:", // Allow images from any HTTPS source
                "connect-src 'self' http://localhost:* ws://localhost:* https://*", // Allow API calls
                "worker-src 'self' blob:", // Allow web workers
                "frame-src 'self' http://localhost:*" // Allow iframes from localhost
              ].join('; ')
            : [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' https://* data:",
                "connect-src 'self' https://*",
                "worker-src 'self' blob:",
                "frame-src 'self'"
              ].join('; ')
        ]
      }
    })
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set up PreviewService and LayoutManager with main window
  previewService.setMainWindow(mainWindow)
  layoutManager.setMainWindow(mainWindow)

  // Set up event forwarding windows
  setProcessHandlersWindow(mainWindow.webContents)
  setPreviewHandlersWindow(mainWindow.webContents)
  setLayoutHandlersWindow(mainWindow.webContents)
  setTerminalHandlersWindow(mainWindow.webContents)
  setClaudeHandlersWindow(mainWindow.webContents)
  setChatHandlersWindow(mainWindow.webContents)
  setGitHandlersWindow(mainWindow.webContents)
}

// Initialize database and register IPC handlers only once
let handlersRegistered = false
let authHandlersRegistered = false

async function initializeApp() {
  if (!handlersRegistered) {
    // CRITICAL: Clean up orphaned processes from previous session
    // This must run before anything else to free ports and kill zombie processes
    await processPersistence.cleanupStaleProcesses()

    // Initialize MongoDB connection early to prevent race conditions
    // This runs in background - failures are handled gracefully
    mongoService.connect().catch(error => {
      console.error('⚠️  MongoDB pre-connection failed (will retry on first use):', error)
    })

    // Note: Local database will be initialized after user login
    // See authHandlers.ts which calls setCurrentUser()

    // Initialize chat history manager (tracks Claude events)
    chatHistoryManager.init()

    // Register IPC handlers (only once)
    registerSecureStorageHandlers()
    registerTemplateHandlers()
    registerProjectHandlers()
    registerProcessHandlers()
    registerPreviewHandlers()
    registerLayoutHandlers()
    registerShellHandlers()
    registerImageHandlers()
    registerClaudeMdHandlers()
    registerTerminalHandlers()
    registerClaudeHandlers()
    registerChatHandlers()
    registerSupportHandlers()
    registerGitHandlers()
    registerWebsiteImportHandlers()

    // App-level IPC handlers
    ipcMain.on('app:flash-window', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Flash the taskbar/dock icon if window is not focused
        if (!mainWindow.isFocused()) {
          mainWindow.flashFrame(true)

          // Stop flashing when window gets focused
          const stopFlashing = () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.flashFrame(false)
            }
            mainWindow?.off('focus', stopFlashing)
          }
          mainWindow.once('focus', stopFlashing)
        }
      }
    })

    handlersRegistered = true
  }
}

// === CRASH LOG UTILITIES ===

/**
 * Get the crash log path for the current user
 * Falls back to app userData if no user is logged in
 */
function getCrashLogPath(): string {
  if (currentUserId) {
    // User-specific logs directory: ~/Documents/CodeDeck/{userId}/Logs/
    const userLogsDir = path.join(app.getPath('home'), 'Documents', 'CodeDeck', currentUserId, 'Logs')

    // Ensure Logs directory exists
    if (!fs.existsSync(userLogsDir)) {
      fs.mkdirSync(userLogsDir, { recursive: true })
    }

    return path.join(userLogsDir, 'crash.log')
  } else {
    // Fallback for crashes before login
    return path.join(app.getPath('userData'), 'crash.log')
  }
}

/**
 * Write crash log to file
 */
function writeCrashLog(logContent: string) {
  const crashLogPath = getCrashLogPath()

  try {
    fs.appendFileSync(crashLogPath, logContent)
    // Don't use console here - it can cause infinite loops if stdout/stderr is broken
  } catch (e) {
    // Silently fail - we're already in an error state, don't cause more errors
  }
}

// === GLOBAL ERROR HANDLERS ===

// Prevent infinite error loops
let isHandlingError = false

// Catch uncaught exceptions in main process
process.on('uncaughtException', (error) => {
  // Prevent recursive error handling
  if (isHandlingError) {
    return
  }
  isHandlingError = true

  try {
    const crashLog = `
================================================================================
UNCAUGHT EXCEPTION - ${new Date().toISOString()}
================================================================================
Error: ${error.message}
Stack: ${error.stack}
User: ${currentUserId || 'not logged in'}
================================================================================
`
    writeCrashLog(crashLog)

    // Don't exit in development
    if (!isDev) {
      app.quit()
    }
  } catch (e) {
    // Last resort - try to quit gracefully
    try {
      if (!isDev) {
        app.quit()
      }
    } catch {}
  } finally {
    // Reset flag after a delay to allow legitimate subsequent errors
    setTimeout(() => {
      isHandlingError = false
    }, 1000)
  }
})

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  // Prevent recursive error handling
  if (isHandlingError) {
    return
  }
  isHandlingError = true

  try {
    const crashLog = `
================================================================================
UNHANDLED REJECTION - ${new Date().toISOString()}
================================================================================
Reason: ${reason}
User: ${currentUserId || 'not logged in'}
================================================================================
`
    writeCrashLog(crashLog)
  } catch (e) {
    // Silently fail
  } finally {
    // Reset flag after a delay
    setTimeout(() => {
      isHandlingError = false
    }, 1000)
  }
})

// Log when app is ready and register global shortcuts
app.on('ready', () => {

  // Register global Tab shortcut for layout cycling
  const tabRegistered = globalShortcut.register('Tab', () => {
    // Send IPC event to cycle layout (will be handled by renderer)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('layout-cycle-requested')
    }
  })

  if (tabRegistered) {
  } else {
  }
})

// Unregister shortcuts when app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// IPC Handler to get crash logs
ipcMain.handle('app:get-crash-logs', async () => {
  const crashLogPath = getCrashLogPath()

  try {
    if (fs.existsSync(crashLogPath)) {
      const logs = fs.readFileSync(crashLogPath, 'utf-8')
      return { success: true, logs, path: crashLogPath }
    } else {
      return { success: true, logs: '', path: crashLogPath }
    }
  } catch (error) {
    console.error('Failed to read crash logs:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to read crash logs' }
  }
})

// IPC Handler to clear crash logs
ipcMain.handle('app:clear-crash-logs', async () => {
  const crashLogPath = getCrashLogPath()

  try {
    if (fs.existsSync(crashLogPath)) {
      fs.unlinkSync(crashLogPath)
    }
    return { success: true }
  } catch (error) {
    console.error('Failed to clear crash logs:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to clear crash logs' }
  }
})

// IPC Handler to get keywords for educational tooltips
ipcMain.handle('keywords:get-all', async () => {
  try {
    const keywords = keywordService.getKeywords()
    return { success: true, keywords }
  } catch (error) {
    console.error('Failed to get keywords:', error)
    return { success: false, keywords: {} }
  }
})

app.whenReady().then(async () => {
  // Load keywords for educational tooltips (loads fresh every time app starts)
  keywordService.loadKeywords()

  await initializeApp()
  createMenu()
  createWindow()

  // Register auth handlers only once (they need a window reference)
  if (mainWindow && !authHandlersRegistered) {
    registerAuthHandlers(mainWindow)
    authHandlersRegistered = true
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Track if we're already quitting to prevent multiple cleanup attempts
let isQuitting = false

// Handle graceful shutdown
app.on('before-quit', async (event) => {
  if (isQuitting) {
    return // Already cleaning up, let it proceed
  }

  // Prevent quit until cleanup completes
  event.preventDefault()
  isQuitting = true


  try {
    // 1. Destroy Claude sessions first (abort any running operations)
    claudeService.destroyAllSessions()

    // 2. Wait a moment for Claude operations to abort
    await new Promise(resolve => setTimeout(resolve, 500))

    // 3. Stop all dev servers
    await processManager.stopAll()

    // 4. Destroy terminal sessions
    terminalService.destroyAllSessions()

    // 5. Destroy all previews
    previewService.destroyAll()

    // 6. Close database last (after all operations complete)
    databaseService.close()

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
  } finally {
    // Now actually quit
    app.quit()
  }
})

app.on('window-all-closed', () => {
  // On macOS, keep app running even when windows close
  if (process.platform !== 'darwin') {
    // Trigger before-quit for graceful shutdown
    app.quit()
  }
})

// Handle OAuth callback URLs (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault()

  if (url.startsWith('codedeck://auth/callback')) {
    // Send the callback URL to the renderer process
    if (mainWindow) {
      mainWindow.webContents.send('auth:callback', url)
    }
  }
})

// Handle OAuth callback URLs (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      // Check for auth callback in command line
      const url = commandLine.find(arg => arg.startsWith('codedeck://'))
      if (url && url.startsWith('codedeck://auth/callback')) {
        mainWindow.webContents.send('auth:callback', url)
      }
    }
  })
}
