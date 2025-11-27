export type Priority = 'Low' | 'Medium' | 'High' | 'Important' | 'Critical' | 'Off track'

export interface TemplateLibrary {
  name: string
  description: string
}

export interface EnvFile {
  path: string
  label: string
  description: string
}

export interface Template {
  _id: string
  id: string
  name: string
  description: string
  longDescription?: string
  type: 'frontend' | 'fullstack' | 'backend'
  category: string
  githubUrl: string
  requiredPlan: 'free' | 'plus' | 'premium'
  requiredServices: string[]
  demoUrl?: string
  techStack: string[]
  libraries?: TemplateLibrary[]
  screenshot?: string
  envFiles?: EnvFile[]
  deployServices?: string[]
}

export interface Project {
  id: string
  name: string
  path: string
  templateId: string
  templateName: string
  techStack?: string | null // JSON array of tech stack items
  status: 'creating' | 'ready' | 'error'
  isFavorite?: boolean
  configCompleted: boolean
  envVars: string | null
  dependenciesInstalled: boolean
  envFiles?: string | null // JSON array of { path, label, description }
  deployServices?: string | null // JSON array of deployment services
  createdAt: number
  lastOpenedAt: number | null
}

export type ProcessState = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'error'

export interface HealthCheckStatus {
  healthy: boolean
  checks: {
    httpResponding: { status: 'pass' | 'fail' | 'pending'; message: string }
    processAlive: { status: 'pass' | 'fail'; message: string }
    portListening: { status: 'pass' | 'fail'; message: string }
  }
  lastChecked: Date
  consecutiveFailures: number
}

export type ClaudeStatus = 'idle' | 'starting' | 'running' | 'completed' | 'error'

export type LayoutState = 'DEFAULT' | 'TOOLS' | 'BROWSER_FULL'

export enum InteractionType {
  USER_MESSAGE = 'user_message',           // Regular user message
  CLAUDE_RESPONSE = 'claude_response',     // Claude's response
  PLAN_READY = 'plan_ready',               // Claude's plan (with ExitPlanMode)
  QUESTIONS = 'questions',                 // Claude asks questions
  ANSWERS = 'answers',                     // User answers questions
  PLAN_APPROVAL = 'plan_approval',         // User approves plan
  IMPLEMENTATION = 'implementation',       // Claude implements after approval
  CHECKPOINT_RESTORE = 'checkpoint_restore' // Restore checkpoint action
}

export interface ClaudeAttachment {
  type: 'image' | 'document'
  data: string // base64 encoded
  mediaType: string // e.g., 'image/jpeg', 'image/png', 'application/pdf'
  name?: string
}

export interface ClaudeContext {
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
  }
  baseline: {
    systemPrompt: number
    systemTools: number
    memoryFiles: number
    messages: number
  }
  cost: number
  turns: number
  model: string
  contextWindow: number
}

export interface ClaudeModel {
  value: string
  displayName: string
  description: string
}

export interface ProcessOutput {
  timestamp: Date
  type: 'stdout' | 'stderr'
  message: string
  raw: string
}

export interface TerminalLine {
  timestamp: Date
  source: 'dev-server' | 'shell' | 'npm' | 'git' | 'claude' | 'system'
  type: 'stdout' | 'stderr'
  message: string
  raw?: string
}

export interface PreviewBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface SupportMessage {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  type: 'user' | 'support'
  content: string
  timestamp: Date
  read: boolean
}

export interface SupportSession {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  messages: SupportMessage[]
  status: 'active' | 'resolved'
  createdAt: Date
  updatedAt: Date
}

export interface SupportQueueEntry {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  lastMessage: string
  status: 'waiting' | 'in-progress' | 'resolved'
  createdAt: Date
  assignedTo?: string
}

export interface SupportOfflineMessage {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  subject: string
  message: string
  status: 'new' | 'read' | 'replied'
  createdAt: Date
}

export interface SupportStatus {
  _id: 'status'
  available: boolean
}

export interface BugReport {
  _id?: string
  userId: string
  userName: string
  userEmail: string
  projectId?: string
  bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
  title: string
  description: string
  stepsToReproduce?: string
  status: 'new' | 'investigating' | 'in-progress' | 'resolved' | 'wont-fix'
  createdAt: Date
  updatedAt: Date
}

export interface ChatBlock {
  id: string
  projectId: string
  blockIndex: number
  userPrompt: string
  claudeMessages: string | null // JSON array of Claude text messages
  toolExecutions: string | null // JSON array of individual tool executions (while working) or grouped (when complete)
  commitHash: string | null
  filesChanged: number | null
  completionStats: string | null // JSON with { timeSeconds, inputTokens, outputTokens, cost }
  summary: string | null // Claude's summary at the end
  actions: string | null // JSON array of post-completion actions like git commits, builds, etc.
  completedAt: number | null
  isComplete: boolean
  interactionType: string | null // Type of interaction: user_message, claude_response, plan_ready, questions, answers, plan_approval, implementation, checkpoint_restore
  createdAt: number
}

// Window interface extension for screenshot callback and Excalidraw
declare global {
  interface Window {
    onScreenshotSend?: (screenshotSrc: string, description: string) => void
    EXCALIDRAW_ASSET_PATH?: string
  }
}

export interface ElectronAPI {
  send: (channel: string, data: any) => void
  receive: (channel: string, func: (...args: any[]) => void) => void
  invoke: (channel: string, ...args: any[]) => Promise<any>
  onDependencyProgress: (callback: (data: string) => void) => void
  onEditModeToggleRequested: (callback: () => void) => () => void
  onScreenshotRequested: (callback: () => void) => () => void
  onGitHubSheetToggleRequested: (callback: () => void) => () => void

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
    restoreSession: (userId: string) => Promise<{ success: boolean; error?: string }>
    validateUser: (email: string, userId: string) => Promise<{
      success: boolean
      user?: {
        id: string
        email: string
        name: string
        photoUrl?: string
        plan: 'free' | 'plus' | 'premium'
      }
      error?: string
    }>
    onCallback: (callback: (url: string) => void) => () => void
    onAuthSuccess: (callback: (result: any) => void) => () => void
    onAuthError: (callback: (result: any) => void) => () => void
    createStripePortal: (session: any) => Promise<{ success: boolean; url?: string; error?: string }>
  }

  secureStorage: {
    set: (key: string, value: string) => Promise<{
      success: boolean
      encrypted?: string
      fallback?: boolean
      error?: string
    }>
    get: (encrypted: string, isFallback?: boolean) => Promise<{
      success: boolean
      value?: string
      error?: string
    }>
    isAvailable: () => Promise<{
      success: boolean
      available?: boolean
    }>
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
    create: (templateId: string, projectName: string, tempImportProjectId?: string, screenshotData?: string, importType?: 'template' | 'screenshot' | 'ai') => Promise<{
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
      reason?: 'claude_active'
      claudeStatus?: ClaudeStatus
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
    saveKanbanState: (id: string, kanbanState: {
      enabled: boolean;
      position: { x: number; y: number };
      size: { width: number; height: number };
      columns: Array<{
        id: string;
        title: string;
        cards: Array<{
          id: string;
          title: string;
          content: string;
          priority: string;
        }>;
      }>;
      zIndex: number;
    }) => Promise<{
      success: boolean
      error?: string
    }>
    getKanbanState: (id: string) => Promise<{
      success: boolean
      kanbanState?: {
        enabled: boolean;
        position: { x: number; y: number };
        size: { width: number; height: number };
        columns: Array<{
          id: string;
          title: string;
          cards: Array<{
            id: string;
            title: string;
            content: string;
            priority: Priority;
          }>;
        }>;
        zIndex: number;
      } | null
      error?: string
    }>
    saveStickyNotesState: (id: string, stickyNotesState: {
      notes: Array<{
        id: string;
        position: { x: number; y: number };
        content: string;
        color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green';
        stickyText: boolean;
        zIndex: number;
      }>;
    }) => Promise<{
      success: boolean
      error?: string
    }>
    getStickyNotesState: (id: string) => Promise<{
      success: boolean
      stickyNotesState?: {
        notes: Array<{
          id: string;
          position: { x: number; y: number };
          content: string;
          color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green';
          stickyText: boolean;
          zIndex: number;
        }>;
      } | null
      error?: string
    }>
    saveAnalyticsWidgetState: (id: string, widgetState: {
      enabled: boolean;
      position: { x: number; y: number };
      size: { width: number; height: number };
      zIndex: number;
    }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getAnalyticsWidgetState: (id: string) => Promise<{
      success: boolean;
      widgetState?: {
        enabled: boolean;
        position: { x: number; y: number };
        size: { width: number; height: number };
        zIndex: number;
      } | null;
      error?: string;
    }>;
    saveProjectAssetsWidgetState: (id: string, widgetState: {
      enabled: boolean;
      position: { x: number; y: number };
      zIndex: number;
    }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getProjectAssetsWidgetState: (id: string) => Promise<{
      success: boolean;
      widgetState?: {
        enabled: boolean;
        position: { x: number; y: number };
        zIndex: number;
      } | null;
      error?: string;
    }>;
    saveWhiteboardWidgetState: (id: string, widgetState: {
      enabled: boolean;
      position: { x: number; y: number };
      size: { width: number; height: number };
      zIndex: number;
    }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getWhiteboardWidgetState: (id: string) => Promise<{
      success: boolean;
      widgetState?: {
        enabled: boolean;
        position: { x: number; y: number };
        size: { width: number; height: number };
        zIndex: number;
      } | null;
      error?: string;
    }>;
    saveWhiteboardData: (id: string, data: { elements: any[]; appState: any; files: any }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getWhiteboardData: (id: string) => Promise<{
      success: boolean;
      data?: { elements: any[]; appState: any; files: any } | null;
      error?: string;
    }>;
    saveIconsWidgetState: (id: string, widgetState: {
      enabled: boolean;
      position: { x: number; y: number };
      size: { width: number; height: number };
      zIndex: number;
    }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getIconsWidgetState: (id: string) => Promise<{
      success: boolean;
      widgetState?: {
        enabled: boolean;
        position: { x: number; y: number };
        size: { width: number; height: number };
        zIndex: number;
      } | null;
      error?: string;
    }>;
    getAssetsStructure: (id: string) => Promise<{
      success: boolean;
      assets?: Array<{
        name: string;
        type: 'folder' | 'file';
        children?: any[];
        fileType?: 'image' | 'audio' | 'font' | 'other';
        size?: string;
        dimensions?: string;
        path?: string;
      }>;
      error?: string;
    }>;
    readEnvFiles: (id: string) => Promise<{
      success: boolean;
      envFiles?: Array<{
        path: string;
        label: string;
        description: string;
        variables: Record<string, string>;
        exists: boolean;
      }>;
      error?: string;
    }>;
    writeEnvFile: (id: string, filePath: string, variables: Record<string, string>) => Promise<{
      success: boolean;
      error?: string;
    }>;
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
    getHealthStatus: (projectId: string) => Promise<{
      success: boolean
      healthStatus?: HealthCheckStatus | null
      error?: string
    }>
    triggerHealthCheck: (projectId: string) => Promise<{
      success: boolean
      healthStatus?: HealthCheckStatus | null
      error?: string
    }>
    setCurrentProject: (projectId: string | null) => Promise<{
      success: boolean
      error?: string
    }>
    onStatusChanged: (callback: (projectId: string, status: ProcessState) => void) => () => void
    onOutput: (callback: (projectId: string, output: ProcessOutput) => void) => () => void
    onReady: (callback: (projectId: string, port: number) => void) => () => void
    onError: (callback: (projectId: string, error: any) => void) => () => void
    onCrashed: (callback: (projectId: string, details: any) => void) => () => void
    onHealthChanged: (callback: (projectId: string, healthStatus: HealthCheckStatus) => void) => () => void
    onHealthCritical: (callback: (projectId: string, healthStatus: HealthCheckStatus) => void) => () => void
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
    toggleDevTools: (projectId: string, isMobile?: boolean, layoutState?: string) => Promise<{
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
    hide: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    show: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    enableDeviceEmulation: (projectId: string, device: string) => Promise<{
      success: boolean
      error?: string
    }>
    disableDeviceEmulation: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    injectCSS: (projectId: string, css: string) => Promise<{
      success: boolean
      error?: string
    }>
    removeCSS: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    captureScreenshot: (projectId: string) => Promise<{
      success: boolean
      dataUrl?: string
      error?: string
    }>
    executeJavaScript: (projectId: string, code: string) => Promise<{
      success: boolean
      result?: any
      error?: string
    }>
    hasPreview: (projectId: string) => Promise<{
      success: boolean
      exists: boolean
      error?: string
    }>
    waitForPreview: (projectId: string, timeoutMs?: number) => Promise<{
      success: boolean
      exists: boolean
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
    openPath: (path: string) => Promise<string>
    showItemInFolder: (path: string) => Promise<void>
  }

  image: {
    replace: (projectId: string, imagePath: string, imageData: string) => Promise<{ success: boolean; path?: string; error?: string }>
  }

  terminal: {
    createSession: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    writeInput: (projectId: string, input: string) => Promise<{
      success: boolean
      error?: string
    }>
    resize: (projectId: string, cols: number, rows: number) => Promise<{
      success: boolean
      error?: string
    }>
    getHistory: (projectId: string, limit?: number) => Promise<{
      success: boolean
      lines?: TerminalLine[]
      error?: string
    }>
    clear: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    destroySession: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onLine: (callback: (projectId: string, line: TerminalLine) => void) => () => void
    onCleared: (callback: (projectId: string) => void) => () => void
    onExit: (callback: (projectId: string, exitCode: number, signal?: number) => void) => () => void

    // Interactive terminal sessions (for raw terminal tabs)
    createInteractiveSession: (projectId: string, terminalId: string) => Promise<{
      success: boolean
      error?: string
    }>
    writeInteractiveInput: (projectId: string, terminalId: string, input: string) => Promise<{
      success: boolean
      error?: string
    }>
    resizeInteractive: (projectId: string, terminalId: string, cols: number, rows: number) => Promise<{
      success: boolean
      error?: string
    }>
    destroyInteractiveSession: (projectId: string, terminalId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onInteractiveOutput: (callback: (projectId: string, terminalId: string, data: string) => void) => () => void
    onInteractiveExit: (callback: (projectId: string, terminalId: string, exitCode: number, signal?: number) => void) => () => void
  }

  claude: {
    startSession: (projectId: string, prompt?: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean) => Promise<{
      success: boolean
      error?: string
    }>
    sendPrompt: (projectId: string, prompt: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean) => Promise<{
      success: boolean
      error?: string
    }>
    getStatus: (projectId: string) => Promise<{
      success: boolean
      status?: ClaudeStatus
      sessionId?: string | null
      error?: string
    }>
    getContext: (projectId: string) => Promise<{
      success: boolean
      context?: ClaudeContext | null
      error?: string
    }>
    changeModel: (projectId: string, modelName: string) => Promise<{
      success: boolean
      error?: string
    }>
    getModels: () => Promise<{
      success: boolean
      models?: ClaudeModel[]
      error?: string
    }>
    clearSession: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    destroySession: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onStatusChanged: (callback: (projectId: string, status: ClaudeStatus) => void) => () => void
    onCompleted: (callback: (projectId: string) => void) => () => void
    onError: (callback: (projectId: string, error: string) => void) => () => void
    onExited: (callback: (projectId: string, exitCode: number) => void) => () => void
    onContextUpdated: (callback: (projectId: string, context: ClaudeContext) => void) => () => void
    onModelChanged: (callback: (projectId: string, model: string) => void) => () => void
    onQuestions: (callback: (projectId: string, questions: any) => void) => () => void
  }

  git: {
    checkGhCli: () => Promise<{
      success: boolean
      installed?: boolean
      authenticated?: boolean
      error?: string
    }>
    getStatus: (projectId: string) => Promise<{
      success: boolean
      files?: Array<{ path: string; status: 'added' | 'modified' | 'deleted' | 'untracked' }>
      hasChanges?: boolean
      ahead?: number
      behind?: number
      branch?: string
      error?: string
    }>
    getRemote: (projectId: string) => Promise<{
      success: boolean
      hasRemote?: boolean
      url?: string
      repoUrl?: string
      isPrivate?: boolean
      error?: string
    }>
    getLog: (projectId: string) => Promise<{
      success: boolean
      commits?: Array<{
        hash: string
        shortHash: string
        message: string
        date: string
        author: string
      }>
      error?: string
    }>
    getUnpushed: (projectId: string) => Promise<{
      success: boolean
      commits?: Array<{
        hash: string
        shortHash: string
        message: string
        date: string
        author: string
      }>
      ahead?: number
      error?: string
    }>
    push: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    commitAndPush: (projectId: string, message: string) => Promise<{
      success: boolean
      error?: string
    }>
    createRepo: (projectId: string, repoName: string, description: string, isPrivate: boolean) => Promise<{
      success: boolean
      error?: string
    }>
    revertAndPush: (projectId: string, commitHash: string) => Promise<{
      success: boolean
      error?: string
    }>
    restoreCheckpoint: (projectId: string, commitHash: string) => Promise<{
      success: boolean
      commitHash?: string
      error?: string
    }>
  }

  researchAgent: {
    start: (
      projectId: string,
      agentType: 'bug-finder' | 'code-auditor' | 'web-searcher' | 'api-researcher' | 'feature-planner' | 'researcher',
      task: string,
      model: string,
      attachments?: Array<{ type: 'image'; data: string; mediaType: string; name?: string }>
    ) => Promise<{
      success: boolean
      agentId?: string
      error?: string
    }>
    stop: (agentId: string) => Promise<{
      success: boolean
      error?: string
    }>
    getList: (projectId: string) => Promise<{
      success: boolean
      agents?: Array<{
        id: string
        projectId: string
        agentType: string
        task: string
        model: string
        status: 'starting' | 'working' | 'finished' | 'error' | 'stopped'
        startTime: number
        endTime: number | null
        result: string | null
        briefDescription: string | null
        summary: string | null
        actions: any[] | null
      }>
      error?: string
    }>
    getFullHistory: (agentId: string) => Promise<{
      success: boolean
      fullHistory?: any
      error?: string
    }>
    delete: (agentId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onStatusChanged: (callback: (agentId: string, projectId: string, status: string, agent: any) => void) => () => void
    onCompleted: (callback: (agentId: string, projectId: string) => void) => () => void
    onEvent: (callback: (agentId: string, projectId: string, type: string, message: any) => void) => () => void
  }

  chat: {
    createBlock: (projectId: string, userPrompt: string) => Promise<{
      success: boolean
      block?: ChatBlock
      error?: string
    }>
    updateBlock: (blockId: string, updates: Partial<ChatBlock>) => Promise<{
      success: boolean
      block?: ChatBlock
      error?: string
    }>
    completeBlock: (blockId: string) => Promise<{
      success: boolean
      block?: ChatBlock
      error?: string
    }>
    getHistory: (projectId: string, limit?: number, offset?: number) => Promise<{
      success: boolean
      blocks?: ChatBlock[]
      error?: string
    }>
    getBlock: (blockId: string) => Promise<{
      success: boolean
      block?: ChatBlock
      error?: string
    }>
    deleteHistory: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    createInitializationBlock: (projectId: string, templateName: string, stages: Array<{ label: string; isComplete: boolean }>) => Promise<{
      success: boolean
      blockId?: string
      error?: string
    }>
    updateInitializationBlock: (projectId: string, stages: Array<{ label: string; isComplete: boolean }>, isComplete: boolean) => Promise<{
      success: boolean
      error?: string
    }>
    onBlockCreated: (callback: (projectId: string, block: ChatBlock) => void) => () => void
    onBlockUpdated: (callback: (projectId: string, block: ChatBlock) => void) => () => void
    onBlockCompleted: (callback: (projectId: string, block: ChatBlock) => void) => () => void
    onHistoryDeleted: (callback: (projectId: string) => void) => () => void
  }

  app: {
    flashWindow: () => void
    getCrashLogs: () => Promise<{
      success: boolean
      logs?: string
      path?: string
      error?: string
    }>
    clearCrashLogs: () => Promise<{
      success: boolean
      error?: string
    }>
  }

  support: {
    // Check if human support is available
    checkAvailability: () => Promise<{
      success: boolean
      available?: boolean
      error?: string
    }>

    // Save message to session (real-time chat)
    saveMessage: (message: {
      userId: string
      userName: string
      userEmail: string
      projectId?: string
      type: 'user' | 'support'
      content: string
    }) => Promise<{
      success: boolean
      message?: SupportMessage
      error?: string
    }>

    // Get user's active session
    getSession: (userId: string) => Promise<{
      success: boolean
      session?: SupportSession
      error?: string
    }>

    // Add to human support queue (when available)
    addToQueue: (data: {
      userId: string
      userName: string
      userEmail: string
      projectId?: string
      lastMessage: string
    }) => Promise<{
      success: boolean
      queueEntry?: SupportQueueEntry
      error?: string
    }>

    // Send offline message (when unavailable)
    sendOfflineMessage: (data: {
      userId: string
      userName: string
      userEmail: string
      projectId?: string
      subject: string
      message: string
    }) => Promise<{
      success: boolean
      offlineMessage?: SupportOfflineMessage
      error?: string
    }>

    // Submit bug report
    submitBugReport: (report: {
      userId: string
      userName: string
      userEmail: string
      projectId?: string
      bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
      title: string
      description: string
      stepsToReproduce?: string
    }) => Promise<{
      success: boolean
      bugReport?: BugReport
      error?: string
    }>
  }

  keywords: {
    getAll: () => Promise<{
      success: boolean
      keywords: Record<string, string>
    }>
  }

  websiteImport: {
    analyze: (url: string) => Promise<{
      success: boolean
      tempProjectId?: string
      tempDir?: string
      stats?: {
        sections: number
        images: number
        navigationItems: number
      }
      error?: string
    }>
    cleanup: (tempProjectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    checkImportStatus: (projectId: string) => Promise<{
      success: boolean
      isImport?: boolean
      importType?: 'template' | 'screenshot' | 'ai'
      migrationCompleted?: boolean
      manifest?: any
      error?: string
    }>
    markMigrationComplete: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
  }

  layout: {
    setState: (state: LayoutState, projectId?: string) => Promise<{
      success: boolean
      error?: string
    }>
    cycleState: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    getState: () => Promise<{
      success: boolean
      state?: LayoutState
      error?: string
    }>
    setActionBarHeight: (height: number) => Promise<{
      success: boolean
      error?: string
    }>
    setViewMode: (viewMode: 'desktop' | 'mobile') => Promise<{
      success: boolean
      error?: string
    }>
    captureModalFreeze: (projectId: string) => Promise<{
      success: boolean
      freezeImage?: string
      error?: string
    }>
    getCachedModalFreeze: (projectId: string) => Promise<{
      success: boolean
      freezeImage?: string
      error?: string
    }>
    clearModalFreezeCache: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
    onStateChanged: (callback: (newState: LayoutState, previousState: LayoutState) => void) => () => void
    onCycleRequested: (callback: () => void) => () => void
    onActionBarHeightChanged: (callback: (height: number) => void) => () => void
  }

  claudeMd: {
    getAddendum: (projectId: string) => Promise<{
      success: boolean
      addendum?: string
      error?: string
    }>
    saveAddendum: (projectId: string, addendum: string) => Promise<{
      success: boolean
      error?: string
    }>
    removeAddendum: (projectId: string) => Promise<{
      success: boolean
      error?: string
    }>
  }

  files: {
    replaceTextInProject: (projectId: string, originalText: string, newText: string) => Promise<{
      success: boolean
      filesModified?: number
      modifiedFiles?: string[]
      error?: string
    }>
    replaceTextBySelector: (projectId: string, elementInfo: {
      tag: string
      id: string | null
      className: string | null
      dataAttributes: Record<string, string>
      textContent: string
      selector: string
    }, originalText: string, newText: string) => Promise<{
      success: boolean
      filesModified?: number
      modifiedFiles?: string[]
      error?: string
    }>
    readFileAsBase64: (filePath: string) => Promise<string>
    saveBase64Image: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>
  }

  analytics: {
    getData: (projectId: string, timeRange: 'today' | 'week' | 'month') => Promise<{
      success: boolean
      data?: {
        activeUsers: number
        stats: {
          visitors: number
          pageViews: number
          avgTime: string
        }
        trend: Array<{
          date: string
          visitors: number
        }>
        topPages: Array<{
          path: string
          views: number
          percentage: number
        }>
        sources: Array<{
          name: string
          value: number
          color: string
        }>
        devices: Array<{
          name: string
          value: number
          color: string
        }>
      }
      error?: string
    }>
    getActiveUsers: (projectId: string) => Promise<{
      success: boolean
      activeUsers?: number
      error?: string
    }>
  }

}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
