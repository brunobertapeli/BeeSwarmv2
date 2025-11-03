import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface Project {
  id: string
  name: string
  path: string
  templateId: string
  templateName: string
  status: 'creating' | 'ready' | 'error'
  isFavorite: boolean
  configCompleted: boolean
  envVars: string | null // JSON string
  dependenciesInstalled: boolean
  claudeSessionId: string | null // Claude session ID for resume
  claudeContext: string | null // Claude context (JSON string with tokens, cost, etc.)
  createdAt: number
  lastOpenedAt: number | null
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
  createdAt: number
}

class DatabaseService {
  private db: Database.Database | null = null
  private dbPath: string = ''

  /**
   * Initialize database and create tables if they don't exist
   */
  init(): void {
    try {
      // Database location: ~/Library/Application Support/BeeSwarm/database.db
      const userDataPath = app.getPath('userData')
      this.dbPath = path.join(userDataPath, 'database.db')

      console.log('📊 Database path:', this.dbPath)

      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath)
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true })
      }

      // Open database
      this.db = new Database(this.dbPath)
      console.log('✅ SQLite database connected')

      // Create projects table
      this.createProjectsTable()

      // Create chat history table
      this.createChatHistoryTable()

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
    console.log('✅ Projects table ready')
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

    console.log('✅ Chat history table ready')
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
        console.log('📦 Running migration: Adding isFavorite column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0')
        console.log('✅ Migration complete: isFavorite column added')
      }

      // Migration 2: Add configCompleted column if it doesn't exist
      const hasConfigCompleted = tableInfo.some(col => col.name === 'configCompleted')
      if (!hasConfigCompleted) {
        console.log('📦 Running migration: Adding configCompleted column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN configCompleted INTEGER NOT NULL DEFAULT 0')
        console.log('✅ Migration complete: configCompleted column added')
      }

      // Migration 3: Add envVars column if it doesn't exist
      const hasEnvVars = tableInfo.some(col => col.name === 'envVars')
      if (!hasEnvVars) {
        console.log('📦 Running migration: Adding envVars column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN envVars TEXT')
        console.log('✅ Migration complete: envVars column added')
      }

      // Migration 4: Add dependenciesInstalled column if it doesn't exist
      const hasDependenciesInstalled = tableInfo.some(col => col.name === 'dependenciesInstalled')
      if (!hasDependenciesInstalled) {
        console.log('📦 Running migration: Adding dependenciesInstalled column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN dependenciesInstalled INTEGER NOT NULL DEFAULT 0')
        console.log('✅ Migration complete: dependenciesInstalled column added')
      }

      // Migration 5: Add claudeSessionId column if it doesn't exist
      const hasClaudeSessionId = tableInfo.some(col => col.name === 'claudeSessionId')
      if (!hasClaudeSessionId) {
        console.log('📦 Running migration: Adding claudeSessionId column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN claudeSessionId TEXT')
        console.log('✅ Migration complete: claudeSessionId column added')
      }

      // Migration 6: Add claudeContext column if it doesn't exist
      const hasClaudeContext = tableInfo.some(col => col.name === 'claudeContext')
      if (!hasClaudeContext) {
        console.log('📦 Running migration: Adding claudeContext column...')
        this.db.exec('ALTER TABLE projects ADD COLUMN claudeContext TEXT')
        console.log('✅ Migration complete: claudeContext column added')
      }

      // Migration 7-10: Add chat_history table columns if they don't exist
      try {
        const chatTableInfo = this.db.prepare('PRAGMA table_info(chat_history)').all() as any[]

        const hasClaudeMessages = chatTableInfo.some(col => col.name === 'claudeMessages')
        if (!hasClaudeMessages) {
          console.log('📦 Running migration: Adding claudeMessages column to chat_history...')
          this.db.exec('ALTER TABLE chat_history ADD COLUMN claudeMessages TEXT')
          console.log('✅ Migration complete: claudeMessages column added')
        }

        const hasCompletionStats = chatTableInfo.some(col => col.name === 'completionStats')
        if (!hasCompletionStats) {
          console.log('📦 Running migration: Adding completionStats column to chat_history...')
          this.db.exec('ALTER TABLE chat_history ADD COLUMN completionStats TEXT')
          console.log('✅ Migration complete: completionStats column added')
        }

        const hasSummary = chatTableInfo.some(col => col.name === 'summary')
        if (!hasSummary) {
          console.log('📦 Running migration: Adding summary column to chat_history...')
          this.db.exec('ALTER TABLE chat_history ADD COLUMN summary TEXT')
          console.log('✅ Migration complete: summary column added')
        }

        const hasActions = chatTableInfo.some(col => col.name === 'actions')
        if (!hasActions) {
          console.log('📦 Running migration: Adding actions column to chat_history...')
          this.db.exec('ALTER TABLE chat_history ADD COLUMN actions TEXT')
          console.log('✅ Migration complete: actions column added')
        }
      } catch (e) {
        // chat_history table might not exist yet - that's ok
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
  createProject(project: Omit<Project, 'id' | 'createdAt' | 'lastOpenedAt' | 'isFavorite' | 'configCompleted' | 'envVars' | 'dependenciesInstalled' | 'claudeSessionId'>): Project {
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
      createdAt: Date.now(),
      lastOpenedAt: null
    }

    const sql = `
      INSERT INTO projects (id, name, path, templateId, templateName, status, isFavorite, configCompleted, envVars, dependenciesInstalled, claudeSessionId, createdAt, lastOpenedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    try {
      this.db.prepare(sql).run(
        newProject.id,
        newProject.name,
        newProject.path,
        newProject.templateId,
        newProject.templateName,
        newProject.status,
        newProject.isFavorite ? 1 : 0,
        newProject.configCompleted ? 1 : 0,
        newProject.envVars,
        newProject.dependenciesInstalled ? 1 : 0,
        newProject.claudeSessionId,
        newProject.createdAt,
        newProject.lastOpenedAt
      )

      console.log('✅ Project created in database:', newProject.name)
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

      console.log(`✅ Fetched ${projects.length} projects from database`)
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
      console.log(`✅ Environment configuration saved for project: ${id}`)
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
      console.log(`✅ Dependencies marked as installed for project: ${id}`)
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
      console.log(`✅ Project favorite toggled: ${id} → ${newStatus}`)

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
      console.log(`✅ Project status updated: ${id} → ${status}`)
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
      console.log(`✅ Project last opened updated: ${id}`)
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
      throw new Error('Database not initialized')
    }

    const sql = 'UPDATE projects SET claudeSessionId = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(sessionId, projectId)
      console.log(`✅ Claude session ID saved for project: ${projectId}`)
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
      throw new Error('Database not initialized')
    }

    const contextJson = JSON.stringify(context)
    const sql = 'UPDATE projects SET claudeContext = ? WHERE id = ?'

    try {
      this.db.prepare(sql).run(contextJson, projectId)
      console.log(`✅ Claude context saved for project: ${projectId}`)
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
   * Delete project from database
   */
  deleteProject(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const sql = 'DELETE FROM projects WHERE id = ?'

    try {
      this.db.prepare(sql).run(id)
      console.log(`✅ Project deleted from database: ${id}`)
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
      console.log(`✅ Project renamed in database: ${id} → ${newName}`)

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
  createChatBlock(projectId: string, userPrompt: string): ChatBlock {
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
      createdAt: Date.now()
    }

    const sql = `
      INSERT INTO chat_history (id, projectId, blockIndex, userPrompt, claudeMessages, toolExecutions, commitHash, filesChanged, completionStats, summary, actions, completedAt, isComplete, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        newBlock.createdAt
      )

      console.log(`✅ Chat block created: ${newBlock.id} for project ${projectId}`)
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
      throw new Error('Database not initialized')
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

    if (fields.length === 0) {
      return // Nothing to update
    }

    values.push(blockId)
    const sql = `UPDATE chat_history SET ${fields.join(', ')} WHERE id = ?`

    try {
      this.db.prepare(sql).run(...values)
      console.log(`✅ Chat block updated: ${blockId}`)
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
    type: 'git_commit' | 'build' | 'dev_server'
    status: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
    timestamp: number
  }): void {
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
  }

  /**
   * Update an action in a chat block
   */
  updateAction(blockId: string, actionIndex: number, updates: {
    status?: 'in_progress' | 'success' | 'error'
    message?: string
    data?: any
  }): void {
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
        createdAt: row.createdAt
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
      console.log(`✅ Chat history deleted for project: ${projectId}`)
    } catch (error) {
      console.error('❌ Failed to delete chat history:', error)
      throw error
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      console.log('📊 Database connection closed')
    }
  }
}

export const databaseService = new DatabaseService()
