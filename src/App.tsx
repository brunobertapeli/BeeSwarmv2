import { useEffect } from 'react'
import { useAppStore, initAuth } from './store/appStore'
import Login from './components/Login'
import ProjectView from './components/ProjectView'
import ToastContainer from './components/ToastContainer'
import type { User } from './types/auth'

function App() {
  const { isAuthenticated, setUser } = useAppStore()

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

  const handleLoginSuccess = async (user: User) => {
    setUser(user)

    // Store user data securely using Electron's safeStorage
    if (window.electronAPI?.secureStorage) {
      try {
        const authData = JSON.stringify({
          user,
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
