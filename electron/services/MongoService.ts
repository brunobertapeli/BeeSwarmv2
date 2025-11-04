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
  type: 'frontend' | 'fullstack' | 'backend'
  category: string
  githubUrl: string
  requiredPlan: 'free' | 'plus' | 'premium'
  requiredServices: string[]
  demoUrl?: string
  techStack: string[]
}

class MongoService {
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
      console.error('Please ensure .env file exists with:')
      console.error('  - MONGODB_URI')
      console.error('  - MONGODB_DATABASE (optional, defaults to "codedeck")')
    } else {
      console.log('✅ MongoDB configuration loaded successfully')
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
      console.log('✅ Connected to MongoDB')
    } catch (error) {
      console.error('❌ MongoDB connection error:', error)
      throw error
    }
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const usersCollection = this.db!.collection('users')
      const user = await usersCollection.findOne({ email })

      if (!user) {
        console.log('User not found:', email)
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

      const usersCollection = this.db!.collection('users')

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
      console.log('✅ User created in MongoDB:', newUser.email)

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

      const templatesCollection = this.db!.collection('templates')
      const templates = await templatesCollection.find({}).toArray()

      console.log(`✅ Fetched ${templates.length} templates from MongoDB`)

      return templates.map(template => ({
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type || 'fullstack',
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan || 'free',
        requiredServices: template.requiredServices || [],
        demoUrl: template.demoUrl,
        techStack: template.techStack || []
      }))
    } catch (error) {
      console.error('Error fetching templates from MongoDB:', error)
      throw error
    }
  }

  async getTemplateById(templateId: string): Promise<Template | null> {
    this.init()

    try {
      if (!this.db) {
        await this.connect()
      }

      const templatesCollection = this.db!.collection('templates')
      const template = await templatesCollection.findOne({ id: templateId })

      if (!template) {
        console.log('Template not found:', templateId)
        return null
      }

      console.log('✅ Fetched template from MongoDB:', template.name)

      return {
        _id: template._id.toString(),
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type || 'fullstack',
        category: template.category,
        githubUrl: template.githubUrl,
        requiredPlan: template.requiredPlan || 'free',
        requiredServices: template.requiredServices || [],
        demoUrl: template.demoUrl,
        techStack: template.techStack || []
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
        console.log('MongoDB connection closed')
      }
    } catch (error) {
      console.error('Error closing MongoDB connection:', error)
    }
  }
}

export const mongoService = new MongoService()
