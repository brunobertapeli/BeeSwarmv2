import { ipcMain, BrowserWindow } from 'electron'
import { authService } from '../services/AuthService'
import { mongoService } from '../services/MongoService'

export function registerAuthHandlers(mainWindow: BrowserWindow) {
  // Sign in with Google
  ipcMain.handle('auth:sign-in-google', async () => {
    try {
      const { popup } = await authService.signInWithGoogle(mainWindow)

      let handled = false

      const handleAuth = async (url: string) => {
        if (handled) return
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          handled = true

          // Load blank page to stop navigation attempts
          if (!popup.isDestroyed()) {
            popup.loadURL('about:blank')
          }

          const result = await handleAuthCallback(url)

          if (!popup.isDestroyed()) {
            popup.close()
          }

          if (result.success && result.user) {
            mainWindow.webContents.send('auth:success', result)
          } else {
            mainWindow.webContents.send('auth:error', result)
          }
        }
      }

      // Listen for all navigation events
      popup.webContents.on('will-navigate', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('will-redirect', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('did-navigate', (event, url) => {
        handleAuth(url)
      })

      popup.webContents.on('did-navigate-in-page', (event, url) => {
        handleAuth(url)
      })

      // Check URL after page loads
      popup.webContents.on('did-finish-load', () => {
        const url = popup.webContents.getURL()
        handleAuth(url)
      })

      // Handle popup close
      popup.on('closed', () => {
        if (!handled) {
          mainWindow.webContents.send('auth:error', { error: 'Authentication cancelled' })
        }
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign in with Facebook
  ipcMain.handle('auth:sign-in-facebook', async () => {
    try {
      const { popup } = await authService.signInWithFacebook(mainWindow)
      let handled = false

      const handleAuth = async (url: string) => {
        if (handled) return
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          handled = true

          // Load blank page to stop navigation attempts
          if (!popup.isDestroyed()) {
            popup.loadURL('about:blank')
          }

          const result = await handleAuthCallback(url)

          if (!popup.isDestroyed()) {
            popup.close()
          }

          if (result.success && result.user) {
            mainWindow.webContents.send('auth:success', result)
          } else {
            mainWindow.webContents.send('auth:error', result)
          }
        }
      }

      popup.webContents.on('will-navigate', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('will-redirect', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('did-navigate', (event, url) => {
        handleAuth(url)
      })

      popup.webContents.on('did-navigate-in-page', (event, url) => {
        handleAuth(url)
      })

      popup.webContents.on('did-finish-load', () => {
        const url = popup.webContents.getURL()
        handleAuth(url)
      })

      popup.on('closed', () => {
        if (!handled) {
          mainWindow.webContents.send('auth:error', { error: 'Authentication cancelled' })
        }
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign in with GitHub
  ipcMain.handle('auth:sign-in-github', async () => {
    try {
      const { popup } = await authService.signInWithGithub(mainWindow)
      let handled = false

      const handleAuth = async (url: string) => {
        if (handled) return
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          handled = true

          // Load blank page to stop navigation attempts
          if (!popup.isDestroyed()) {
            popup.loadURL('about:blank')
          }

          const result = await handleAuthCallback(url)

          if (!popup.isDestroyed()) {
            popup.close()
          }

          if (result.success && result.user) {
            mainWindow.webContents.send('auth:success', result)
          } else {
            mainWindow.webContents.send('auth:error', result)
          }
        }
      }

      popup.webContents.on('will-navigate', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('will-redirect', (event, url) => {
        if (url.includes('/auth/callback') || url.includes('?code=')) {
          event.preventDefault()
        }
        handleAuth(url)
      })

      popup.webContents.on('did-navigate', (event, url) => {
        handleAuth(url)
      })

      popup.webContents.on('did-navigate-in-page', (event, url) => {
        handleAuth(url)
      })

      popup.webContents.on('did-finish-load', () => {
        const url = popup.webContents.getURL()
        handleAuth(url)
      })

      popup.on('closed', () => {
        if (!handled) {
          mainWindow.webContents.send('auth:error', { error: 'Authentication cancelled' })
        }
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Helper function to handle auth callback
  async function handleAuthCallback(url: string) {
    try {
      const { session, user } = await authService.handleAuthCallback(url)

      if (!user || !user.email) {
        throw new Error('No user data returned from authentication')
      }

      // Fetch or create user in MongoDB
      let userData = await mongoService.getUserByEmail(user.email)

      if (!userData) {
        userData = await mongoService.createUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          photoUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          authProvider: user.app_metadata?.provider as any || 'google'
        })
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: userData.email,
          name: userData.name,
          photoUrl: userData.photoUrl,
          plan: userData.plan
        },
        session
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Handle auth callback (called when user is redirected back)
  ipcMain.handle('auth:handle-callback', async (event, url: string) => {
    try {
      const { session, user } = await authService.handleAuthCallback(url)

      if (!user || !user.email) {
        throw new Error('No user data returned from authentication')
      }

      // Fetch or create user in MongoDB
      let userData = await mongoService.getUserByEmail(user.email)

      if (!userData) {
        // Create new user if doesn't exist
        userData = await mongoService.createUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          photoUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          authProvider: user.app_metadata?.provider as any || 'google'
        })
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: userData.email,
          name: userData.name,
          photoUrl: userData.photoUrl,
          plan: userData.plan
        },
        session
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Get current session
  ipcMain.handle('auth:get-session', async () => {
    try {
      const session = await authService.getSession()

      if (!session || !session.user) {
        return { success: true, session: null, user: null }
      }

      // Fetch user data from MongoDB
      const userData = await mongoService.getUserByEmail(session.user.email)

      if (!userData) {
        return { success: true, session: null, user: null }
      }

      return {
        success: true,
        session,
        user: {
          id: session.user.id,
          email: userData.email,
          name: userData.name,
          photoUrl: userData.photoUrl,
          plan: userData.plan
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign out
  ipcMain.handle('auth:sign-out', async () => {
    try {
      await authService.signOut()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
