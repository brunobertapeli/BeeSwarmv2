import { MongoClient, Db } from 'mongodb'

export interface UserData {
  email: string
  name: string
  photoUrl?: string
  authProvider: 'google' | 'facebook' | 'github' | 'email'
  plan: 'free' | 'plus' | 'premium'
  subscriptionStatus: 'active' | 'expired' | 'canceled'
  stripeCustomerId?: string
  createdAt: Date
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
  libraries?: Array<{
    name: string
    description: string
  }>
  deployServices?: string[]
  imagePath?: string
}

class MongoService {
  private client: MongoClient | null = null
  private db: Db | null = null
  private uri: string = ''
  private dbName: string = 'codedeck'
  private initialized: boolean = false
  private connecting: Promise<void> | null = null

  /**
   * SECURITY: Sanitize user input to prevent MongoDB injection attacks
   * Ensures input is a primitive string, not an object with MongoDB operators
   */
  private sanitizeInput(input: any, fieldName: string): string {
    if (typeof input !== 'string') {
      throw new Error(`Invalid ${fieldName}: must be a string`)
    }

    if (input.trim().length === 0) {
      throw new Error(`Invalid ${fieldName}: cannot be empty`)
    }

    return input.trim()
  }

  private init() {
    if (this.initialized) return

    this.uri = process.env.MONGODB_URI || ''
    this.dbName = process.env.MONGODB_DATABASE || 'codedeck'

    if (!this.uri) {
      console.error('⚠️  MongoDB URI not found in environment variables')
      console.error('Please ensure .env file exists with:')
      console.error('  - MONGODB_URI')
      console.error('  - MONGODB_DATABASE (optional, defaults to "codedeck")')
    } else {
    }

    this.initialized = true
  }

  async connect(): Promise<void> {
    this.init()

    // If already connected, return immediately
    if (this.client && this.db) {
      return
    }

    // If already connecting, wait for that connection to complete
    if (this.connecting) {
      return this.connecting
    }

    // Start new connection with retry logic
    this.connecting = this.connectWithRetry()

    try {
      await this.connecting
    } finally {
      this.connecting = null
    }
  }

  private async connectWithRetry(maxRetries: number = 3, retryDelay: number = 1000): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this.client && this.db) {
          return // Already connected (race condition check)
        }

        this.client = new MongoClient(this.uri, {
          serverSelectionTimeoutMS: 5000, // 5 second timeout
          connectTimeoutMS: 10000 // 10 second connect timeout
        })

        await this.client.connect()
        this.db = this.client.db(this.dbName)
        console.log('✓ MongoDB connected successfully')
        return
      } catch (error) {
        lastError = error as Error
        console.error(`❌ MongoDB connection attempt ${attempt}/${maxRetries} failed:`, error)

        // Clean up failed connection
        if (this.client) {
          try {
            await this.client.close()
          } catch (closeError) {
            // Ignore close errors
          }
          this.client = null
          this.db = null
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt))
        }
      }
    }

    throw new Error(`MongoDB connection failed after ${maxRetries} attempts: ${lastError?.message}`)
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    this.init()

    try {
      // SECURITY: Sanitize email to prevent MongoDB injection
      const sanitizedEmail = this.sanitizeInput(email, 'email')

      if (!this.db) {
        await this.connect()
      }

      if (!this.db) {
        throw new Error('MongoDB connection not established')
      }

      const usersCollection = this.db.collection('users')
      const user = await usersCollection.findOne({ email: sanitizedEmail })

      if (!user) {
        return null
      }

      return {
        email: user.email,
        name: user.name || user.email.split('@')[0], // Fallback to email username if name not set
        photoUrl: user.photoUrl,
        authProvider: user.authProvider || 'email',
        plan: user.plan || 'free',
        subscriptionStatus: user.subscriptionStatus || 'active',
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt || new Date()
      }
    } catch (error) {
      console.error('Error fetching user from MongoDB:', error)
      throw error
    }
  }

  async createUser(userData: Partial<UserData>): Promise<UserData> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      if (!this.db) {
        throw new Error('MongoDB connection not established')
      }

      const usersCollection = this.db.collection('users')

      const newUser = {
        email: userData.email!,
        name: userData.name || userData.email!.split('@')[0],
        photoUrl: userData.photoUrl,
        authProvider: userData.authProvider || 'google',
        plan: 'free',
        subscriptionStatus: 'active',
        createdAt: new Date()
      }

      await usersCollection.insertOne(newUser)

      return newUser as UserData
    } catch (error) {
      console.error('Error creating user in MongoDB:', error)
      throw error
    }
  }

  async getTemplates(): Promise<Template[]> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      if (!this.db) {
        throw new Error('MongoDB connection not established')
      }

      const templatesCollection = this.db.collection('templates')
      const templates = await templatesCollection.find({}).toArray()


      return templates.map(template => ({
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        longDescription: template.longDescription,
        type: template.type || 'fullstack',
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan || 'free',
        requiredServices: template.requiredServices || [],
        demoUrl: template.demoUrl,
        techStack: template.techStack || [],
        libraries: template.libraries || [],
        deployServices: template.deployServices || [],
        imagePath: template.imagePath
      }))
    } catch (error) {
      console.error('Error fetching templates from MongoDB:', error)
      throw error
    }
  }

  async getTemplateById(templateId: string): Promise<Template | null> {
    this.init()

    try {
      // SECURITY: Sanitize templateId to prevent MongoDB injection
      const sanitizedTemplateId = this.sanitizeInput(templateId, 'templateId')

      if (!this.db) {
        await this.connect()
      }

      if (!this.db) {
        throw new Error('MongoDB connection not established')
      }

      const templatesCollection = this.db.collection('templates')
      const template = await templatesCollection.findOne({ id: sanitizedTemplateId })

      if (!template) {
        return null
      }


      return {
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        longDescription: template.longDescription,
        type: template.type || 'fullstack',
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan || 'free',
        requiredServices: template.requiredServices || [],
        demoUrl: template.demoUrl,
        techStack: template.techStack || [],
        libraries: template.libraries || [],
        deployServices: template.deployServices || [],
        imagePath: template.imagePath
      }
    } catch (error) {
      console.error('Error fetching template from MongoDB:', error)
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
      console.error('Error closing MongoDB connection:', error)
    }
  }
}

export const mongoService = new MongoService()
