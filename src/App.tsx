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
        console.log('Checking for updates...')
      })
    }
  }, [])

  const handleLoginSuccess = () => {
    // Mock user login - will be replaced with real Supabase auth
    const mockUser = {
      id: '1',
      email: 'user@example.com',
      name: 'John Doe'
    }
    setUser(mockUser)

    // Store in localStorage
    localStorage.setItem('beeswarm_auth', JSON.stringify({ user: mockUser }))
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
