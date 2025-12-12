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

  // Global shortcut listeners
  onEditModeToggleRequested: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('edit-mode-toggle-requested', listener)
    return () => ipcRenderer.removeListener('edit-mode-toggle-requested', listener)
  },
  onSelectModeToggleRequested: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('select-mode-toggle-requested', listener)
    return () => ipcRenderer.removeListener('select-mode-toggle-requested', listener)
  },
  onScreenshotRequested: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('screenshot-requested', listener)
    return () => ipcRenderer.removeListener('screenshot-requested', listener)
  },
  onGitHubSheetToggleRequested: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('github-sheet-toggle-requested', listener)
    return () => ipcRenderer.removeListener('github-sheet-toggle-requested', listener)
  },

  // Authentication methods
  auth: {
    signInWithGoogle: () => ipcRenderer.invoke('auth:sign-in-google'),
    signInWithFacebook: () => ipcRenderer.invoke('auth:sign-in-facebook'),
    signInWithGithub: () => ipcRenderer.invoke('auth:sign-in-github'),
    handleCallback: (url) => ipcRenderer.invoke('auth:handle-callback', url),
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    signOut: () => ipcRenderer.invoke('auth:sign-out'),
    restoreSession: (userId, userEmail, accessToken) => ipcRenderer.invoke('auth:restore-session', userId, userEmail, accessToken),
    validateUser: (email, userId) => ipcRenderer.invoke('auth:validate-user', email, userId),
    createStripePortal: (sessionData) => ipcRenderer.invoke('auth:create-stripe-portal', sessionData),
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

  secureStorage: {
    set: (key, value) => ipcRenderer.invoke('secure-storage:set', key, value),
    get: (encrypted, isFallback) => ipcRenderer.invoke('secure-storage:get', encrypted, isFallback),
    isAvailable: () => ipcRenderer.invoke('secure-storage:is-available')
  },

  // Template methods
  templates: {
    fetch: () => ipcRenderer.invoke('templates:fetch'),
    getById: (id) => ipcRenderer.invoke('templates:get-by-id', id)
  },

  // Project methods
  projects: {
    create: (templateId, projectName, tempImportProjectId, screenshotData, importType) => ipcRenderer.invoke('project:create', templateId, projectName, tempImportProjectId, screenshotData, importType),
    getAll: () => ipcRenderer.invoke('project:get-all'),
    getById: (id) => ipcRenderer.invoke('project:get-by-id', id),
    delete: (id) => ipcRenderer.invoke('project:delete', id),
    toggleFavorite: (id) => ipcRenderer.invoke('project:toggle-favorite', id),
    updateLastOpened: (id) => ipcRenderer.invoke('project:update-last-opened', id),
    rename: (id, newName) => ipcRenderer.invoke('project:rename', id, newName),
    showInFinder: (id) => ipcRenderer.invoke('project:show-in-finder', id),
    fork: (id) => ipcRenderer.invoke('project:fork', id),
    saveEnvConfig: (id, envVars) => ipcRenderer.invoke('project:save-env-config', id, envVars),
    getEnvConfig: (id) => ipcRenderer.invoke('project:get-env-config', id),
    readEnvFiles: (id) => ipcRenderer.invoke('project:read-env-files', id),
    writeEnvFile: (id, filePath, variables) => ipcRenderer.invoke('project:write-env-file', id, filePath, variables),
    installDependencies: (id) => ipcRenderer.invoke('project:install-dependencies', id),
    saveKanbanState: (id, kanbanState) => ipcRenderer.invoke('project:save-kanban-state', id, kanbanState),
    getKanbanState: (id) => ipcRenderer.invoke('project:get-kanban-state', id),
    saveStickyNotesState: (id, stickyNotesState) => ipcRenderer.invoke('project:save-sticky-notes-state', id, stickyNotesState),
    getStickyNotesState: (id) => ipcRenderer.invoke('project:get-sticky-notes-state', id),
    saveAnalyticsWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-analytics-widget-state', id, widgetState),
    getAnalyticsWidgetState: (id) => ipcRenderer.invoke('project:get-analytics-widget-state', id),
    saveProjectAssetsWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-project-assets-widget-state', id, widgetState),
    getProjectAssetsWidgetState: (id) => ipcRenderer.invoke('project:get-project-assets-widget-state', id),
    saveWhiteboardWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-whiteboard-widget-state', id, widgetState),
    getWhiteboardWidgetState: (id) => ipcRenderer.invoke('project:get-whiteboard-widget-state', id),
    saveWhiteboardData: (id, data) => ipcRenderer.invoke('project:save-whiteboard-data', id, data),
    getWhiteboardData: (id) => ipcRenderer.invoke('project:get-whiteboard-data', id),
    saveIconsWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-icons-widget-state', id, widgetState),
    getIconsWidgetState: (id) => ipcRenderer.invoke('project:get-icons-widget-state', id),
    saveChatWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-chat-widget-state', id, widgetState),
    getChatWidgetState: (id) => ipcRenderer.invoke('project:get-chat-widget-state', id),
    saveBackgroundRemoverWidgetState: (id, widgetState) => ipcRenderer.invoke('project:save-background-remover-widget-state', id, widgetState),
    getBackgroundRemoverWidgetState: (id) => ipcRenderer.invoke('project:get-background-remover-widget-state', id),
    getAssetsStructure: (id) => ipcRenderer.invoke('project:get-assets-structure', id)
  },

  // Listen for dependency install progress
  onDependencyProgress: (callback) => {
    ipcRenderer.on('dependency-install-progress', (_event, data) => callback(data))
  },

  // Process methods
  process: {
    startDevServer: (projectId) => ipcRenderer.invoke('process:start-dev-server', projectId),
    stopDevServer: (projectId) => ipcRenderer.invoke('process:stop-dev-server', projectId),
    restartDevServer: (projectId) => ipcRenderer.invoke('process:restart-dev-server', projectId),
    getStatus: (projectId) => ipcRenderer.invoke('process:get-status', projectId),
    getOutput: (projectId, limit) => ipcRenderer.invoke('process:get-output', projectId, limit),
    getHealthStatus: (projectId) => ipcRenderer.invoke('process:get-health-status', projectId),
    triggerHealthCheck: (projectId) => ipcRenderer.invoke('process:trigger-health-check', projectId),
    setCurrentProject: (projectId) => ipcRenderer.invoke('process:set-current-project', projectId),

    // Process event listeners
    onStatusChanged: (callback) => {
      const listener = (_event, projectId, status) => callback(projectId, status)
      ipcRenderer.on('process-status-changed', listener)
      return () => ipcRenderer.removeListener('process-status-changed', listener)
    },
    onOutput: (callback) => {
      const listener = (_event, projectId, output) => callback(projectId, output)
      ipcRenderer.on('process-output', listener)
      return () => ipcRenderer.removeListener('process-output', listener)
    },
    onReady: (callback) => {
      const listener = (_event, projectId, port) => callback(projectId, port)
      ipcRenderer.on('process-ready', listener)
      return () => ipcRenderer.removeListener('process-ready', listener)
    },
    onError: (callback) => {
      const listener = (_event, projectId, error) => callback(projectId, error)
      ipcRenderer.on('process-error', listener)
      return () => ipcRenderer.removeListener('process-error', listener)
    },
    onCrashed: (callback) => {
      const listener = (_event, projectId, details) => callback(projectId, details)
      ipcRenderer.on('process-crashed', listener)
      return () => ipcRenderer.removeListener('process-crashed', listener)
    },
    onHealthChanged: (callback) => {
      const listener = (_event, projectId, healthStatus) => callback(projectId, healthStatus)
      ipcRenderer.on('process-health-changed', listener)
      return () => ipcRenderer.removeListener('process-health-changed', listener)
    },
    onHealthCritical: (callback) => {
      const listener = (_event, projectId, healthStatus) => callback(projectId, healthStatus)
      ipcRenderer.on('process-health-critical', listener)
      return () => ipcRenderer.removeListener('process-health-critical', listener)
    }
  },

  // Preview methods
  preview: {
    create: (projectId, url, bounds) => ipcRenderer.invoke('preview:create', projectId, url, bounds),
    updateBounds: (projectId, bounds) => ipcRenderer.invoke('preview:update-bounds', projectId, bounds),
    refresh: (projectId) => ipcRenderer.invoke('preview:refresh', projectId),
    toggleDevTools: (projectId, isMobile, layoutState) => ipcRenderer.invoke('preview:toggle-devtools', projectId, isMobile, layoutState),
    navigate: (projectId, url) => ipcRenderer.invoke('preview:navigate', projectId, url),
    destroy: (projectId) => ipcRenderer.invoke('preview:destroy', projectId),
    hide: (projectId) => ipcRenderer.invoke('preview:hide', projectId),
    show: (projectId) => ipcRenderer.invoke('preview:show', projectId),
    enableDeviceEmulation: (projectId, device) => ipcRenderer.invoke('preview:enable-device-emulation', projectId, device),
    disableDeviceEmulation: (projectId) => ipcRenderer.invoke('preview:disable-device-emulation', projectId),
    injectCSS: (projectId, css) => ipcRenderer.invoke('preview:inject-css', projectId, css),
    removeCSS: (projectId) => ipcRenderer.invoke('preview:remove-css', projectId),
    executeJavaScript: (projectId, code) => ipcRenderer.invoke('preview:execute-javascript', projectId, code),
    captureScreenshot: (projectId) => ipcRenderer.invoke('preview:capture-screenshot', projectId),
    hasPreview: (projectId) => ipcRenderer.invoke('preview:has-preview', projectId),
    waitForPreview: (projectId, timeoutMs) => ipcRenderer.invoke('preview:wait-for-preview', projectId, timeoutMs),
    bringToTop: (projectId) => ipcRenderer.invoke('preview:bring-to-top', projectId),
    sendToBack: (projectId) => ipcRenderer.invoke('preview:send-to-back', projectId),

    // Preview event listeners
    onCreated: (callback) => {
      const listener = (_event, projectId) => callback(projectId)
      ipcRenderer.on('preview-created', listener)
      return () => ipcRenderer.removeListener('preview-created', listener)
    },
    onLoaded: (callback) => {
      const listener = (_event, projectId) => callback(projectId)
      ipcRenderer.on('preview-loaded', listener)
      return () => ipcRenderer.removeListener('preview-loaded', listener)
    },
    onError: (callback) => {
      const listener = (_event, projectId, error) => callback(projectId, error)
      ipcRenderer.on('preview-error', listener)
      return () => ipcRenderer.removeListener('preview-error', listener)
    },
    onCrashed: (callback) => {
      const listener = (_event, projectId, details) => callback(projectId, details)
      ipcRenderer.on('preview-crashed', listener)
      return () => ipcRenderer.removeListener('preview-crashed', listener)
    },
    onConsole: (callback) => {
      const listener = (_event, projectId, message) => callback(projectId, message)
      ipcRenderer.on('preview-console', listener)
      return () => ipcRenderer.removeListener('preview-console', listener)
    },
    onDevToolsToggled: (callback) => {
      const listener = (_event, projectId, isOpen) => callback(projectId, isOpen)
      ipcRenderer.on('preview-devtools-toggled', listener)
      return () => ipcRenderer.removeListener('preview-devtools-toggled', listener)
    }
  },

  // Image methods
  image: {
    replace: (projectId, imagePath, imageData) => ipcRenderer.invoke('image:replace', projectId, imagePath, imageData),
    cropAndReplace: (projectId, imagePath, sourceImage, cropData) => ipcRenderer.invoke('image:cropAndReplace', projectId, imagePath, sourceImage, cropData)
  },

  // Audio methods
  audio: {
    cropAudio: (options) => ipcRenderer.invoke('audio:crop', options)
  },

  // Terminal methods
  terminal: {
    createSession: (projectId) => ipcRenderer.invoke('terminal:create-session', projectId),
    writeInput: (projectId, input) => ipcRenderer.invoke('terminal:write-input', projectId, input),
    resize: (projectId, cols, rows) => ipcRenderer.invoke('terminal:resize', projectId, cols, rows),
    getHistory: (projectId, limit) => ipcRenderer.invoke('terminal:get-history', projectId, limit),
    clear: (projectId) => ipcRenderer.invoke('terminal:clear', projectId),
    destroySession: (projectId) => ipcRenderer.invoke('terminal:destroy-session', projectId),

    // Terminal event listeners
    onLine: (callback) => {
      const listener = (_event, projectId, line) => callback(projectId, line)
      ipcRenderer.on('terminal:line', listener)
      return () => ipcRenderer.removeListener('terminal:line', listener)
    },
    onCleared: (callback) => {
      const listener = (_event, projectId) => callback(projectId)
      ipcRenderer.on('terminal:cleared', listener)
      return () => ipcRenderer.removeListener('terminal:cleared', listener)
    },
    onExit: (callback) => {
      const listener = (_event, projectId, exitCode, signal) => callback(projectId, exitCode, signal)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    },

    // Interactive terminal methods (for raw terminal tabs)
    createInteractiveSession: (projectId, terminalId) => ipcRenderer.invoke('terminal:create-interactive-session', projectId, terminalId),
    writeInteractiveInput: (projectId, terminalId, input) => ipcRenderer.invoke('terminal:write-interactive-input', projectId, terminalId, input),
    resizeInteractive: (projectId, terminalId, cols, rows) => ipcRenderer.invoke('terminal:resize-interactive', projectId, terminalId, cols, rows),
    destroyInteractiveSession: (projectId, terminalId) => ipcRenderer.invoke('terminal:destroy-interactive-session', projectId, terminalId),

    onInteractiveOutput: (callback) => {
      const listener = (_event, projectId, terminalId, data) => callback(projectId, terminalId, data)
      ipcRenderer.on('terminal:interactive-output', listener)
      return () => ipcRenderer.removeListener('terminal:interactive-output', listener)
    },
    onInteractiveExit: (callback) => {
      const listener = (_event, projectId, terminalId, exitCode, signal) => callback(projectId, terminalId, exitCode, signal)
      ipcRenderer.on('terminal:interactive-exit', listener)
      return () => ipcRenderer.removeListener('terminal:interactive-exit', listener)
    }
  },

  // Claude Code methods
  claude: {
    startSession: (projectId, prompt, model, attachments, thinkingEnabled, planMode) => ipcRenderer.invoke('claude:start-session', projectId, prompt, model, attachments, thinkingEnabled, planMode),
    sendPrompt: (projectId, prompt, model, attachments, thinkingEnabled, planMode) => ipcRenderer.invoke('claude:send-prompt', projectId, prompt, model, attachments, thinkingEnabled, planMode),
    getStatus: (projectId) => ipcRenderer.invoke('claude:get-status', projectId),
    getContext: (projectId) => ipcRenderer.invoke('claude:get-context', projectId),
    changeModel: (projectId, modelName) => ipcRenderer.invoke('claude:change-model', projectId, modelName),
    getModels: (projectId) => ipcRenderer.invoke('claude:get-models', projectId),
    clearSession: (projectId) => ipcRenderer.invoke('claude:clear-session', projectId),
    destroySession: (projectId) => ipcRenderer.invoke('claude:destroy-session', projectId),

    // Claude event listeners
    onStatusChanged: (callback) => {
      const listener = (_event, projectId, status) => callback(projectId, status)
      ipcRenderer.on('claude:status-changed', listener)
      return () => ipcRenderer.removeListener('claude:status-changed', listener)
    },
    onCompleted: (callback) => {
      const listener = (_event, projectId) => callback(projectId)
      ipcRenderer.on('claude:completed', listener)
      return () => ipcRenderer.removeListener('claude:completed', listener)
    },
    onError: (callback) => {
      const listener = (_event, projectId, error) => callback(projectId, error)
      ipcRenderer.on('claude:error', listener)
      return () => ipcRenderer.removeListener('claude:error', listener)
    },
    onExited: (callback) => {
      const listener = (_event, projectId, exitCode) => callback(projectId, exitCode)
      ipcRenderer.on('claude:exited', listener)
      return () => ipcRenderer.removeListener('claude:exited', listener)
    },
    onContextUpdated: (callback) => {
      const listener = (_event, projectId, context) => callback(projectId, context)
      ipcRenderer.on('claude:context-updated', listener)
      return () => ipcRenderer.removeListener('claude:context-updated', listener)
    },
    onModelChanged: (callback) => {
      const listener = (_event, projectId, model) => callback(projectId, model)
      ipcRenderer.on('claude:model-changed', listener)
      return () => ipcRenderer.removeListener('claude:model-changed', listener)
    },
    onQuestions: (callback) => {
      const listener = (_event, projectId, questions) => callback(projectId, questions)
      ipcRenderer.on('claude:questions', listener)
      return () => ipcRenderer.removeListener('claude:questions', listener)
    }
  },

  // Chat history methods
  chat: {
    createBlock: (projectId, userPrompt) => ipcRenderer.invoke('chat:create-block', projectId, userPrompt),
    updateBlock: (blockId, updates) => ipcRenderer.invoke('chat:update-block', blockId, updates),
    completeBlock: (blockId) => ipcRenderer.invoke('chat:complete-block', blockId),
    getHistory: (projectId, limit, offset) => ipcRenderer.invoke('chat:get-history', projectId, limit, offset),
    getBlock: (blockId) => ipcRenderer.invoke('chat:get-block', blockId),
    deleteHistory: (projectId) => ipcRenderer.invoke('chat:delete-history', projectId),
    createInitializationBlock: (projectId, templateName, stages, sourceProjectName) => ipcRenderer.invoke('chat:create-initialization-block', projectId, templateName, stages, sourceProjectName),
    updateInitializationBlock: (projectId, stages, isComplete, commitHash) => ipcRenderer.invoke('chat:update-initialization-block', projectId, stages, isComplete, commitHash),

    // Chat event listeners
    onBlockCreated: (callback) => {
      const listener = (_event, projectId, block) => callback(projectId, block)
      ipcRenderer.on('chat:block-created', listener)
      return () => ipcRenderer.removeListener('chat:block-created', listener)
    },
    onBlockUpdated: (callback) => {
      const listener = (_event, projectId, block) => callback(projectId, block)
      ipcRenderer.on('chat:block-updated', listener)
      return () => ipcRenderer.removeListener('chat:block-updated', listener)
    },
    onBlockCompleted: (callback) => {
      const listener = (_event, projectId, block) => callback(projectId, block)
      ipcRenderer.on('chat:block-completed', listener)
      return () => ipcRenderer.removeListener('chat:block-completed', listener)
    },
    onHistoryDeleted: (callback) => {
      const listener = (_event, projectId) => callback(projectId)
      ipcRenderer.on('chat:history-deleted', listener)
      return () => ipcRenderer.removeListener('chat:history-deleted', listener)
    }
  },

  // ChatWidget AI methods (chat/image generation)
  chatWidget: {
    getModels: () => ipcRenderer.invoke('chatWidget:get-models'),
    getUsage: () => ipcRenderer.invoke('chatWidget:get-usage'),
    chat: (messages, model) => ipcRenderer.invoke('chatWidget:chat', messages, model),
    generateImage: (projectId, prompt, size) => ipcRenderer.invoke('chatWidget:generate-image', projectId, prompt, size),

    // Conversation persistence
    getConversations: (projectId) => ipcRenderer.invoke('chatWidget:get-conversations', projectId),
    createConversation: (projectId, title, messages, modelCategory, model) => ipcRenderer.invoke('chatWidget:create-conversation', projectId, title, messages, modelCategory, model),
    updateConversation: (conversationId, title, messages) => ipcRenderer.invoke('chatWidget:update-conversation', conversationId, title, messages),
    deleteConversation: (conversationId) => ipcRenderer.invoke('chatWidget:delete-conversation', conversationId),

    // Streaming event listeners
    onStreamChunk: (callback) => {
      const listener = (_event, chunk) => callback(chunk)
      ipcRenderer.on('chatWidget:stream-chunk', listener)
      return () => ipcRenderer.removeListener('chatWidget:stream-chunk', listener)
    },
    onStreamDone: (callback) => {
      const listener = (_event, usage) => callback(usage)
      ipcRenderer.on('chatWidget:stream-done', listener)
      return () => ipcRenderer.removeListener('chatWidget:stream-done', listener)
    },
    onStreamError: (callback) => {
      const listener = (_event, error) => callback(error)
      ipcRenderer.on('chatWidget:stream-error', listener)
      return () => ipcRenderer.removeListener('chatWidget:stream-error', listener)
    },
    removeStreamListeners: () => {
      ipcRenderer.removeAllListeners('chatWidget:stream-chunk')
      ipcRenderer.removeAllListeners('chatWidget:stream-done')
      ipcRenderer.removeAllListeners('chatWidget:stream-error')
    }
  },

  // Background Remover methods
  backgroundRemover: {
    remove: (imageBase64, projectId) => ipcRenderer.invoke('backgroundRemover:remove', imageBase64, projectId),
    saveState: (projectId, state) => ipcRenderer.invoke('backgroundRemover:saveState', projectId, state),
    loadState: (projectId) => ipcRenderer.invoke('backgroundRemover:loadState', projectId)
  },

  // Claude CLI methods (installation/auth check)
  claudeCli: {
    checkStatus: () => ipcRenderer.invoke('claude-cli:check-status'),
    isInstalled: () => ipcRenderer.invoke('claude-cli:is-installed'),
    login: () => ipcRenderer.invoke('claude-cli:login'),
    openInstallUrl: () => ipcRenderer.invoke('claude-cli:open-install-url')
  },

  // Git methods
  git: {
    checkGhCli: () => ipcRenderer.invoke('git:check-gh-cli'),
    getStatus: (projectId) => ipcRenderer.invoke('git:get-status', projectId),
    getRemote: (projectId) => ipcRenderer.invoke('git:get-remote', projectId),
    getLog: (projectId) => ipcRenderer.invoke('git:get-log', projectId),
    getUnpushed: (projectId) => ipcRenderer.invoke('git:get-unpushed', projectId),
    getHeadCommit: (projectId) => ipcRenderer.invoke('git:get-head-commit', projectId),
    push: (projectId) => ipcRenderer.invoke('git:push', projectId),
    initialCommit: (projectId, message) => ipcRenderer.invoke('git:initial-commit', projectId, message),
    commitAndPush: (projectId, message) => ipcRenderer.invoke('git:commit-and-push', projectId, message),
    createRepo: (projectId, repoName, description, isPrivate) => ipcRenderer.invoke('git:create-repo', projectId, repoName, description, isPrivate),
    revertAndPush: (projectId, commitHash) => ipcRenderer.invoke('git:revert-and-push', projectId, commitHash),
    restoreCheckpoint: (projectId, commitHash) => ipcRenderer.invoke('git:restore-checkpoint', projectId, commitHash),
    // Event listener for when a commit is made (for deployment status updates)
    onCommitted: (callback) => {
      const listener = (_event, projectId, commitHash) => callback(projectId, commitHash)
      ipcRenderer.on('git:committed', listener)
      return () => ipcRenderer.removeListener('git:committed', listener)
    }
  },

  // Research Agent methods
  researchAgent: {
    start: (projectId, agentType, task, model, attachments) => ipcRenderer.invoke('research-agent:start', projectId, agentType, task, model, attachments),
    stop: (agentId) => ipcRenderer.invoke('research-agent:stop', agentId),
    getList: (projectId) => ipcRenderer.invoke('research-agent:get-list', projectId),
    getFullHistory: (agentId) => ipcRenderer.invoke('research-agent:get-full-history', agentId),
    delete: (agentId) => ipcRenderer.invoke('research-agent:delete', agentId),

    // Research Agent event listeners
    onStatusChanged: (callback) => {
      const listener = (_event, agentId, projectId, status, agent) => callback(agentId, projectId, status, agent)
      ipcRenderer.on('research-agent:status-changed', listener)
      return () => ipcRenderer.removeListener('research-agent:status-changed', listener)
    },
    onCompleted: (callback) => {
      const listener = (_event, agentId, projectId) => callback(agentId, projectId)
      ipcRenderer.on('research-agent:completed', listener)
      return () => ipcRenderer.removeListener('research-agent:completed', listener)
    },
    onEvent: (callback) => {
      const listener = (_event, agentId, projectId, type, message) => callback(agentId, projectId, type, message)
      ipcRenderer.on('research-agent:event', listener)
      return () => ipcRenderer.removeListener('research-agent:event', listener)
    }
  },

  // App methods
  app: {
    flashWindow: () => ipcRenderer.send('app:flash-window'),
    getCrashLogs: () => ipcRenderer.invoke('app:get-crash-logs'),
    clearCrashLogs: () => ipcRenderer.invoke('app:clear-crash-logs')
  },

  // Auto-update methods
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    checkSilent: () => ipcRenderer.invoke('update:check-silent'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),

    // Update event listeners
    onChecking: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('update:checking', listener)
      return () => ipcRenderer.removeListener('update:checking', listener)
    },
    onAvailable: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('update:available', listener)
      return () => ipcRenderer.removeListener('update:available', listener)
    },
    onNotAvailable: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('update:not-available', listener)
      return () => ipcRenderer.removeListener('update:not-available', listener)
    },
    onProgress: (callback) => {
      const listener = (_event, progress) => callback(progress)
      ipcRenderer.on('update:download-progress', listener)
      return () => ipcRenderer.removeListener('update:download-progress', listener)
    },
    onDownloaded: (callback) => {
      const listener = (_event, info) => callback(info)
      ipcRenderer.on('update:downloaded', listener)
      return () => ipcRenderer.removeListener('update:downloaded', listener)
    },
    onError: (callback) => {
      const listener = (_event, error) => callback(error)
      ipcRenderer.on('update:error', listener)
      return () => ipcRenderer.removeListener('update:error', listener)
    }
  },

  // Keywords for educational tooltips
  keywords: {
    getAll: () => ipcRenderer.invoke('keywords:get-all')
  },

  // Website Import
  websiteImport: {
    analyze: (url) => ipcRenderer.invoke('website-import:analyze', url),
    cleanup: (tempProjectId) => ipcRenderer.invoke('website-import:cleanup', tempProjectId),
    checkImportStatus: (projectId) => ipcRenderer.invoke('website-import:check-status', projectId),
    markMigrationComplete: (projectId) => ipcRenderer.invoke('website-import:mark-complete', projectId)
  },

  // Prompts (for import addendums)
  prompts: {
    getImportAddendum: (importType) => ipcRenderer.invoke('prompts:get-import-addendum', importType)
  },

  // Layout methods
  layout: {
    setState: (state, projectId) => ipcRenderer.invoke('layout:set-state', state, projectId),
    cycleState: (projectId) => ipcRenderer.invoke('layout:cycle-state', projectId),
    getState: () => ipcRenderer.invoke('layout:get-state'),
    captureThumbnail: (projectId) => ipcRenderer.invoke('layout:capture-thumbnail', projectId),
    setActionBarHeight: (height) => ipcRenderer.invoke('layout:set-actionbar-height', height),
    setViewMode: (viewMode) => ipcRenderer.invoke('layout:set-view-mode', viewMode),
    captureModalFreeze: (projectId) => ipcRenderer.invoke('layout:capture-modal-freeze', projectId),
    getCachedModalFreeze: (projectId) => ipcRenderer.invoke('layout:get-cached-modal-freeze', projectId),
    clearModalFreezeCache: (projectId) => ipcRenderer.invoke('layout:clear-modal-freeze-cache', projectId),

    // Layout event listeners
    onStateChanged: (callback) => {
      const listener = (_event, newState, previousState, thumbnail) => callback(newState, previousState, thumbnail)
      ipcRenderer.on('layout-state-changed', listener)
      return () => ipcRenderer.removeListener('layout-state-changed', listener)
    },
    onCycleRequested: (callback) => {
      const listener = () => callback()
      ipcRenderer.on('layout-cycle-requested', listener)
      return () => ipcRenderer.removeListener('layout-cycle-requested', listener)
    },
    onActionBarHeightChanged: (callback) => {
      const listener = (_event, height) => callback(height)
      ipcRenderer.on('layout-actionbar-height-changed', listener)
      return () => ipcRenderer.removeListener('layout-actionbar-height-changed', listener)
    }
  },

  // CLAUDE.md management methods
  claudeMd: {
    getAddendum: (projectId) => ipcRenderer.invoke('claude-md:get-addendum', projectId),
    saveAddendum: (projectId, addendum) => ipcRenderer.invoke('claude-md:save-addendum', projectId, addendum),
    removeAddendum: (projectId) => ipcRenderer.invoke('claude-md:remove-addendum', projectId)
  },

  // File methods
  files: {
    replaceTextInProject: (projectId, originalText, newText) => ipcRenderer.invoke('files:replace-text-in-project', projectId, originalText, newText),
    replaceTextBySelector: (projectId, elementInfo, originalText, newText) => ipcRenderer.invoke('files:replace-text-by-selector', projectId, elementInfo, originalText, newText),
    readFileAsBase64: (filePath) => ipcRenderer.invoke('files:read-as-base64', filePath),
    saveBase64Image: (filePath, base64Data) => ipcRenderer.invoke('files:save-base64-image', filePath, base64Data),
    renameFile: (filePath, newName) => ipcRenderer.invoke('files:rename', filePath, newName),
    findElementLocation: (projectId, elementInfo) => ipcRenderer.invoke('files:find-element-location', projectId, elementInfo)
  },

  // Analytics methods
  analytics: {
    getData: (projectId, timeRange) => ipcRenderer.invoke('analytics:get-data', projectId, timeRange),
    getActiveUsers: (projectId) => ipcRenderer.invoke('analytics:get-active-users', projectId)
  },

  // Shell methods
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
    openPath: (path) => ipcRenderer.invoke('shell:open-path', path),
    showItemInFolder: (path) => ipcRenderer.invoke('shell:show-item-in-folder', path)
  },

  // Deployment token methods (global, not project-specific)
  deployment: {
    saveToken: (serviceId, token) => ipcRenderer.invoke('deployment:save-token', serviceId, token),
    getToken: (serviceId) => ipcRenderer.invoke('deployment:get-token', serviceId),
    isConnected: (serviceId) => ipcRenderer.invoke('deployment:is-connected', serviceId),
    getConnectedServices: () => ipcRenderer.invoke('deployment:get-connected-services'),
    disconnect: (serviceId) => ipcRenderer.invoke('deployment:disconnect', serviceId),
    getCliStatus: () => ipcRenderer.invoke('deployment:get-cli-status'),
    isCliAvailable: (provider) => ipcRenderer.invoke('deployment:is-cli-available', provider),
    deploy: (projectId, provider) => ipcRenderer.invoke('deployment:deploy', projectId, provider),

    // Deployment event listeners
    onStarted: (callback) => {
      const listener = (_event, projectId, provider, projectName) => callback(projectId, provider, projectName)
      ipcRenderer.on('deployment:started', listener)
      return () => ipcRenderer.removeListener('deployment:started', listener)
    },
    onProgress: (callback) => {
      const listener = (_event, projectId, message) => callback(projectId, message)
      ipcRenderer.on('deployment:progress', listener)
      return () => ipcRenderer.removeListener('deployment:progress', listener)
    },
    onComplete: (callback) => {
      const listener = (_event, projectId, result) => callback(projectId, result)
      ipcRenderer.on('deployment:complete', listener)
      return () => ipcRenderer.removeListener('deployment:complete', listener)
    }
  }
})
