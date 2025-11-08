import { create } from 'zustand'
import type { TechConfig } from '../components/TemplateSelector'
import type { Device, DeviceType, Orientation } from '../types/devices'
import { getDefaultDevice } from '../types/devices'
import type { User } from '../types/auth'

interface Project {
  id: string
  name: string
  path: string
  lastAccessed: Date
  isFavorite: boolean
  techStack?: string[]
  isSetupComplete?: boolean
  requiredApiKeys?: string[]
}

export type DeploymentStatus = 'idle' | 'creating' | 'building' | 'finalizing' | 'setting-keys' | 'live'

interface AppState {
  // Auth
  isAuthenticated: boolean
  user: User | null
  setUser: (user: User | null) => void
  logout: () => Promise<void>

  // Projects
  currentProjectId: string | null
  lastProjectId: string | null
  setCurrentProject: (projectId: string) => void
  netlifyConnected: boolean
  setNetlifyConnected: (connected: boolean) => void
  deploymentStatus: DeploymentStatus
  setDeploymentStatus: (status: DeploymentStatus) => void

  // UI State
  showProjectSelector: boolean
  setShowProjectSelector: (show: boolean) => void
  showTemplateSelector: boolean
  setShowTemplateSelector: (show: boolean) => void
  showProjectSettings: boolean
  setShowProjectSettings: (show: boolean) => void
  showTerminal: boolean
  setShowTerminal: (show: boolean) => void
  showStatusSheet: boolean
  setShowStatusSheet: (show: boolean) => void
  isProjectSetupMode: boolean
  setProjectSetupMode: (isSetup: boolean) => void
  newProjectData: { templateId: string; requiredTechConfigs: TechConfig[] } | null
  setNewProjectData: (data: { templateId: string; requiredTechConfigs: TechConfig[] } | null) => void

  // Device Preview State
  viewMode: DeviceType
  setViewMode: (mode: DeviceType) => void
  selectedDevice: Device
  setSelectedDevice: (device: Device) => void
  orientation: Orientation
  setOrientation: (orientation: Orientation) => void
  toggleOrientation: () => void

  // Computed property: Check if any overlay is blocking the preview
  hasOverlayOpen: () => boolean
}

export const useAppStore = create<AppState>((set) => ({
  // Auth state
  isAuthenticated: false, // Will check secure storage on init
  user: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: async () => {
    // Clear secure storage
    localStorage.removeItem('codedeck_auth_encrypted')
    localStorage.removeItem('codedeck_auth_fallback')
    localStorage.removeItem('codedeck_currentProjectId') // Clear current project
    localStorage.removeItem('beeswarm_auth') // Legacy - remove on logout
    set({ user: null, isAuthenticated: false, currentProjectId: null })
  },

  // Project state
  currentProjectId: null,
  lastProjectId: null,
  setCurrentProject: (projectId) => {
    // Persist to localStorage
    localStorage.setItem('codedeck_currentProjectId', projectId)
    set({ currentProjectId: projectId, lastProjectId: projectId })
  },
  netlifyConnected: true, // Set to true for demo purposes
  setNetlifyConnected: (connected) => set({ netlifyConnected: connected }),
  deploymentStatus: 'idle',
  setDeploymentStatus: (status) => set({ deploymentStatus: status }),

  // UI state
  showProjectSelector: false,
  setShowProjectSelector: (show) => set({ showProjectSelector: show }),
  showTemplateSelector: false,
  setShowTemplateSelector: (show) => set({ showTemplateSelector: show }),
  showProjectSettings: false,
  setShowProjectSettings: (show) => set({ showProjectSettings: show }),
  showTerminal: false,
  setShowTerminal: (show) => set({ showTerminal: show }),
  showStatusSheet: false,
  setShowStatusSheet: (show) => set({ showStatusSheet: show }),
  isProjectSetupMode: false,
  setProjectSetupMode: (isSetup) => set({ isProjectSetupMode: isSetup }),
  newProjectData: null,
  setNewProjectData: (data) => set({ newProjectData: data }),

  // Device preview state
  viewMode: 'desktop',
  setViewMode: (mode) => set({ viewMode: mode, selectedDevice: getDefaultDevice(mode) }),
  selectedDevice: getDefaultDevice('desktop'),
  setSelectedDevice: (device) => set({ selectedDevice: device }),
  orientation: 'portrait',
  setOrientation: (orientation) => set({ orientation }),
  toggleOrientation: () => set((state) => ({
    orientation: state.orientation === 'portrait' ? 'landscape' : 'portrait'
  })),

  // Computed getter for overlay state
  hasOverlayOpen: () => {
    const state = useAppStore.getState()
    return (
      state.showTerminal ||
      state.showProjectSettings ||
      state.showProjectSelector ||
      state.showTemplateSelector ||
      state.showStatusSheet
    )
  },
}))

// Export function to initialize auth (called from App.tsx after electronAPI is ready)
export const initAuth = async () => {
  const encryptedAuth = localStorage.getItem('codedeck_auth_encrypted')
  const isFallback = localStorage.getItem('codedeck_auth_fallback') === 'true'

  if (encryptedAuth && window.electronAPI?.secureStorage) {
    try {
      // Decrypt stored auth data
      const result = await window.electronAPI.secureStorage.get(encryptedAuth, isFallback)

      if (result.success && result.value) {
        const { user, timestamp } = JSON.parse(result.value)

        // Validate user data structure
        if (!user || !user.plan || !user.email || !user.id) {
          localStorage.removeItem('codedeck_auth_encrypted')
          localStorage.removeItem('codedeck_auth_fallback')
          return
        }

        // Check if session is expired (older than 30 days)
        const SESSION_EXPIRY = 30 * 24 * 60 * 60 * 1000 // 30 days
        if (Date.now() - timestamp > SESSION_EXPIRY) {
          localStorage.removeItem('codedeck_auth_encrypted')
          localStorage.removeItem('codedeck_auth_fallback')
          return
        }

        // All validations passed, restore session
        await window.electronAPI?.auth.restoreSession(user.id)

        // Validate user plan against MongoDB on startup
        try {
          const validationResult = await window.electronAPI?.auth.validateUser(user.email, user.id)

          if (validationResult?.success && validationResult.user) {
            // Update secure storage with fresh data from MongoDB
            const freshAuthData = JSON.stringify({
              user: validationResult.user,
              timestamp: Date.now()
            })

            const storeResult = await window.electronAPI.secureStorage.set('codedeck_auth', freshAuthData)

            if (storeResult.success && storeResult.encrypted) {
              localStorage.setItem('codedeck_auth_encrypted', storeResult.encrypted)

              // Always update fallback flag (set or remove)
              if (storeResult.fallback) {
                localStorage.setItem('codedeck_auth_fallback', 'true')
              } else {
                localStorage.removeItem('codedeck_auth_fallback')
              }
            }

            // Set state with validated data from MongoDB
            useAppStore.setState({ user: validationResult.user, isAuthenticated: true })
          } else {
            // Fallback to cached data if validation fails
            useAppStore.setState({ user, isAuthenticated: true })
          }
        } catch (validationError) {
          // Fallback to cached data on error
          useAppStore.setState({ user, isAuthenticated: true })
        }
      } else {
        localStorage.removeItem('codedeck_auth_encrypted')
        localStorage.removeItem('codedeck_auth_fallback')
      }
    } catch (e) {
      localStorage.removeItem('codedeck_auth_encrypted')
      localStorage.removeItem('codedeck_auth_fallback')
    }
  } else {
    // Check for legacy BeeSwarm storage and clear it
    const oldAuth = localStorage.getItem('beeswarm_auth')
    if (oldAuth) {
      localStorage.removeItem('beeswarm_auth')
    }
  }
}

// NOTE: currentProjectId is NOT restored from localStorage on startup
// It will be auto-selected when projects are fetched in ProjectView
// This prevents loading the wrong project when switching between users
