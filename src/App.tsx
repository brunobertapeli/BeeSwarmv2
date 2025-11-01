import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import Login from './components/Login'
import ProjectView from './components/ProjectView'
import ToastContainer from './components/ToastContainer'

function App() {
  const { isAuthenticated, setUser } = useAppStore()

  useEffect(() => {
    // Listen for check-updates event from Electron menu
    if (window.electronAPI) {
      window.electronAPI.receive('check-updates', () => {
        // Check for updates
      })
    }
  }, [])

  const handleLoginSuccess = (user: any) => {
    setUser(user)

    // Store in localStorage
    localStorage.setItem('beeswarm_auth', JSON.stringify({ user }))
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
