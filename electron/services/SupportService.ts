import { MongoClient, Db, ObjectId } from 'mongodb'

export interface SupportMessage {
  _id?: ObjectId
  userId: string
  userName: string
  userEmail: string
  type: 'user' | 'support'
  content: string
  timestamp: Date
  read: boolean
}

export interface SupportSession {
  _id?: ObjectId
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
  _id?: ObjectId
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
  _id?: ObjectId
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
  _id?: ObjectId
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

class SupportService {
  private client: MongoClient | null = null
  private db: Db | null = null
  private uri: string = ''
  private dbName: string = 'codedeck'
  private initialized: boolean = false

  private init() {
    if (this.initialized) return

    this.uri = process.env.MONGODB_URI || ''
    this.dbName = process.env.MONGODB_DATABASE || 'codedeck'

    if (!this.uri) {
      console.error('⚠️  MongoDB URI not found in environment variables')
    } else {
    }

    this.initialized = true
  }

  async connect(): Promise<void> {
    this.init()

    try {
      if (this.client) {
        return // Already connected
      }

      this.client = new MongoClient(this.uri)
      await this.client.connect()
      this.db = this.client.db(this.dbName)
    } catch (error) {
      console.error('❌ SupportService MongoDB connection error:', error)
      throw error
    }
  }

  /**
   * Check if human support is currently available
   */
  async checkAvailability(): Promise<boolean> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const statusCollection = this.db!.collection('support_status')
      const status = await statusCollection.findOne<SupportStatus>({ _id: 'status' })

      return status?.available || false
    } catch (error) {
      console.error('Error checking support availability:', error)
      throw error
    }
  }

  /**
   * Save a message to the active support session
   */
  async saveMessage(data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    type: 'user' | 'support'
    content: string
  }): Promise<SupportMessage> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const message: SupportMessage = {
        _id: new ObjectId(),
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        type: data.type,
        content: data.content,
        timestamp: new Date(),
        read: false
      }

      const sessionsCollection = this.db!.collection('support_sessions')

      // Find or create session
      await sessionsCollection.findOneAndUpdate(
        { userId: data.userId, status: 'active' },
        {
          $setOnInsert: {
            userId: data.userId,
            userName: data.userName,
            userEmail: data.userEmail,
            projectId: data.projectId,
            messages: [],
            status: 'active',
            createdAt: new Date()
          },
          $push: { messages: message },
          $set: { updatedAt: new Date() }
        },
        { upsert: true }
      )

      return message
    } catch (error) {
      console.error('Error saving support message:', error)
      throw error
    }
  }

  /**
   * Get user's active support session
   */
  async getSession(userId: string): Promise<SupportSession | null> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const sessionsCollection = this.db!.collection('support_sessions')
      const session = await sessionsCollection.findOne<SupportSession>({
        userId,
        status: 'active'
      })

      return session || null
    } catch (error) {
      console.error('Error fetching support session:', error)
      throw error
    }
  }

  /**
   * Add user to human support queue
   */
  async addToQueue(data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    lastMessage: string
  }): Promise<SupportQueueEntry> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const queueEntry: SupportQueueEntry = {
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        projectId: data.projectId,
        lastMessage: data.lastMessage,
        status: 'waiting',
        createdAt: new Date()
      }

      const queueCollection = this.db!.collection('support_queue')
      const result = await queueCollection.insertOne(queueEntry)
      queueEntry._id = result.insertedId

      return queueEntry
    } catch (error) {
      console.error('Error adding to support queue:', error)
      throw error
    }
  }

  /**
   * Send offline message (when support is unavailable)
   */
  async sendOfflineMessage(data: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    subject: string
    message: string
  }): Promise<SupportOfflineMessage> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const offlineMessage: SupportOfflineMessage = {
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        projectId: data.projectId,
        subject: data.subject,
        message: data.message,
        status: 'new',
        createdAt: new Date()
      }

      const messagesCollection = this.db!.collection('support_messages')
      const result = await messagesCollection.insertOne(offlineMessage)
      offlineMessage._id = result.insertedId

      return offlineMessage
    } catch (error) {
      console.error('Error sending offline message:', error)
      throw error
    }
  }

  /**
   * Submit a bug report
   */
  async submitBugReport(report: {
    userId: string
    userName: string
    userEmail: string
    projectId?: string
    bugType: 'ui' | 'functionality' | 'performance' | 'crash' | 'templates' | 'other'
    title: string
    description: string
    stepsToReproduce?: string
  }): Promise<BugReport> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const bugReport: BugReport = {
        userId: report.userId,
        userName: report.userName,
        userEmail: report.userEmail,
        projectId: report.projectId,
        bugType: report.bugType,
        title: report.title,
        description: report.description,
        stepsToReproduce: report.stepsToReproduce,
        status: 'new',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      const bugsCollection = this.db!.collection('bug_reports')
      const result = await bugsCollection.insertOne(bugReport)
      bugReport._id = result.insertedId

      return bugReport
    } catch (error) {
      console.error('Error submitting bug report:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close()
        this.client = null
        this.db = null
      }
    } catch (error) {
      console.error('Error closing SupportService MongoDB connection:', error)
    }
  }
}

export const supportService = new SupportService()
