import { useEffect, useState, useRef } from 'react'
import { useAppStore, initAuth } from './store/appStore'
import Login from './components/Login'
import ProjectView from './components/ProjectView'
import ToastContainer from './components/ToastContainer'
import { ClaudeAuthModal, type ClaudeAuthModalState } from './components/ClaudeAuthModal'
import { useToast } from './hooks/useToast'
import type { User } from './types/auth'

function App() {
  const { isAuthenticated, user, session, setUser, setSession, awaitingSubscriptionUpdate, setAwaitingSubscriptionUpdate, claudeCliStatus, setClaudeCliStatus } = useAppStore()
  const toast = useToast()

  // Claude Auth Modal state
  const [showClaudeAuthModal, setShowClaudeAuthModal] = useState(false)
  const [claudeModalState, setClaudeModalState] = useState<ClaudeAuthModalState>('checking')
  const [claudeAuthError, setClaudeAuthError] = useState<string | undefined>()
  const claudeCheckStarted = useRef(false)

  // Function to check Claude CLI status
  const checkClaudeStatus = async () => {
    try {
      console.log('[ClaudeAuth] Checking Claude CLI status...')
      const result = await window.electronAPI?.claudeCli.checkStatus()
      console.log('[ClaudeAuth] Result:', result)

      if (result?.success && result.status) {
        setClaudeCliStatus({
          checked: true,
          installed: result.status.installed,
          authenticated: result.status.authenticated,
          email: result.status.email,
          error: result.status.error
        })
        return result.status
      } else {
        // API call succeeded but no status - treat as not installed
        console.log('[ClaudeAuth] No status returned, treating as not installed')
        setClaudeCliStatus({
          checked: true,
          installed: false,
          authenticated: false,
          error: result?.error || 'Failed to check Claude CLI status'
        })
        return { installed: false, authenticated: false, email: undefined, error: result?.error }
      }
    } catch (error: any) {
      console.error('[ClaudeAuth] Error checking status:', error)
      setClaudeCliStatus({
        checked: true,
        installed: false,
        authenticated: false,
        error: error.message
      })
      return { installed: false, authenticated: false, email: undefined, error: error.message }
    }
  }

  useEffect(() => {
    // Initialize auth from secure storage (after electronAPI is ready)
    initAuth().catch(console.error)

    // Listen for check-updates event from Electron menu
    if (window.electronAPI) {
      window.electronAPI.receive('check-updates', () => {
        // Check for updates
      })
    }
  }, [])

  // Start background Claude check on mount
  useEffect(() => {
    if (!claudeCheckStarted.current) {
      claudeCheckStarted.current = true
      console.log('[ClaudeAuth] Starting initial Claude check...')
      checkClaudeStatus()
    }
  }, [])

  // When user becomes authenticated (either via login or session restore),
  // check if Claude is ready and show modal if not
  useEffect(() => {
    if (isAuthenticated && claudeCliStatus?.checked) {
      console.log('[ClaudeAuth] User authenticated, Claude status:', claudeCliStatus)

      if (!claudeCliStatus.authenticated) {
        // Show modal since Claude is not ready
        setShowClaudeAuthModal(true)
        if (!claudeCliStatus.installed) {
          setClaudeModalState('not_installed')
          setClaudeAuthError(claudeCliStatus.error)
        } else {
          setClaudeModalState('not_authenticated')
          setClaudeAuthError(claudeCliStatus.error)
        }
      } else {
        // Claude is authenticated, make sure modal is closed
        setShowClaudeAuthModal(false)
      }
    }
  }, [isAuthenticated, claudeCliStatus])

  // Refresh subscription status when window regains focus after payment
  useEffect(() => {
    if (!isAuthenticated || !user) return

    const handleFocus = async () => {
      // Only refresh if we're awaiting an update
      if (!awaitingSubscriptionUpdate) return

      try {
        const result = await window.electronAPI?.auth.validateUser(user.email, user.id)

        if (result?.success && result.user) {
          const oldPlan = user.plan
          const newPlan = result.user.plan

          // Update user data
          setUser(result.user)

          // Update stored session with fresh user data
          if (session) {
            const updatedAuthData = JSON.stringify({
              user: result.user,
              session,
              timestamp: Date.now()
            })

            const storeResult = await window.electronAPI?.secureStorage.set('codedeck_auth', updatedAuthData)

            if (storeResult?.success && storeResult.encrypted) {
              localStorage.setItem('codedeck_auth_encrypted', storeResult.encrypted)
              if (storeResult.fallback) {
                localStorage.setItem('codedeck_auth_fallback', 'true')
              } else {
                localStorage.removeItem('codedeck_auth_fallback')
              }
            }
          }

          // Show toast if plan changed
          if (oldPlan !== newPlan) {
            if (newPlan === 'plus') {
              toast.success('Subscription activated!', 'Welcome to CodeDeck Plus')
            } else if (newPlan === 'premium') {
              toast.success('Subscription activated!', 'Welcome to CodeDeck Premium')
            } else if (newPlan === 'free') {
              toast.info('Subscription updated', 'Your subscription has been cancelled')
            }
          }

          // Clear the flag
          setAwaitingSubscriptionUpdate(false)
        }
      } catch (error) {
        console.error('Failed to refresh subscription:', error)
        // Clear flag anyway to avoid infinite retries
        setAwaitingSubscriptionUpdate(false)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isAuthenticated, user, session, awaitingSubscriptionUpdate, setUser, setAwaitingSubscriptionUpdate, toast])

  const handleLoginSuccess = async (user: User, session?: any) => {
    setUser(user)
    setSession(session)

    // Store user data AND session securely using Electron's safeStorage
    if (window.electronAPI?.secureStorage) {
      try {
        const authData = JSON.stringify({
          user,
          session,
          timestamp: Date.now()
        })

        const result = await window.electronAPI.secureStorage.set('codedeck_auth', authData)

        if (result.success && result.encrypted) {
          // Store encrypted data and fallback flag in localStorage
          localStorage.setItem('codedeck_auth_encrypted', result.encrypted)
          if (result.fallback) {
            localStorage.setItem('codedeck_auth_fallback', 'true')
          }
        }
      } catch (error) {
        console.error('Failed to store auth data securely:', error)
      }
    }

    // After OAuth success, check Claude CLI status
    setShowClaudeAuthModal(true)
    setClaudeModalState('checking')

    // Wait for background check or run fresh check
    let status = claudeCliStatus
    if (!status?.checked) {
      const result = await checkClaudeStatus()
      status = result ? {
        checked: true,
        installed: result.installed,
        authenticated: result.authenticated,
        email: result.email,
        error: result.error
      } : null
    }

    // Determine modal state based on check result
    if (status?.authenticated) {
      // All good - close modal and proceed
      setShowClaudeAuthModal(false)
      toast.success('Welcome!', 'Claude Code is ready')
    } else if (!status?.installed) {
      setClaudeModalState('not_installed')
      setClaudeAuthError(status?.error)
    } else {
      setClaudeModalState('not_authenticated')
      setClaudeAuthError(status?.error)
    }
  }

  // Handler for Claude auth retry
  const handleClaudeRetry = async () => {
    setClaudeModalState('checking')
    setClaudeAuthError(undefined)

    const result = await checkClaudeStatus()

    if (result?.authenticated) {
      setShowClaudeAuthModal(false)
      toast.success('Claude Code Ready', 'Successfully connected to Claude')
    } else if (!result?.installed) {
      setClaudeModalState('not_installed')
      setClaudeAuthError(result?.error)
    } else {
      setClaudeModalState('not_authenticated')
      setClaudeAuthError(result?.error)
    }
  }

  // Handler for Claude install button
  const handleClaudeInstall = () => {
    window.electronAPI?.claudeCli.openInstallUrl()
  }

  // Handler for Claude login button
  const handleClaudeLogin = async () => {
    setClaudeModalState('logging_in')
    try {
      const result = await window.electronAPI?.claudeCli.login()
      if (result?.success) {
        // Login completed, check status again
        await handleClaudeRetry()
      } else {
        setClaudeModalState('not_authenticated')
        setClaudeAuthError(result?.error || 'Login failed')
      }
    } catch (error: any) {
      setClaudeModalState('not_authenticated')
      setClaudeAuthError(error.message)
    }
  }

  // Determine if we should show ProjectView
  const canShowProjectView = isAuthenticated &&
    claudeCliStatus?.checked &&
    claudeCliStatus?.authenticated

  return (
    <div className="w-full h-full">
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : canShowProjectView ? (
        <ProjectView />
      ) : (
        // Show empty state while checking Claude auth or if blocked
        <div className="w-full h-full bg-[#0A0020]" />
      )}

      {/* Claude Auth Modal - blocking until authenticated */}
      <ClaudeAuthModal
        isOpen={showClaudeAuthModal}
        state={claudeModalState}
        onRetry={handleClaudeRetry}
        onInstall={handleClaudeInstall}
        onLogin={handleClaudeLogin}
        error={claudeAuthError}
      />

      {/* Toast notifications - always rendered */}
      <ToastContainer />
    </div>
  )
}

export default App
