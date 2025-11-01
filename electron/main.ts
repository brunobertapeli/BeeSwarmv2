// IMPORTANT: Load environment variables FIRST before any other imports
import dotenv from 'dotenv'
dotenv.config()

// Now import everything else
import { app, BrowserWindow, Menu, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerAuthHandlers } from './handlers/authHandlers.js'
import { registerTemplateHandlers } from './handlers/templateHandlers.js'
import { registerProjectHandlers } from './handlers/projectHandlers.js'
import { registerProcessHandlers, setProcessHandlersWindow } from './handlers/processHandlers.js'
import { registerPreviewHandlers, setPreviewHandlersWindow } from './handlers/previewHandlers.js'
import { registerShellHandlers } from './handlers/shellHandlers.js'
import { databaseService } from './services/DatabaseService.js'
import { previewService } from './services/PreviewService.js'
import { processManager } from './services/ProcessManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Debug: Log if environment variables are loaded
const isDev = process.env.NODE_ENV !== 'production'
console.log('\n🔧 BeeSwarm Starting...')
console.log('🔧 Development mode:', isDev)
console.log('📁 CWD:', process.cwd())
console.log('📁 __dirname:', __dirname)
console.log('✅ VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL)
console.log('✅ MONGODB_URI:', !!process.env.MONGODB_URI)
console.log('')


let mainWindow: BrowserWindow | null = null

// Register custom protocol for OAuth callback
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('beeswarm', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('beeswarm')
}

function createMenu() {
  const template: any[] = [
    {
      label: 'BeeSwarm',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            console.log('Checking for updates...')
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
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow()
          }
        },
        { type: 'separator' },
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
            await shell.openExternal('https://discord.gg/beeswarm')
          }
        },
        {
          label: 'Wiki',
          click: async () => {
            await shell.openExternal('https://wiki.beeswarm.app')
          }
        },
        {
          label: 'FAQ',
          click: async () => {
            await shell.openExternal('https://beeswarm.app/faq')
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
    trafficLightPosition: { x: 15, y: 15 },
  })

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; img-src 'self' https://* data:; connect-src 'self' http://localhost:* ws://localhost:*"
            : "default-src 'self'; img-src 'self' https://* data:; connect-src 'self'"
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

  // Set up PreviewService with main window
  previewService.setMainWindow(mainWindow)

  // Set up event forwarding windows
  setProcessHandlersWindow(mainWindow.webContents)
  setPreviewHandlersWindow(mainWindow.webContents)
}

// Initialize database and register IPC handlers only once
let handlersRegistered = false
let authHandlersRegistered = false

function initializeApp() {
  if (!handlersRegistered) {
    // Initialize database
    databaseService.init()

    // Register IPC handlers (only once)
    registerTemplateHandlers()
    registerProjectHandlers()
    registerProcessHandlers()
    registerPreviewHandlers()
    registerShellHandlers()

    handlersRegistered = true
  }
}

app.whenReady().then(() => {
  initializeApp()
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

app.on('window-all-closed', () => {
  // Cleanup before quitting
  console.log('🛑 Stopping all processes and cleaning up...')

  // Stop all dev servers (sync version, no await needed for quit)
  processManager.stopAll().catch((error) => {
    console.error('Error stopping processes:', error)
  })

  // Destroy all previews
  previewService.destroyAll()

  // Close database
  databaseService.close()

  console.log('✅ Cleanup complete')

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle OAuth callback URLs (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault()

  if (url.startsWith('beeswarm://auth/callback')) {
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
      const url = commandLine.find(arg => arg.startsWith('beeswarm://'))
      if (url && url.startsWith('beeswarm://auth/callback')) {
        mainWindow.webContents.send('auth:callback', url)
      }
    }
  })
}
