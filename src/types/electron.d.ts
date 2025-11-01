export interface Template {
  _id: string
  id: string
  name: string
  description: string
  type: 'frontend' | 'fullstack' | 'backend'
  category: string
  githubUrl: string
  requiredPlan: 'free' | 'plus' | 'premium'
  requiredServices: string[]
  demoUrl?: string
  techStack: string[]
}

export interface Project {
  id: string
  name: string
  path: string
  templateId: string
  templateName: string
  status: 'creating' | 'ready' | 'error'
  isFavorite: boolean
  configCompleted: boolean
  envVars: string | null
  dependenciesInstalled: boolean
  createdAt: number
  lastOpenedAt: number | null
}

export type ProcessState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'error'

export interface ProcessOutput {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
  raw: string
}

export interface PreviewBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ElectronAPI {
  send: (channel: string, data: any) => void
  receive: (channel: string, func: (...args: any[]) => void) => void
  invoke: (channel: string, ...args: any[]) => Promise<any>
  onDependencyProgress: (callback: (data: string) => void) => void

  auth: {
    signInWithGoogle: () => Promise<{ success: boolean; url?: string; error?: string }>
    signInWithFacebook: () => Promise<{ success: boolean; url?: string; error?: string }>
    signInWithGithub: () => Promise<{ success: boolean; url?: string; error?: string }>
    handleCallback: (url: string) => Promise<{
      success: boolean
      user?: {
        id: string
        email: string
        name: string
        photoUrl?: string
        plan: 'free' | 'plus' | 'premium'
      }
      session?: any
      error?: string
    }>
    getSession: () => Promise<{
      success: boolean
      session?: any
      user?: {
        id: string
        email: string
        name: string
        photoUrl?: string
        plan: 'free' | 'plus' | 'premium'
      }
      error?: string
    }>
    signOut: () => Promise<{ success: boolean; error?: string }>
    onCallback: (callback: (url: string) => void) => void
  }

  templates: {
    fetch: () => Promise<{
      success: boolean
      templates?: Template[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      template?: Template
      error?: string
    }>
  }

  projects: {
    create: (templateId: string, projectName: string) => Promise<{
      success: boolean
      project?: Project
      error?: string
    }>
    getAll: () => Promise<{
      success: boolean
      projects?: Project[]
      error?: string
    }>
    getById: (id: string) => Promise<{
      success: boolean
      project?: Project
      error?: string
    }>
    delete: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    toggleFavorite: (id: string) => Promise<{
      success: boolean
      isFavorite?: boolean
      error?: string
    }>
    updateLastOpened: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    rename: (id: string, newName: string) => Promise<{
      success: boolean
      project?: Project
      error?: string
    }>
    showInFinder: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
    saveEnvConfig: (id: string, envVars: Record<string, string>) => Promise<{
      success: boolean
      error?: string
    }>
    getEnvConfig: (id: string) => Promise<{
      success: boolean
      envVars?: Record<string, string> | null
      error?: string
    }>
    installDependencies: (id: string) => Promise<{
      success: boolean
      error?: string
    }>
  }

  process: {
    startDevServer: (projectId: string) => Promise<{
      success: boolean
      port?: number
      error?: string
    }>
    stopDevServer: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    restartDevServer: (projectId: string) => Promise<{
      success: boolean
      port?: number
      error?: string
    }>
    getStatus: (projectId: string) => Promise<{
      success: boolean
      status?: ProcessState
      port?: number
      error?: string
    }>
    getOutput: (projectId: string, limit?: number) => Promise<{
      success: boolean
      output?: ProcessOutput[]
      error?: string
    }>
    onStatusChanged: (callback: (projectId: string, status: ProcessState) => void) => () => void
    onOutput: (callback: (projectId: string, output: ProcessOutput) => void) => () => void
    onReady: (callback: (projectId: string, port: number) => void) => () => void
    onError: (callback: (projectId: string, error: any) => void) => () => void
    onCrashed: (callback: (projectId: string, details: any) => void) => () => void
  }

  preview: {
    create: (projectId: string, url: string, bounds: PreviewBounds) => Promise<{
      success: boolean
      error?: string
    }>
    updateBounds: (projectId: string, bounds: PreviewBounds) => Promise<{
      success: boolean
      error?: string
    }>
    refresh: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    toggleDevTools: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    navigate: (projectId: string, url: string) => Promise<{
      success: boolean
      error?: string
    }>
    destroy: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onCreated: (callback: (projectId: string) => void) => () => void
    onLoaded: (callback: (projectId: string) => void) => () => void
    onError: (callback: (projectId: string, error: any) => void) => () => void
    onCrashed: (callback: (projectId: string, details: any) => void) => () => void
    onConsole: (callback: (projectId: string, message: any) => void) => () => void
    onDevToolsToggled: (callback: (projectId: string, isOpen: boolean) => void) => () => void
  }

  shell: {
    openExternal: (url: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
