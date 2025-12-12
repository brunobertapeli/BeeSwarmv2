import { autoUpdater, UpdateInfo, ProgressInfo } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

class AutoUpdateService {
  private mainWindow: BrowserWindow | null = null
  private isCheckingForUpdate = false

  constructor() {
    // Configure auto-updater
    autoUpdater.autoDownload = false // Don't auto-download, let user decide
    autoUpdater.autoInstallOnAppQuit = true

    // Set GitHub token for private repo access
    if (process.env.GH_TOKEN) {
      autoUpdater.requestHeaders = { Authorization: `token ${process.env.GH_TOKEN}` }
    }

    this.setupEventListeners()
  }

  private setupEventListeners() {
    autoUpdater.on('checking-for-update', () => {
      this.sendToRenderer('update:checking')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.sendToRenderer('update:available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.sendToRenderer('update:not-available', {
        version: info.version
      })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.sendToRenderer('update:download-progress', {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.sendToRenderer('update:downloaded', {
        version: info.version
      })
    })

    autoUpdater.on('error', (error: Error) => {
      // Suppress 404 errors (repo doesn't exist or is private)
      if (error.message?.includes('404') || error.message?.includes('HttpError')) {
        console.log('Auto-updater: No releases available (repo may be private or have no releases)')
        return
      }
      console.error('Auto-updater error:', error)
      this.sendToRenderer('update:error', {
        message: error.message
      })
    })
  }

  private sendToRenderer(channel: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async checkForUpdates(silent = false): Promise<void> {
    if (this.isCheckingForUpdate) {
      return
    }

    this.isCheckingForUpdate = true

    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      if (!silent) {
        this.sendToRenderer('update:error', {
          message: error instanceof Error ? error.message : 'Failed to check for updates'
        })
      }
    } finally {
      this.isCheckingForUpdate = false
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.sendToRenderer('update:error', {
        message: error instanceof Error ? error.message : 'Failed to download update'
      })
    }
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true)
  }
}

export const autoUpdateService = new AutoUpdateService()

// Register IPC handlers
export function registerAutoUpdateHandlers() {
  ipcMain.handle('update:check', async () => {
    await autoUpdateService.checkForUpdates(false)
  })

  ipcMain.handle('update:check-silent', async () => {
    await autoUpdateService.checkForUpdates(true)
  })

  ipcMain.handle('update:download', async () => {
    await autoUpdateService.downloadUpdate()
  })

  ipcMain.handle('update:install', () => {
    autoUpdateService.quitAndInstall()
  })
}
