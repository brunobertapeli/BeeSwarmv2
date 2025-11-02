import { create } from 'zustand'
import type { TechConfig } from '../components/TemplateSelector'
import type { Device, DeviceType, Orientation } from '../types/devices'
import { getDefaultDevice } from '../types/devices'

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

interface User {
  id: string
  email: string
  name: string
  photoUrl?: string
  plan: 'free' | 'plus' | 'premium'
}

export type DeploymentStatus = 'idle' | 'creating' | 'building' | 'finalizing' | 'setting-keys' | 'live'

interface AppState {
  // Auth
  isAuthenticated: boolean
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void

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
}

export const useAppStore = create<AppState>((set) => ({
  // Auth state
  isAuthenticated: false, // Will check localStorage on init
  user: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),

  // Project state
  currentProjectId: null,
  lastProjectId: null,
  setCurrentProject: (projectId) => {
    // Persist to localStorage
    localStorage.setItem('beeswarm_currentProjectId', projectId)
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
}))

// Initialize auth state from localStorage
if (typeof window !== 'undefined') {
  const storedAuth = localStorage.getItem('beeswarm_auth')
  if (storedAuth) {
    try {
      const { user } = JSON.parse(storedAuth)
      // Only restore session if user has required fields (photoUrl, plan)
      // This prevents old mock data from being loaded
      if (user && user.plan && user.email) {
        useAppStore.setState({ user, isAuthenticated: true })
      } else {
        // Clear invalid/old session data
        localStorage.removeItem('beeswarm_auth')
      }
    } catch (e) {
      console.error('Failed to parse stored auth:', e)
      localStorage.removeItem('beeswarm_auth')
    }
  }

  // Initialize current project from localStorage
  const storedProjectId = localStorage.getItem('beeswarm_currentProjectId')
  if (storedProjectId) {
    useAppStore.setState({ currentProjectId: storedProjectId, lastProjectId: storedProjectId })
  }
}
