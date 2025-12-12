// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config()

// Now import everything else
import { app, BrowserWindow, Menu, shell, ipcMain, globalShortcut, protocol, net, dialog } from 'electron'

// Handle Windows Squirrel events (install, uninstall, update)
// This MUST be at the very top before any other app logic
if (process.platform === 'win32') {
  const squirrelCommand = process.argv[1]
  if (squirrelCommand === '--squirrel-install' ||
      squirrelCommand === '--squirrel-updated' ||
      squirrelCommand === '--squirrel-uninstall' ||
      squirrelCommand === '--squirrel-obsolete') {
    app.quit()
  }
}
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
import { registerTerminalHandlers, registerInteractiveTerminalHandlers, setTerminalHandlersWindow } from './handlers/terminalHandlers.js'
import { registerClaudeHandlers, setClaudeHandlersWindow } from './handlers/claudeHandlers.js'
import { registerChatHandlers, setChatHandlersWindow } from './handlers/chatHandlers.js'
import { registerResearchAgentHandlers, setResearchAgentHandlersWindow } from './handlers/researchAgentHandlers.js'
import { registerGitHandlers, setGitHandlersWindow } from './handlers/gitHandlers.js'
import { registerSecureStorageHandlers } from './handlers/secureStorageHandlers.js'
import { registerWebsiteImportHandlers} from './handlers/websiteImportHandlers.js'
import { registerClaudeMdHandlers } from './handlers/claudeMdHandlers.js'
import { registerImageHandlers } from './handlers/imageHandlers.js'
import { registerAudioHandlers } from './handlers/audioHandlers.js'
import { registerFileHandlers } from './handlers/fileHandlers.js'
import { registerAnalyticsHandlers } from './handlers/analyticsHandlers.js'
import { registerChatWidgetHandlers, setChatWidgetWindow } from './handlers/chatWidgetHandlers.js'
import { registerBackgroundRemoverHandlers } from './handlers/backgroundRemoverHandlers.js'
import { registerClaudeCliHandlers } from './handlers/claudeCliHandlers.js'
import { registerDeploymentHandlers, setDeploymentMainWindow } from './handlers/deploymentHandlers.js'
import { autoUpdateService, registerAutoUpdateHandlers } from './services/AutoUpdateService.js'
import { databaseService } from './services/DatabaseService.js'
import { analyticsService } from './services/AnalyticsService.js'
import { layoutManager } from './services/LayoutManager.js'

// Global state for current user
let currentUserId: string | null = null
let currentUserEmail: string | null = null

/**
 * Set current user and reinitialize user-scoped services
 */
export function setCurrentUser(userId: string, userEmail?: string) {
  currentUserId = userId
  if (userEmail) {
    currentUserEmail = userEmail
  }

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
 * Get current user email
 */
export function getCurrentUserEmail(): string | null {
  return currentUserEmail
}

/**
 * Clear current user (on logout)
 */
export function clearCurrentUser() {
  currentUserId = null
  currentUserEmail = null
}
import { previewService } from './services/PreviewService.js'
import { processManager } from './services/ProcessManager.js'
import { processPersistence } from './services/ProcessPersistence.js'
import { terminalService } from './services/TerminalService.js'
import { claudeService } from './services/ClaudeService.js'
import { chatHistoryManager } from './services/ChatHistoryManager.js'
import { projectLockService } from './services/ProjectLockService.js'
import { keywordService } from './services/KeywordService.js'
import { logPersistenceService } from './services/LogPersistenceService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Debug: Log if environment variables are loaded
// Use app.isPackaged for reliable detection (NODE_ENV may not be set in production builds)
const isDev = !app.isPackaged

// Suppress Electron security warnings in development (we need unsafe-eval for Vite HMR)
if (isDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

// Hide dock icon until window is ready (prevents multiple dock icons flashing)
app.dock?.hide()

// Register custom protocol for production builds
// This allows CORS to work properly with a real origin instead of 'null'
if (!isDev) {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'codedeck',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
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
          label: 'Check for Updates...',
          click: async () => {
            await autoUpdateService.checkForUpdates(false)
          }
        },
        { type: 'separator' },
        {
          label: 'About CodeDeck',
          click: () => {
            const appVersion = app.getVersion()
            const electronVersion = process.versions.electron
            const chromeVersion = process.versions.chrome
            const nodeVersion = process.versions.node
            const v8Version = process.versions.v8
            const osInfo = `${process.platform} ${process.arch} ${require('os').release()}`

            dialog.showMessageBox({
              type: 'info',
              title: 'About CodeDeck',
              message: 'CodeDeck',
              detail: [
                `Version: ${appVersion}`,
                `Electron: ${electronVersion}`,
                `Chromium: ${chromeVersion}`,
                `Node.js: ${nodeVersion}`,
                `V8: ${v8Version}`,
                `OS: ${osInfo}`
              ].join('\n'),
              buttons: ['Copy', 'OK'],
              defaultId: 1,
              icon: path.join(__dirname, '../build/icon.png')
            }).then((result) => {
              if (result.response === 0) {
                // Copy to clipboard
                const { clipboard } = require('electron')
                clipboard.writeText([
                  `Version: ${appVersion}`,
                  `Electron: ${electronVersion}`,
                  `Chromium: ${chromeVersion}`,
                  `Node.js: ${nodeVersion}`,
                  `V8: ${v8Version}`,
                  `OS: ${osInfo}`
                ].join('\n'))
              }
            })
          }
        },
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
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Discord',
          click: async () => {
            await shell.openExternal('https://discord.com/invite/zkfAAGqFwW')
          }
        },
        {
          label: 'FAQ',
          click: async () => {
            await shell.openExternal('https://www.codedeckai.com/faq')
          }
        },
        {
          label: 'News',
          click: async () => {
            await shell.openExternal('https://www.codedeckai.com/blog')
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
  mainWindow.webContents.on('console-message', (event) => {
    if (event.message.includes('Autofill.enable') || event.message.includes('Autofill.setAddresses')) {
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
    }).then((result: { response: number }) => {
      if (result.response === 1 && mainWindow) {
        mainWindow.reload()
      }
    })
  })

  // Renderer became responsive again
  mainWindow.on('responsive', () => {
  })

  // Set Content Security Policy (only in production - dev mode doesn't need strict CSP)
  if (!isDev) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            [
              "default-src 'self' codedeck:",
              "script-src 'self' codedeck:",
              "style-src 'self' codedeck: 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' codedeck: https://fonts.gstatic.com data:",
              "img-src 'self' codedeck: https://* data:",
              "connect-src 'self' codedeck: https://*",
              "worker-src 'self' codedeck: blob:",
              "frame-src 'self' codedeck:"
            ].join('; ')
          ]
        }
      })
    })
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // Use custom protocol for better CORS support
    mainWindow.loadURL('codedeck://localhost/index.html')
  }

  // Show dock icon once window is ready
  mainWindow.once('ready-to-show', () => {
    app.dock?.show()
  })

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
  setResearchAgentHandlersWindow(mainWindow.webContents)
  setGitHandlersWindow(mainWindow.webContents)
  setChatWidgetWindow(mainWindow.webContents)
  setDeploymentMainWindow(mainWindow.webContents)
}

// Initialize database and register IPC handlers only once
let handlersRegistered = false
let authHandlersRegistered = false

async function initializeApp() {
  if (!handlersRegistered) {
    // CRITICAL: Clean up orphaned processes from previous session
    // This must run before anything else to free ports and kill zombie processes
    await processPersistence.cleanupStaleProcesses()

    // Note: Local database will be initialized after user login
    // See authHandlers.ts which calls setCurrentUser()
    // MongoDB is now accessed via backend API instead of direct connection

    // Initialize chat history manager (tracks Claude events)
    chatHistoryManager.init()

    // Initialize analytics service (async, non-blocking)
    analyticsService.init().catch(err => {
      console.error('Failed to initialize analytics service:', err)
    })

    // Register IPC handlers (only once)
    registerSecureStorageHandlers()
    registerTemplateHandlers()
    registerProjectHandlers()
    registerAnalyticsHandlers()
    registerProcessHandlers()
    registerPreviewHandlers()
    registerLayoutHandlers()
    registerShellHandlers()
    registerImageHandlers()
    registerAudioHandlers()
    registerFileHandlers()
    registerClaudeMdHandlers()
    registerTerminalHandlers()
    registerInteractiveTerminalHandlers()
    registerClaudeHandlers()
    registerChatHandlers()
    registerResearchAgentHandlers()
    registerGitHandlers()
    registerWebsiteImportHandlers()
    registerChatWidgetHandlers()
    registerBackgroundRemoverHandlers()
    registerClaudeCliHandlers()
    registerDeploymentHandlers()
    registerAutoUpdateHandlers()

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

// Log when app is ready
app.on('ready', () => {
  // Shift+Tab shortcut is handled locally in renderer (see ProjectView.tsx)
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

  // Register custom protocol handler for production
  if (!isDev) {
    protocol.handle('codedeck', (request) => {
      // Extract the path from the URL (e.g., codedeck://localhost/index.html -> index.html)
      const url = request.url.replace('codedeck://localhost/', '')
      const filePath = path.join(__dirname, '../dist', url)

      return net.fetch(`file://${filePath}`)
    })
  }

  await initializeApp()
  createMenu()
  createWindow()

  // Register auth handlers only once (they need a window reference)
  if (mainWindow && !authHandlersRegistered) {
    registerAuthHandlers(mainWindow)
    authHandlersRegistered = true
  }

  // Initialize auto-updater (only in production)
  if (!isDev && mainWindow) {
    autoUpdateService.setMainWindow(mainWindow)

    // Check for updates on startup (silent - no error popup if offline)
    setTimeout(() => {
      autoUpdateService.checkForUpdates(true)
    }, 5000) // Wait 5 seconds after app start
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

    // 6. Flush pending log writes
    logPersistenceService.cleanup()

    // 7. Close database last (after all operations complete)
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
app.on('open-url', async (event, url) => {
  event.preventDefault()

  if (url.startsWith('codedeck://auth/callback')) {
    // Process the auth callback and send result to renderer
    if (mainWindow) {
      try {
        // Import and use the auth handler to process the callback
        const result = await mainWindow.webContents.executeJavaScript(
          `window.electronAPI?.auth?.handleCallback?.("${url.replace(/"/g, '\\"')}")`
        )
        if (result?.success) {
          mainWindow.webContents.send('auth:success', result)
        } else {
          mainWindow.webContents.send('auth:error', result || { error: 'Authentication failed' })
        }
      } catch (error: any) {
        mainWindow.webContents.send('auth:error', { error: error.message })
      }
    }
  }
})

// Handle OAuth callback URLs (Windows/Linux)
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()

      // Check for auth callback in command line
      const url = commandLine.find(arg => arg.startsWith('codedeck://'))
      if (url && url.startsWith('codedeck://auth/callback')) {
        try {
          // Process the auth callback via IPC
          const result = await mainWindow.webContents.executeJavaScript(
            `window.electronAPI?.auth?.handleCallback?.("${url.replace(/"/g, '\\"')}")`
          )
          if (result?.success) {
            mainWindow.webContents.send('auth:success', result)
          } else {
            mainWindow.webContents.send('auth:error', result || { error: 'Authentication failed' })
          }
        } catch (error: any) {
          mainWindow.webContents.send('auth:error', { error: error.message })
        }
      }
    }
  })
}
