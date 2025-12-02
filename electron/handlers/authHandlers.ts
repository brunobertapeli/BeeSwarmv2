import { ipcMain, BrowserWindow } from 'electron'
import { authService } from '../services/AuthService'
import { backendService } from '../services/BackendService'
import { setCurrentUser, clearCurrentUser } from '../main'

// Helper to setup OAuth popup with race-condition-safe callback handling
function setupOAuthPopup(
  popup: BrowserWindow,
  mainWindow: BrowserWindow,
  handleAuthCallback: (url: string) => Promise<any>
) {
  let handled = false
  let isProcessing = false

  // Cleanup function to remove all listeners
  const cleanup = () => {
    popup.webContents.removeAllListeners('will-navigate')
    popup.webContents.removeAllListeners('will-redirect')
    popup.webContents.removeAllListeners('did-navigate')
    popup.webContents.removeAllListeners('did-navigate-in-page')
    popup.webContents.removeAllListeners('did-finish-load')
    popup.removeAllListeners('closed')
  }

  const handleAuth = async (url: string) => {
    // Double-check pattern to prevent race conditions
    if (handled || isProcessing) return
    if (!url.includes('/auth/callback') && !url.includes('?code=')) return

    // Set processing flag immediately (synchronously)
    isProcessing = true

    // Remove all event listeners to prevent duplicate calls
    cleanup()

    // Mark as handled
    handled = true

    try {
      // Load blank page to stop further navigation
      if (!popup.isDestroyed()) {
        popup.loadURL('about:blank').catch(() => {})
      }

      const result = await handleAuthCallback(url)

      // Close popup
      if (!popup.isDestroyed()) {
        popup.close()
      }

      // Send result to main window
      if (result.success && result.user) {
        mainWindow.webContents.send('auth:success', result)
      } else {
        mainWindow.webContents.send('auth:error', result)
      }
    } catch (error: any) {
      if (!popup.isDestroyed()) {
        popup.close()
      }
      mainWindow.webContents.send('auth:error', { error: error.message })
    }
  }

  // Setup all event listeners
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

  // Handle popup close (user cancelled)
  popup.on('closed', () => {
    cleanup()
    if (!handled) {
      mainWindow.webContents.send('auth:error', { error: 'Authentication cancelled' })
    }
  })
}

export function registerAuthHandlers(mainWindow: BrowserWindow) {
  // Sign in with Google
  ipcMain.handle('auth:sign-in-google', async () => {
    try {
      const { popup } = await authService.signInWithGoogle(mainWindow)
      setupOAuthPopup(popup, mainWindow, handleAuthCallback)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign in with Facebook
  ipcMain.handle('auth:sign-in-facebook', async () => {
    try {
      const { popup } = await authService.signInWithFacebook(mainWindow)
      setupOAuthPopup(popup, mainWindow, handleAuthCallback)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Sign in with GitHub
  ipcMain.handle('auth:sign-in-github', async () => {
    try {
      const { popup } = await authService.signInWithGithub(mainWindow)
      setupOAuthPopup(popup, mainWindow, handleAuthCallback)
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

      // Exchange Supabase token for backend JWT
      const { token: backendToken, user: userData } = await backendService.loginWithSupabaseToken(
        session.access_token
      )

      // Store the auth token for authenticated AI requests
      backendService.setAuthToken(backendToken)

      const userResult = {
        id: user.id,
        email: userData.email,
        name: userData.name,
        photoUrl: userData.photoUrl,
        plan: userData.plan
      }

      // Create modified session with backend JWT
      const backendSession = {
        ...session,
        access_token: backendToken // Replace Supabase token with backend JWT
      }

      // Set current user and initialize user-scoped services
      setCurrentUser(user.id, userData.email)

      return {
        success: true,
        user: userResult,
        session: backendSession
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Handle auth callback (called when user is redirected back)
  ipcMain.handle('auth:handle-callback', async (event, url: string) => {
    return handleAuthCallback(url)
  })

  // Get current session
  ipcMain.handle('auth:get-session', async () => {
    try {
      const session = await authService.getSession()

      if (!session || !session.user) {
        return { success: true, session: null, user: null }
      }

      // Fetch user data from backend
      try {
        const userData = await backendService.getUserByEmail(session.user.email)

        if (!userData) {
          return { success: true, session: null, user: null }
        }

        const userResult = {
          id: session.user.id,
          email: userData.email,
          name: userData.name,
          photoUrl: userData.photoUrl,
          plan: userData.plan
        }

        // Set current user and initialize user-scoped services
        setCurrentUser(session.user.id)

        return {
          success: true,
          session,
          user: userResult
        }
      } catch (backendError: any) {
        console.error('⚠️  Backend error during session fetch, using cached session only:', backendError)

        // Fallback: Return session without backend user data
        // User can still use the app, but may have stale plan data
        const userResult = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.email?.split('@')[0] || 'User',
          photoUrl: undefined,
          plan: 'free' // Safe default
        }

        setCurrentUser(session.user.id)

        return {
          success: true,
          session,
          user: userResult,
          warning: 'Using cached session data - Backend unavailable'
        }
      }
    } catch (error: any) {
      console.error('❌ Error getting session:', error)
      return { success: false, error: error.message }
    }
  })

  // Sign out
  ipcMain.handle('auth:sign-out', async () => {
    try {
      await authService.signOut()
      clearCurrentUser()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Restore user session (called when session is restored from localStorage)
  ipcMain.handle('auth:restore-session', async (_event, userId: string, userEmail?: string, accessToken?: string) => {
    try {
      setCurrentUser(userId, userEmail)

      // If access token is provided, set it for authenticated AI requests
      if (accessToken) {
        backendService.setAuthToken(accessToken)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Validate user plan from backend (no Supabase session required)
  ipcMain.handle('auth:validate-user', async (_event, email: string, userId: string) => {
    try {
      // Fetch user data directly from backend
      const userData = await backendService.getUserByEmail(email)

      if (!userData) {
        console.warn('⚠️  User not found in backend:', email)
        // Fallback: Return cached user data instead of failing
        return {
          success: true,
          user: {
            id: userId,
            email: email,
            name: email.split('@')[0],
            photoUrl: undefined,
            plan: 'free'
          },
          warning: 'User not found in backend, using cached data'
        }
      }

      // Return Supabase user ID along with fresh backend data
      const userResult = {
        id: userId, // Preserve Supabase user ID from cached data
        email: userData.email,
        name: userData.name,
        photoUrl: userData.photoUrl,
        plan: userData.plan
      }

      return {
        success: true,
        user: userResult
      }
    } catch (error: any) {
      console.error('❌ Error validating user:', error)
      // Fallback: Return safe defaults so user can still use app
      return {
        success: true,
        user: {
          id: userId,
          email: email,
          name: email.split('@')[0],
          photoUrl: undefined,
          plan: 'free'
        },
        warning: 'Backend error, using cached data: ' + error.message
      }
    }
  })

  // Create Stripe portal session
  ipcMain.handle('auth:create-stripe-portal', async (_event, sessionData?: any) => {
    try {
      console.log('🔍 Received session data:', {
        hasSessionData: !!sessionData,
        hasAccessToken: !!sessionData?.access_token
      })

      if (!sessionData || !sessionData.access_token) {
        console.error('❌ No session data or access token provided')
        return { success: false, error: 'No active session' }
      }

      console.log('📞 Calling backend to create Stripe portal session...')
      const { url } = await backendService.createStripePortalSession(sessionData.access_token)

      console.log('✅ Stripe portal URL received:', url.substring(0, 50) + '...')
      return { success: true, url }
    } catch (error: any) {
      console.error('❌ Error creating Stripe portal session:', error)
      return { success: false, error: error.message }
    }
  })
}
