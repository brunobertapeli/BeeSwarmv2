import { useEffect } from 'react'
import { useAppStore, initAuth } from './store/appStore'
import Login from './components/Login'
import ProjectView from './components/ProjectView'
import ToastContainer from './components/ToastContainer'
import { useToast } from './hooks/useToast'
import type { User } from './types/auth'

function App() {
  const { isAuthenticated, user, session, setUser, setSession, awaitingSubscriptionUpdate, setAwaitingSubscriptionUpdate } = useAppStore()
  const toast = useToast()

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
  }

  return (
    <div className="w-full h-full">
      {!isAuthenticated ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <ProjectView />
      )}

      {/* Toast notifications - always rendered */}
      <ToastContainer />
    </div>
  )
}

export default App
