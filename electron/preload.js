const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add IPC methods here as we develop features
  send: (channel, data) => {
    ipcRenderer.send(channel, data)
  },
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args))
  },
  invoke: (channel, ...args) => {
    return ipcRenderer.invoke(channel, ...args)
  },

  // Authentication methods
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke('auth:sign-in-google'),
    signInWithFacebook: () => ipcRenderer.invoke('auth:sign-in-facebook'),
    signInWithGithub: () => ipcRenderer.invoke('auth:sign-in-github'),
    handleCallback: (url) => ipcRenderer.invoke('auth:handle-callback', url),
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    signOut: () => ipcRenderer.invoke('auth:sign-out'),
    onCallback: (callback) => {
      const listener = (event, url) => callback(url)
      ipcRenderer.on('auth:callback', listener)
      return () => ipcRenderer.removeListener('auth:callback', listener)
    },
    onAuthSuccess: (callback) => {
      const listener = (event, result) => callback(result)
      ipcRenderer.on('auth:success', listener)
      return () => ipcRenderer.removeListener('auth:success', listener)
    },
    onAuthError: (callback) => {
      const listener = (event, result) => callback(result)
      ipcRenderer.on('auth:error', listener)
      return () => ipcRenderer.removeListener('auth:error', listener)
    }
  },

  // Template methods
  templates: {
    fetch: () => ipcRenderer.invoke('templates:fetch'),
    getById: (id) => ipcRenderer.invoke('templates:get-by-id', id)
  },

  // Project methods
  projects: {
    create: (templateId, projectName) => ipcRenderer.invoke('project:create', templateId, projectName),
    getAll: () => ipcRenderer.invoke('project:get-all'),
    getById: (id) => ipcRenderer.invoke('project:get-by-id', id),
    delete: (id) => ipcRenderer.invoke('project:delete', id),
    toggleFavorite: (id) => ipcRenderer.invoke('project:toggle-favorite', id),
    updateLastOpened: (id) => ipcRenderer.invoke('project:update-last-opened', id),
    rename: (id, newName) => ipcRenderer.invoke('project:rename', id, newName),
    showInFinder: (id) => ipcRenderer.invoke('project:show-in-finder', id),
    saveEnvConfig: (id, envVars) => ipcRenderer.invoke('project:save-env-config', id, envVars),
    getEnvConfig: (id) => ipcRenderer.invoke('project:get-env-config', id),
    installDependencies: (id) => ipcRenderer.invoke('project:install-dependencies', id)
  },

  // Listen for dependency install progress
  onDependencyProgress: (callback) => {
    ipcRenderer.on('dependency-install-progress', (_event, data) => callback(data))
  }
})
