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
