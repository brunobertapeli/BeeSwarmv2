import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface Project {
  id: string
  userId: string // SECURITY: User who owns this project
  name: string
  path: string
  templateId: string
  templateName: string
  techStack: string | null // JSON array of tech stack items from template at creation time
  status: 'creating' | 'ready' | 'error'
  isFavorite: boolean
  configCompleted: boolean
  envVars: string | null // JSON string
  dependenciesInstalled: boolean
  claudeSessionId: string | null // Claude session ID for resume
  claudeContext: string | null // Claude context (JSON string with tokens, cost, etc.)
  websiteImportAutoPromptSent: number | null // Timestamp when auto-prompt was sent for website imports
  deployServices: string | null // JSON array of deployment services
  envFiles: string | null // JSON array of { path, label, description }
  imagePath: string | null // Path to template images
  netlifyId: string | null // Netlify site ID for redeployment
  railwayId: string | null // Railway project ID for redeployment
  liveUrl: string | null // Last deployed live URL
  deployedCommit: string | null // Git commit hash of last deployment
  kanbanState: string | null // JSON string with { enabled, position, size }
  stickyNotesState: string | null // JSON string with sticky notes array
  analyticsWidgetState: string | null // JSON string with { enabled, position, size }
  projectAssetsWidgetState: string | null // JSON string with { enabled, position }
  whiteboardWidgetState: string | null // JSON string with { enabled, position, size }
  iconsWidgetState: string | null // JSON string with { enabled, position, size }
  createdAt: number
  lastOpenedAt: number | null
}

export interface KanbanCard {
  id: string
  title: string
  content: string
  priority: string
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
}

export interface KanbanState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  columns: KanbanColumn[]
  zIndex: number
}

export interface StickyNote {
  id: string
  position: { x: number; y: number }
  content: string
  color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green'
  stickyText: boolean
  zIndex: number
}

export interface StickyNotesState {
  notes: StickyNote[]
}

export interface AnalyticsWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
}

export interface ProjectAssetsWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  zIndex: number
}

export interface WhiteboardWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
}

export interface IconsWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
}

export interface ChatWidgetState {
  enabled: boolean
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
}

export interface ChatWidgetMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  type?: 'text' | 'image'
  imageUrl?: string
  imageLocalPath?: string // Local file path for loading images from disk
}

export interface ChatWidgetConversation {
  id: string
  projectId: string
  title: string
  modelCategory: 'chat' | 'images'
  model: string
  messages: string  // JSON array of ChatWidgetMessage
  createdAt: number
  updatedAt: number
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

class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string = ''

  /**
   * Initialize database and create tables if they don't exist
   * @param userId - User ID for database isolation
   */
  init(userId: string): void {
    try {
      // Database location: ~/Documents/CodeDeck/{userId}/database.db
      // Keeps all user data (database, projects, logs) in one accessible location
      const homeDir = app.getPath('home')
      const userDataDir = path.join(homeDir, 'Documents', 'CodeDeck', userId)
      this.dbPath = path.join(userDataDir, 'database.db')

      // Ensure directory exists
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true })
      }

      // Open database
      this.db = new Database(this.dbPath)

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('busy_timeout = 5000')

      // Create projects table
      this.createProjectsTable()

      // Create chat history table
      this.createChatHistoryTable()

      // Create research agents table
      this.createResearchAgentsTable()

      // Create chatwidget conversations table
      this.createChatWidgetConversationsTable()

      // Run migrations
      this.runMigrations()

    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Create projects table
   */
  private createProjectsTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        templateId TEXT NOT NULL,
        templateName TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'creating',
        isFavorite INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        lastOpenedAt INTEGER
      )
    `

    this.db!.exec(sql)
  }

  /**
   * Create chat_history table
   */
  private createChatHistoryTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS chat_history (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        blockIndex INTEGER NOT NULL,
        userPrompt TEXT NOT NULL,
        claudeMessages TEXT,
        toolExecutions TEXT,
        commitHash TEXT,
        filesChanged INTEGER,
        completionStats TEXT,
        summary TEXT,
        actions TEXT,
        completedAt INTEGER,
        isComplete INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      )
    `

    this.db!.exec(sql)

    // Create index for faster queries by projectId
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_chat_history_projectId ON chat_history(projectId)')
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_chat_history_blockIndex ON chat_history(projectId, blockIndex)')
  }

  /**
   * Create research_agents table
   */
  private createResearchAgentsTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS research_agents (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        agentType TEXT NOT NULL,
        task TEXT NOT NULL,
        model TEXT NOT NULL,
        sessionId TEXT,
        status TEXT NOT NULL,
        startTime INTEGER NOT NULL,
        endTime INTEGER,
        result TEXT,
        briefDescription TEXT,
        summary TEXT,
        actions TEXT,
        findings TEXT,
        fullHistory TEXT,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      )
    `

    this.db!.exec(sql)

    // Create index for faster queries by projectId
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_research_agents_projectId ON research_agents(projectId)')
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_research_agents_status ON research_agents(projectId, status)')
  }

  /**
   * Create chatwidget_conversations table for AI chat/image conversations
   */
  private createChatWidgetConversationsTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS chatwidget_conversations (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        title TEXT NOT NULL,
        modelCategory TEXT NOT NULL,
        model TEXT NOT NULL,
        messages TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      )
    `

    this.db!.exec(sql)

    // Create index for faster queries by projectId
    this.db!.exec('CREATE INDEX IF NOT EXISTS idx_chatwidget_conversations_projectId ON chatwidget_conversations(projectId)')
  }

  /**
   * Run database migrations for existing databases
   */
  private runMigrations(): void {
    if (!this.db) return

    try {
      const tableInfo = this.db.prepare('PRAGMA table_info(projects)').all() as any[]

      // Migration 1: Add isFavorite column if it doesn't exist
      const hasIsFavorite = tableInfo.some(col => col.name === 'isFavorite')
      if (!hasIsFavorite) {
        this.db.exec('ALTER TABLE projects ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0')
      }

      // Migration 2: Add configCompleted column if it doesn't exist
      const hasConfigCompleted = tableInfo.some(col => col.name === 'configCompleted')
      if (!hasConfigCompleted) {
        this.db.exec('ALTER TABLE projects ADD COLUMN configCompleted INTEGER NOT NULL DEFAULT 0')
      }

      // Migration 3: Add envVars column if it doesn't exist
      const hasEnvVars = tableInfo.some(col => col.name === 'envVars')
      if (!hasEnvVars) {
        this.db.exec('ALTER TABLE projects ADD COLUMN envVars TEXT')
      }

      // Migration 4: Add dependenciesInstalled column if it doesn't exist
      const hasDependenciesInstalled = tableInfo.some(col => col.name === 'dependenciesInstalled')
      if (!hasDependenciesInstalled) {
        this.db.exec('ALTER TABLE projects ADD COLUMN dependenciesInstalled INTEGER NOT NULL DEFAULT 0')
      }

      // Migration 5: Add claudeSessionId column if it doesn't exist
      const hasClaudeSessionId = tableInfo.some(col => col.name === 'claudeSessionId')
      if (!hasClaudeSessionId) {
        this.db.exec('ALTER TABLE projects ADD COLUMN claudeSessionId TEXT')
      }

      // Migration 6: Add claudeContext column if it doesn't exist
      const hasClaudeContext = tableInfo.some(col => col.name === 'claudeContext')
      if (!hasClaudeContext) {
        this.db.exec('ALTER TABLE projects ADD COLUMN claudeContext TEXT')
      }

      // Migration 7: Add userId column if it doesn't exist (SECURITY FIX)
      const hasUserId = tableInfo.some(col => col.name === 'userId')
      if (!hasUserId) {
        // Add column with default empty string for existing projects
        // NOTE: In production, you'd need to populate this with actual user IDs
        this.db.exec('ALTER TABLE projects ADD COLUMN userId TEXT NOT NULL DEFAULT \'\'')
      }

      // Migration 8-11: Add chat_history table columns if they don't exist
      try {
        const chatTableInfo = this.db.prepare('PRAGMA table_info(chat_history)').all() as any[]

        const hasClaudeMessages = chatTableInfo.some(col => col.name === 'claudeMessages')
        if (!hasClaudeMessages) {
          this.db.exec('ALTER TABLE chat_history ADD COLUMN claudeMessages TEXT')
        }

        const hasCompletionStats = chatTableInfo.some(col => col.name === 'completionStats')
        if (!hasCompletionStats) {
          this.db.exec('ALTER TABLE chat_history ADD COLUMN completionStats TEXT')
        }

        const hasSummary = chatTableInfo.some(col => col.name === 'summary')
        if (!hasSummary) {
          this.db.exec('ALTER TABLE chat_history ADD COLUMN summary TEXT')
        }

        const hasActions = chatTableInfo.some(col => col.name === 'actions')
        if (!hasActions) {
          this.db.exec('ALTER TABLE chat_history ADD COLUMN actions TEXT')
        }

        const hasInteractionType = chatTableInfo.some(col => col.name === 'interactionType')
        if (!hasInteractionType) {
          this.db.exec('ALTER TABLE chat_history ADD COLUMN interactionType TEXT')
        }
      } catch (e) {
        // chat_history table might not exist yet - that's ok
      }

      // Migration 12: Add websiteImportAutoPromptSent column if it doesn't exist
      const hasWebsiteImportAutoPromptSent = tableInfo.some(col => col.name === 'websiteImportAutoPromptSent')
      if (!hasWebsiteImportAutoPromptSent) {
        this.db.exec('ALTER TABLE projects ADD COLUMN websiteImportAutoPromptSent INTEGER')
      }

      // Migration 13: Add deployServices column if it doesn't exist
      const hasDeployServices = tableInfo.some(col => col.name === 'deployServices')
      if (!hasDeployServices) {
        this.db.exec('ALTER TABLE projects ADD COLUMN deployServices TEXT')
      }

      // Migration 14: Add imagePath column if it doesn't exist
      const hasImagePath = tableInfo.some(col => col.name === 'imagePath')
      if (!hasImagePath) {
        this.db.exec('ALTER TABLE projects ADD COLUMN imagePath TEXT')
      }

      // Migration 15: Add kanbanState column if it doesn't exist
      const hasKanbanState = tableInfo.some(col => col.name === 'kanbanState')
      if (!hasKanbanState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN kanbanState TEXT')
      }

      // Migration 16: Add stickyNotesState column if it doesn't exist
      const hasStickyNotesState = tableInfo.some(col => col.name === 'stickyNotesState')
      if (!hasStickyNotesState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN stickyNotesState TEXT')
      }

      // Migration 17: Add briefDescription column to research_agents table if it doesn't exist
      try {
        const researchAgentsTableInfo = this.db.prepare('PRAGMA table_info(research_agents)').all() as any[]
        const hasBriefDescription = researchAgentsTableInfo.some(col => col.name === 'briefDescription')
        if (!hasBriefDescription) {
          this.db.exec('ALTER TABLE research_agents ADD COLUMN briefDescription TEXT')
        }
      } catch (e) {
        // research_agents table might not exist yet - that's ok
      }

      // Migration 18: Add findings column to research_agents table if it doesn't exist
      try {
        const researchAgentsTableInfo = this.db.prepare('PRAGMA table_info(research_agents)').all() as any[]
        const hasFindings = researchAgentsTableInfo.some(col => col.name === 'findings')
        if (!hasFindings) {
          this.db.exec('ALTER TABLE research_agents ADD COLUMN findings TEXT')
        }
      } catch (e) {
        // research_agents table might not exist yet - that's ok
      }

      // Migration 19: Add analyticsWidgetState column if it doesn't exist
      const hasAnalyticsWidgetState = tableInfo.some(col => col.name === 'analyticsWidgetState')
      if (!hasAnalyticsWidgetState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN analyticsWidgetState TEXT')
      }

      // Migration 20: Add projectAssetsWidgetState column if it doesn't exist
      const hasProjectAssetsWidgetState = tableInfo.some(col => col.name === 'projectAssetsWidgetState')
      if (!hasProjectAssetsWidgetState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN projectAssetsWidgetState TEXT')
      }

      // Migration 20: Add envFiles column if it doesn't exist
      const hasEnvFiles = tableInfo.some(col => col.name === 'envFiles')
      if (!hasEnvFiles) {
        this.db.exec('ALTER TABLE projects ADD COLUMN envFiles TEXT')
      }

      // Migration 21: Add whiteboardWidgetState column if it doesn't exist
      const hasWhiteboardWidgetState = tableInfo.some(col => col.name === 'whiteboardWidgetState')
      if (!hasWhiteboardWidgetState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN whiteboardWidgetState TEXT')
      }

      // Migration 22: Add techStack column if it doesn't exist
      const hasTechStack = tableInfo.some(col => col.name === 'techStack')
      if (!hasTechStack) {
        this.db.exec('ALTER TABLE projects ADD COLUMN techStack TEXT')
      }

      // Migration 23: Add iconsWidgetState column if it doesn't exist
      const hasIconsWidgetState = tableInfo.some(col => col.name === 'iconsWidgetState')
      if (!hasIconsWidgetState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN iconsWidgetState TEXT')
      }

      // Migration 24: Add chatWidgetState column if it doesn't exist
      const hasChatWidgetState = tableInfo.some(col => col.name === 'chatWidgetState')
      if (!hasChatWidgetState) {
        this.db.exec('ALTER TABLE projects ADD COLUMN chatWidgetState TEXT')
      }

      // Migration 25: Add netlifyId column if it doesn't exist
      const hasNetlifyId = tableInfo.some(col => col.name === 'netlifyId')
      if (!hasNetlifyId) {
        this.db.exec('ALTER TABLE projects ADD COLUMN netlifyId TEXT')
      }

      // Migration 26: Add railwayId column if it doesn't exist
      const hasRailwayId = tableInfo.some(col => col.name === 'railwayId')
      if (!hasRailwayId) {
        this.db.exec('ALTER TABLE projects ADD COLUMN railwayId TEXT')
      }

      // Migration 27: Add liveUrl column if it doesn't exist
      const hasLiveUrl = tableInfo.some(col => col.name === 'liveUrl')
      if (!hasLiveUrl) {
        this.db.exec('ALTER TABLE projects ADD COLUMN liveUrl TEXT')
      }

      // Migration 28: Add deployedCommit column if it doesn't exist
      const hasDeployedCommit = tableInfo.some(col => col.name === 'deployedCommit')
      if (!hasDeployedCommit) {
        this.db.exec('ALTER TABLE projects ADD COLUMN deployedCommit TEXT')
      }

      // Future migrations can be added here
    } catch (error) {
      console.error('❌ Migration failed:', error)
      // Don't throw - let the app continue even if migration fails
    }
  }

  /**
   * Create a new project
   */
  createProject(project: Omit<Project, 'id' | 'createdAt' | 'lastOpenedAt' | 'isFavorite' | 'configCompleted' | 'envVars' | 'dependenciesInstalled' | 'claudeSessionId' | 'claudeContext'>): Project {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const newProject: Project = {
      id: this.generateId(),
      ...project,
      isFavorite: false,
      configCompleted: false,
      envVars: null,
      dependenciesInstalled: false,
      claudeSessionId: null,
      claudeContext: null,
      createdAt: Date.now(),
      lastOpenedAt: null
    }

    const sql = `
      INSERT INTO projects (id, userId, name, path, templateId, templateName, techStack, status, isFavorite, configCompleted, envVars, dependenciesInstalled, claudeSessionId, deployServices, envFiles, imagePath, createdAt, lastOpenedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      this.db.prepare(sql).run(
        newProject.id,
        newProject.userId,
        newProject.name,
        newProject.path,
        newProject.templateId,
        newProject.templateName,
        newProject.techStack,
        newProject.status,
        newProject.isFavorite ? 1 : 0,
        newProject.configCompleted ? 1 : 0,
        newProject.envVars,
        newProject.dependenciesInstalled ? 1 : 0,
        newProject.claudeSessionId,
        newProject.deployServices,
        newProject.envFiles,
        newProject.imagePath,
        newProject.createdAt,
        newProject.lastOpenedAt
      )

      return newProject
    } catch (error) {
      console.error('❌ Failed to create project:', error)
      throw error
    }
  }

  /**
   * Get all projects
   */
  getAllProjects(): Project[] {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM projects ORDER BY lastOpenedAt DESC NULLS LAST, createdAt DESC'

    try {
      const rows = this.db.prepare(sql).all() as any[]
      const projects = rows.map(row => ({
        ...row,
        isFavorite: row.isFavorite === 1,
        configCompleted: row.configCompleted === 1,
        dependenciesInstalled: row.dependenciesInstalled === 1
      })) as Project[]

      return projects
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error)
      throw error
    }
  }

  /**
   * Get project by ID
   */
  getProjectById(id: string): Project | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM projects WHERE id = ?'

    try {
      const row = this.db.prepare(sql).get(id) as any
      if (!row) return null

      return {
        ...row,
        isFavorite: row.isFavorite === 1,
        configCompleted: row.configCompleted === 1,
        dependenciesInstalled: row.dependenciesInstalled === 1
      } as Project
    } catch (error) {
      console.error('❌ Failed to fetch project:', error)
      throw error
    }
  }

  /**
   * Check if a project with the given name exists for a user
   */
  projectNameExists(name: string, userId: string, excludeProjectId?: string): boolean {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      let sql = 'SELECT COUNT(*) as count FROM projects WHERE name = ? AND userId = ?'
      const params: any[] = [name, userId]

      // Optionally exclude a specific project (useful for rename validation)
      if (excludeProjectId) {
        sql += ' AND id != ?'
        params.push(excludeProjectId)
      }

      const result = this.db.prepare(sql).get(...params) as any
      return result.count > 0
    } catch (error) {
      console.error('❌ Failed to check project name:', error)
      throw error
    }
  }

  /**
   * Save environment configuration for a project
   */
  saveEnvConfig(id: string, envVars: Record<string, string>): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET envVars = ?, configCompleted = 1 WHERE id = ?'

    try {
      const envVarsJson = JSON.stringify(envVars)
      this.db.prepare(sql).run(envVarsJson, id)
    } catch (error) {
      console.error('❌ Failed to save env config:', error)
      throw error
    }
  }

  /**
   * Get environment configuration for a project
   */
  getEnvConfig(id: string): Record<string, string> | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(id)
    if (!project || !project.envVars) {
      return null
    }

    try {
      return JSON.parse(project.envVars)
    } catch (error) {
      console.error('❌ Failed to parse env config:', error)
      return null
    }
  }

  /**
   * Mark dependencies as installed for a project
   */
  markDependenciesInstalled(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET dependenciesInstalled = 1 WHERE id = ?'

    try {
      this.db.prepare(sql).run(id)
    } catch (error) {
      console.error('❌ Failed to mark dependencies as installed:', error)
      throw error
    }
  }

  /**
   * Toggle project favorite status
   */
  toggleFavorite(id: string): boolean {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Get current status
      const project = this.getProjectById(id)
      if (!project) {
        throw new Error('Project not found')
      }

      const newStatus = !project.isFavorite
      const sql = 'UPDATE projects SET isFavorite = ? WHERE id = ?'

      this.db.prepare(sql).run(newStatus ? 1 : 0, id)

      return newStatus
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error)
      throw error
    }
  }

  /**
   * Update project status
   */
  updateProjectStatus(id: string, status: Project['status']): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET status = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(status, id)
    } catch (error) {
      console.error('❌ Failed to update project status:', error)
      throw error
    }
  }

  /**
   * Update last opened timestamp
   */
  updateLastOpened(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET lastOpenedAt = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(Date.now(), id)
    } catch (error) {
      console.error('❌ Failed to update last opened:', error)
      throw error
    }
  }

  /**
   * Save Claude session ID for a project
   */
  saveClaudeSessionId(projectId: string, sessionId: string | null): void {
    if (!this.db) {
      // Silently ignore updates after database closure (graceful shutdown)
      console.warn('⚠️ Attempted to save Claude session ID after database closed - ignoring')
      return
    }

    const sql = 'UPDATE projects SET claudeSessionId = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(sessionId, projectId)
    } catch (error) {
      console.error('❌ Failed to save Claude session ID:', error)
      throw error
    }
  }

  /**
   * Get Claude session ID for a project
   */
  getClaudeSessionId(projectId: string): string | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    return project?.claudeSessionId || null
  }

  /**
   * Save Claude context for a project
   */
  saveClaudeContext(projectId: string, context: any): void {
    if (!this.db) {
      // Silently ignore updates after database closure (graceful shutdown)
      console.warn('⚠️ Attempted to save Claude context after database closed - ignoring')
      return
    }

    const contextJson = JSON.stringify(context)
    const sql = 'UPDATE projects SET claudeContext = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(contextJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Claude context:', error)
      throw error
    }
  }

  /**
   * Get Claude context for a project
   */
  getClaudeContext(projectId: string): any | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.claudeContext) {
      return null
    }

    try {
      return JSON.parse(project.claudeContext)
    } catch (error) {
      console.error('❌ Failed to parse Claude context:', error)
      return null
    }
  }

  /**
   * Save Kanban widget state for a project
   */
  saveKanbanState(projectId: string, kanbanState: KanbanState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Kanban state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(kanbanState)
    const sql = 'UPDATE projects SET kanbanState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Kanban state:', error)
      throw error
    }
  }

  /**
   * Get Kanban widget state for a project
   */
  getKanbanState(projectId: string): KanbanState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.kanbanState) {
      return null
    }

    try {
      return JSON.parse(project.kanbanState) as KanbanState
    } catch (error) {
      console.error('❌ Failed to parse Kanban state:', error)
      return null
    }
  }

  /**
   * Save sticky notes state for a project
   */
  saveStickyNotesState(projectId: string, stickyNotesState: StickyNotesState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save sticky notes state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(stickyNotesState)
    const sql = 'UPDATE projects SET stickyNotesState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save sticky notes state:', error)
      throw error
    }
  }

  /**
   * Get sticky notes state for a project
   */
  getStickyNotesState(projectId: string): StickyNotesState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.stickyNotesState) {
      return null
    }

    try {
      return JSON.parse(project.stickyNotesState) as StickyNotesState
    } catch (error) {
      console.error('❌ Failed to parse sticky notes state:', error)
      return null
    }
  }

  /**
   * Save Analytics widget state for a project
   */
  saveAnalyticsWidgetState(projectId: string, widgetState: AnalyticsWidgetState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Analytics widget state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(widgetState)
    const sql = 'UPDATE projects SET analyticsWidgetState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Analytics widget state:', error)
      throw error
    }
  }

  /**
   * Get Analytics widget state for a project
   */
  getAnalyticsWidgetState(projectId: string): AnalyticsWidgetState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.analyticsWidgetState) {
      return null
    }

    try {
      return JSON.parse(project.analyticsWidgetState) as AnalyticsWidgetState
    } catch (error) {
      console.error('❌ Failed to parse Analytics widget state:', error)
      return null
    }
  }

  /**
   * Save Project Assets widget state for a project
   */
  saveProjectAssetsWidgetState(projectId: string, widgetState: ProjectAssetsWidgetState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Project Assets widget state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(widgetState)
    const sql = 'UPDATE projects SET projectAssetsWidgetState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Project Assets widget state:', error)
      throw error
    }
  }

  /**
   * Get Project Assets widget state for a project
   */
  getProjectAssetsWidgetState(projectId: string): ProjectAssetsWidgetState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.projectAssetsWidgetState) {
      return null
    }

    try {
      return JSON.parse(project.projectAssetsWidgetState) as ProjectAssetsWidgetState
    } catch (error) {
      console.error('❌ Failed to parse Project Assets widget state:', error)
      return null
    }
  }

  /**
   * Save Whiteboard widget state for a project
   */
  saveWhiteboardWidgetState(projectId: string, widgetState: WhiteboardWidgetState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Whiteboard widget state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(widgetState)
    const sql = 'UPDATE projects SET whiteboardWidgetState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Whiteboard widget state:', error)
      throw error
    }
  }

  /**
   * Get Whiteboard widget state for a project
   */
  getWhiteboardWidgetState(projectId: string): WhiteboardWidgetState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.whiteboardWidgetState) {
      return null
    }

    try {
      return JSON.parse(project.whiteboardWidgetState) as WhiteboardWidgetState
    } catch (error) {
      console.error('❌ Failed to parse Whiteboard widget state:', error)
      return null
    }
  }

  /**
   * Save Icons widget state for a project
   */
  saveIconsWidgetState(projectId: string, widgetState: IconsWidgetState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Icons widget state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(widgetState)
    const sql = 'UPDATE projects SET iconsWidgetState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Icons widget state:', error)
      throw error
    }
  }

  /**
   * Get Icons widget state for a project
   */
  getIconsWidgetState(projectId: string): IconsWidgetState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.iconsWidgetState) {
      return null
    }

    try {
      return JSON.parse(project.iconsWidgetState) as IconsWidgetState
    } catch (error) {
      console.error('❌ Failed to parse Icons widget state:', error)
      return null
    }
  }

  /**
   * Save Chat widget state for a project
   */
  saveChatWidgetState(projectId: string, widgetState: ChatWidgetState): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save Chat widget state after database closed - ignoring')
      return
    }

    const stateJson = JSON.stringify(widgetState)
    const sql = 'UPDATE projects SET chatWidgetState = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(stateJson, projectId)
    } catch (error) {
      console.error('❌ Failed to save Chat widget state:', error)
      throw error
    }
  }

  /**
   * Get Chat widget state for a project
   */
  getChatWidgetState(projectId: string): ChatWidgetState | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project?.chatWidgetState) {
      return null
    }

    try {
      return JSON.parse(project.chatWidgetState) as ChatWidgetState
    } catch (error) {
      console.error('❌ Failed to parse Chat widget state:', error)
      return null
    }
  }

  /**
   * Save deployment ID for a provider
   */
  saveDeploymentId(projectId: string, provider: 'netlify' | 'railway', deploymentId: string): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save deployment ID after database closed - ignoring')
      return
    }

    const column = provider === 'netlify' ? 'netlifyId' : 'railwayId'
    const sql = `UPDATE projects SET ${column} = ? WHERE id = ?`

    try {
      this.db.prepare(sql).run(deploymentId, projectId)
    } catch (error) {
      console.error(`❌ Failed to save ${provider} deployment ID:`, error)
      throw error
    }
  }

  /**
   * Get deployment ID for a provider
   */
  getDeploymentId(projectId: string, provider: 'netlify' | 'railway'): string | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    if (!project) return null

    return provider === 'netlify' ? project.netlifyId : project.railwayId
  }

  /**
   * Save live URL for a project
   */
  saveLiveUrl(projectId: string, url: string): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save live URL after database closed - ignoring')
      return
    }

    const sql = 'UPDATE projects SET liveUrl = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(url, projectId)
    } catch (error) {
      console.error('❌ Failed to save live URL:', error)
      throw error
    }
  }

  /**
   * Get live URL for a project
   */
  getLiveUrl(projectId: string): string | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    return project?.liveUrl || null
  }

  /**
   * Save deployed commit hash for a project
   */
  saveDeployedCommit(projectId: string, commitHash: string): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to save deployed commit after database closed - ignoring')
      return
    }

    const sql = 'UPDATE projects SET deployedCommit = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(commitHash, projectId)
    } catch (error) {
      console.error('❌ Failed to save deployed commit:', error)
      throw error
    }
  }

  /**
   * Get deployed commit hash for a project
   */
  getDeployedCommit(projectId: string): string | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const project = this.getProjectById(projectId)
    return project?.deployedCommit || null
  }

  /**
   * Mark website import auto-prompt as sent
   */
  markWebsiteImportAutoPromptSent(projectId: string): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to mark website import prompt after database closed - ignoring')
      return
    }

    const timestamp = Date.now()
    const sql = 'UPDATE projects SET websiteImportAutoPromptSent = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(timestamp, projectId)
    } catch (error) {
      console.error('⭐ Failed to mark website import auto-prompt:', error)
      throw error
    }
  }

  /**
   * Delete project from database
   */
  deleteProject(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM projects WHERE id = ?'

    try {
      this.db.prepare(sql).run(id)
    } catch (error) {
      console.error('❌ Failed to delete project:', error)
      throw error
    }
  }

  /**
   * Rename project (update name and path)
   */
  renameProject(id: string, newName: string, newPath: string): Project {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET name = ?, path = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(newName, newPath, id)

      const project = this.getProjectById(id)
      if (!project) {
        throw new Error('Project not found after rename')
      }

      return project
    } catch (error) {
      console.error('❌ Failed to rename project:', error)
      throw error
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate chat block ID
   */
  private generateChatBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ==================== CHAT HISTORY METHODS ====================

  /**
   * Create a new chat block
   */
  createChatBlock(projectId: string, userPrompt: string, interactionType: string | null = null): ChatBlock {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Get the next block index for this project
    const maxIndexQuery = 'SELECT MAX(blockIndex) as maxIndex FROM chat_history WHERE projectId = ?'
    const result = this.db.prepare(maxIndexQuery).get(projectId) as { maxIndex: number | null }
    const blockIndex = (result?.maxIndex ?? -1) + 1

    const newBlock: ChatBlock = {
      id: this.generateChatBlockId(),
      projectId,
      blockIndex,
      userPrompt,
      claudeMessages: null,
      toolExecutions: null,
      commitHash: null,
      filesChanged: null,
      completionStats: null,
      summary: null,
      actions: null,
      completedAt: null,
      isComplete: false,
      interactionType,
      createdAt: Date.now()
    }

    const sql = `
      INSERT INTO chat_history (id, projectId, blockIndex, userPrompt, claudeMessages, toolExecutions, commitHash, filesChanged, completionStats, summary, actions, completedAt, isComplete, interactionType, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      this.db.prepare(sql).run(
        newBlock.id,
        newBlock.projectId,
        newBlock.blockIndex,
        newBlock.userPrompt,
        newBlock.claudeMessages,
        newBlock.toolExecutions,
        newBlock.commitHash,
        newBlock.filesChanged,
        newBlock.completionStats,
        newBlock.summary,
        newBlock.actions,
        newBlock.completedAt,
        newBlock.isComplete ? 1 : 0,
        newBlock.interactionType,
        newBlock.createdAt
      )

      return newBlock
    } catch (error) {
      console.error('❌ Failed to create chat block:', error)
      throw error
    }
  }

  /**
   * Update a chat block
   */
  updateChatBlock(blockId: string, updates: Partial<Omit<ChatBlock, 'id' | 'projectId' | 'blockIndex' | 'createdAt'>>): void {
    if (!this.db) {
      // Silently ignore updates after database closure (graceful shutdown)
      console.warn('⚠️ Attempted to update chat block after database closed - ignoring')
      return
    }

    const fields: string[] = []
    const values: any[] = []

    if (updates.userPrompt !== undefined) {
      fields.push('userPrompt = ?')
      values.push(updates.userPrompt)
    }
    if (updates.claudeMessages !== undefined) {
      fields.push('claudeMessages = ?')
      values.push(updates.claudeMessages)
    }
    if (updates.toolExecutions !== undefined) {
      fields.push('toolExecutions = ?')
      values.push(updates.toolExecutions)
    }
    if (updates.commitHash !== undefined) {
      fields.push('commitHash = ?')
      values.push(updates.commitHash)
    }
    if (updates.filesChanged !== undefined) {
      fields.push('filesChanged = ?')
      values.push(updates.filesChanged)
    }
    if (updates.completionStats !== undefined) {
      fields.push('completionStats = ?')
      values.push(updates.completionStats)
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?')
      values.push(updates.summary)
    }
    if (updates.actions !== undefined) {
      fields.push('actions = ?')
      values.push(updates.actions)
    }
    if (updates.completedAt !== undefined) {
      fields.push('completedAt = ?')
      values.push(updates.completedAt)
    }
    if (updates.isComplete !== undefined) {
      fields.push('isComplete = ?')
      values.push(updates.isComplete ? 1 : 0)
    }
    if (updates.interactionType !== undefined) {
      fields.push('interactionType = ?')
      values.push(updates.interactionType)
    }

    if (fields.length === 0) {
      return // Nothing to update
    }

    values.push(blockId)
    const sql = `UPDATE chat_history SET ${fields.join(', ')} WHERE id = ?`

    try {
      this.db.prepare(sql).run(...values)
    } catch (error) {
      console.error('❌ Failed to update chat block:', error)
      throw error
    }
  }

  /**
   * Complete a chat block
   */
  completeChatBlock(blockId: string): void {
    this.updateChatBlock(blockId, {
      isComplete: true,
      completedAt: Date.now()
    })
  }

  /**
   * Add an action to a chat block
   */
  addAction(blockId: string, action: {
    type: 'git_commit' | 'build' | 'dev_server' | 'checkpoint_restore'
    status: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
    timestamp: number
  }): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Wrap in transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const block = this.getChatBlock(blockId)
      if (!block) {
        throw new Error(`Chat block not found: ${blockId}`)
      }

      // Get existing actions or initialize empty array
      let actions: any[] = []
      if (block.actions) {
        try {
          actions = JSON.parse(block.actions)
        } catch (e) {
          console.error('Failed to parse existing actions:', e)
        }
      }

      // Add new action
      actions.push(action)

      // Update block
      this.updateChatBlock(blockId, {
        actions: JSON.stringify(actions)
      })
    })

    transaction()
  }

  /**
   * Update an action in a chat block
   */
  updateAction(blockId: string, actionIndex: number, updates: {
    status?: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
  }): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Wrap in transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const block = this.getChatBlock(blockId)
      if (!block) {
        throw new Error(`Chat block not found: ${blockId}`)
      }

      if (!block.actions) {
        return
      }

      try {
        const actions = JSON.parse(block.actions)
        if (actionIndex < 0 || actionIndex >= actions.length) {
          return
        }

        // Update action
        actions[actionIndex] = { ...actions[actionIndex], ...updates }

        // Save back to database
        this.updateChatBlock(blockId, {
          actions: JSON.stringify(actions)
        })
      } catch (e) {
        console.error('Failed to update action:', e)
      }
    })

    transaction()
  }

  /**
   * Update the last action in a chat block atomically
   */
  updateLastActionInBlock(blockId: string, updates: {
    status?: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
  }): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Wrap in transaction to prevent race conditions
    const transaction = this.db.transaction(() => {
      const block = this.getChatBlock(blockId)
      if (!block || !block.actions) {
        return
      }

      try {
        const actions = JSON.parse(block.actions)
        const lastActionIndex = actions.length - 1

        if (lastActionIndex >= 0) {
          // Update last action
          actions[lastActionIndex] = { ...actions[lastActionIndex], ...updates }

          // Save back to database
          this.updateChatBlock(blockId, {
            actions: JSON.stringify(actions)
          })
        }
      } catch (e) {
        console.error('Failed to update last action:', e)
      }
    })

    transaction()
  }

  /**
   * Get chat history for a project
   */
  getChatHistory(projectId: string, limit?: number, offset?: number): ChatBlock[] {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    let sql = 'SELECT * FROM chat_history WHERE projectId = ? ORDER BY blockIndex DESC'

    if (limit) {
      sql += ` LIMIT ${limit}`
    }

    if (offset) {
      sql += ` OFFSET ${offset}`
    }

    try {
      const rows = this.db.prepare(sql).all(projectId) as any[]

      return rows.map(row => ({
        id: row.id,
        projectId: row.projectId,
        blockIndex: row.blockIndex,
        userPrompt: row.userPrompt,
        claudeMessages: row.claudeMessages,
        toolExecutions: row.toolExecutions,
        commitHash: row.commitHash,
        filesChanged: row.filesChanged,
        completionStats: row.completionStats,
        summary: row.summary,
        actions: row.actions,
        completedAt: row.completedAt,
        isComplete: Boolean(row.isComplete),
        createdAt: row.createdAt,
        interactionType: row.interactionType
      }))
    } catch (error) {
      console.error('❌ Failed to get chat history:', error)
      throw error
    }
  }

  /**
   * Get a specific chat block by ID
   */
  getChatBlock(blockId: string): ChatBlock | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM chat_history WHERE id = ?'

    try {
      const row = this.db.prepare(sql).get(blockId) as any

      if (!row) {
        return null
      }

      return {
        id: row.id,
        projectId: row.projectId,
        blockIndex: row.blockIndex,
        userPrompt: row.userPrompt,
        claudeMessages: row.claudeMessages,
        toolExecutions: row.toolExecutions,
        commitHash: row.commitHash,
        filesChanged: row.filesChanged,
        completionStats: row.completionStats,
        summary: row.summary,
        actions: row.actions,
        completedAt: row.completedAt,
        isComplete: Boolean(row.isComplete),
        interactionType: row.interactionType,
        createdAt: row.createdAt
      }
    } catch (error) {
      console.error('❌ Failed to get chat block:', error)
      throw error
    }
  }

  /**
   * Delete chat history for a project
   */
  deleteChatHistory(projectId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM chat_history WHERE projectId = ?'

    try {
      this.db.prepare(sql).run(projectId)
    } catch (error) {
      console.error('❌ Failed to delete chat history:', error)
      throw error
    }
  }

  // ==================== RESEARCH AGENT METHODS ====================

  /**
   * Create a new research agent
   */
  createResearchAgent(agent: any): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = `
      INSERT INTO research_agents (
        id, projectId, agentType, task, model, sessionId, status, startTime, endTime, result, summary, actions, fullHistory
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      this.db.prepare(sql).run(
        agent.id,
        agent.projectId,
        agent.agentType,
        agent.task,
        agent.model,
        agent.sessionId,
        agent.status,
        agent.startTime,
        agent.endTime,
        agent.result,
        agent.summary,
        agent.actions,
        agent.fullHistory
      )
    } catch (error) {
      console.error('❌ Failed to create research agent:', error)
      throw error
    }
  }

  /**
   * Update research agent status
   */
  updateResearchAgentStatus(agentId: string, status: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE research_agents SET status = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(status, agentId)
    } catch (error) {
      console.error('❌ Failed to update research agent status:', error)
      throw error
    }
  }

  /**
   * Update research agent session ID
   */
  updateResearchAgentSessionId(agentId: string, sessionId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE research_agents SET sessionId = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(sessionId, agentId)
    } catch (error) {
      console.error('❌ Failed to update research agent session ID:', error)
      throw error
    }
  }

  /**
   * Update research agent result
   */
  updateResearchAgentResult(agentId: string, data: {
    result: string | null
    briefDescription: string | null
    summary: string | null
    actions: string | null
    findings: string | null
    fullHistory: string | null
    endTime: number | null
  }): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = `
      UPDATE research_agents
      SET result = ?, briefDescription = ?, summary = ?, actions = ?, findings = ?, fullHistory = ?, endTime = ?
      WHERE id = ?
    `

    try {
      this.db.prepare(sql).run(
        data.result,
        data.briefDescription,
        data.summary,
        data.actions,
        data.findings,
        data.fullHistory,
        data.endTime,
        agentId
      )
    } catch (error) {
      console.error('❌ Failed to update research agent result:', error)
      throw error
    }
  }

  /**
   * Get all research agents for a project
   */
  getResearchAgentsForProject(projectId: string): any[] {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM research_agents WHERE projectId = ? ORDER BY startTime DESC'

    try {
      const rows = this.db.prepare(sql).all(projectId) as any[]
      return rows
    } catch (error) {
      console.error('❌ Failed to get research agents:', error)
      throw error
    }
  }

  /**
   * Get a specific research agent by ID
   */
  getResearchAgent(agentId: string): any | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM research_agents WHERE id = ?'

    try {
      const row = this.db.prepare(sql).get(agentId) as any
      return row || null
    } catch (error) {
      console.error('❌ Failed to get research agent:', error)
      throw error
    }
  }

  /**
   * Delete all research agents for a project
   */
  deleteResearchAgents(projectId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM research_agents WHERE projectId = ?'

    try {
      this.db.prepare(sql).run(projectId)
    } catch (error) {
      console.error('❌ Failed to delete research agents:', error)
      throw error
    }
  }

  // ==================== CHATWIDGET CONVERSATION METHODS ====================

  /**
   * Generate chatwidget conversation ID
   */
  private generateChatWidgetConversationId(): string {
    return `cwconv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create a new chatwidget conversation
   */
  createChatWidgetConversation(
    projectId: string,
    title: string,
    modelCategory: 'chat' | 'images',
    model: string,
    messages: ChatWidgetMessage[] = []
  ): ChatWidgetConversation {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const now = Date.now()
    const conversation: ChatWidgetConversation = {
      id: this.generateChatWidgetConversationId(),
      projectId,
      title,
      modelCategory,
      model,
      messages: JSON.stringify(messages),
      createdAt: now,
      updatedAt: now
    }

    const sql = `
      INSERT INTO chatwidget_conversations (id, projectId, title, modelCategory, model, messages, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      this.db.prepare(sql).run(
        conversation.id,
        conversation.projectId,
        conversation.title,
        conversation.modelCategory,
        conversation.model,
        conversation.messages,
        conversation.createdAt,
        conversation.updatedAt
      )

      return conversation
    } catch (error) {
      console.error('❌ Failed to create chatwidget conversation:', error)
      throw error
    }
  }

  /**
   * Get all chatwidget conversations for a project
   */
  getChatWidgetConversations(projectId: string): ChatWidgetConversation[] {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM chatwidget_conversations WHERE projectId = ? ORDER BY updatedAt DESC'

    try {
      const rows = this.db.prepare(sql).all(projectId) as ChatWidgetConversation[]
      return rows
    } catch (error) {
      console.error('❌ Failed to get chatwidget conversations:', error)
      throw error
    }
  }

  /**
   * Get a specific chatwidget conversation by ID
   */
  getChatWidgetConversation(conversationId: string): ChatWidgetConversation | null {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'SELECT * FROM chatwidget_conversations WHERE id = ?'

    try {
      const row = this.db.prepare(sql).get(conversationId) as ChatWidgetConversation | undefined
      return row || null
    } catch (error) {
      console.error('❌ Failed to get chatwidget conversation:', error)
      throw error
    }
  }

  /**
   * Update a chatwidget conversation
   */
  updateChatWidgetConversation(
    conversationId: string,
    updates: {
      title?: string
      messages?: ChatWidgetMessage[]
    }
  ): void {
    if (!this.db) {
      console.warn('⚠️ Attempted to update chatwidget conversation after database closed - ignoring')
      return
    }

    const fields: string[] = []
    const values: any[] = []

    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
    }
    if (updates.messages !== undefined) {
      fields.push('messages = ?')
      values.push(JSON.stringify(updates.messages))
    }

    // Always update updatedAt
    fields.push('updatedAt = ?')
    values.push(Date.now())

    if (fields.length === 1) {
      return // Nothing to update except updatedAt
    }

    values.push(conversationId)
    const sql = `UPDATE chatwidget_conversations SET ${fields.join(', ')} WHERE id = ?`

    try {
      this.db.prepare(sql).run(...values)
    } catch (error) {
      console.error('❌ Failed to update chatwidget conversation:', error)
      throw error
    }
  }

  /**
   * Delete a chatwidget conversation
   */
  deleteChatWidgetConversation(conversationId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM chatwidget_conversations WHERE id = ?'

    try {
      this.db.prepare(sql).run(conversationId)
    } catch (error) {
      console.error('❌ Failed to delete chatwidget conversation:', error)
      throw error
    }
  }

  /**
   * Delete all chatwidget conversations for a project
   */
  deleteChatWidgetConversations(projectId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM chatwidget_conversations WHERE projectId = ?'

    try {
      this.db.prepare(sql).run(projectId)
    } catch (error) {
      console.error('❌ Failed to delete chatwidget conversations:', error)
      throw error
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null // Mark as closed so future operations are safely ignored
    }
  }
}

export const databaseService = new DatabaseService()
