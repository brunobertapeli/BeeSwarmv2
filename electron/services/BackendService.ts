import https from 'https';
import http from 'http';
import fs from 'fs';

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
  envFiles?: Array<{
    path: string
    label: string
    description: string
  }>
  imagePath?: string
  screenshot?: string
}

// AI Models interfaces
export interface AIModel {
  id: string
  displayName: string
  description: string
  provider: string
  maxTokens?: number
  sizes?: string[]
}

export interface AIModelsResponse {
  chat: AIModel[]
  images: AIModel[]
}

export interface AIUsageResponse {
  usage: {
    chatTokens: number
    imageCount: number
    date: string
  }
  limits: {
    chatTokensPerDay: number
    imagesPerDay: number
  }
  plan: string
}

class BackendService {
  private baseUrl: string = ''
  private initialized: boolean = false
  private authToken: string = ''

  private init() {
    if (this.initialized) return

    this.baseUrl = process.env.VITE_BACKEND_URL || 'https://codedeck-backend.onrender.com'
    this.initialized = true
  }

  setAuthToken(token: string): void {
    this.authToken = token
  }

  getAuthToken(): string {
    return this.authToken
  }

  private async makeRequest<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    this.init()

    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }

      const req = client.request(url, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed)
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      if (body && method === 'POST') {
        req.write(JSON.stringify(body))
      }

      req.end()
    })
  }

  async getUserByEmail(email: string): Promise<UserData | null> {
    try {
      const encodedEmail = encodeURIComponent(email)
      const response = await this.makeRequest<{ success: boolean; user: UserData }>(
        `/api/v1/users/${encodedEmail}`,
        'GET'
      )

      return response.user
    } catch (error: any) {
      if (error.message.includes('404') || error.message.includes('User not found')) {
        return null
      }
      console.error('Error fetching user from backend:', error)
      throw error
    }
  }

  async createUser(userData: Partial<UserData>): Promise<UserData> {
    try {
      const response = await this.makeRequest<{ success: boolean; user: UserData }>(
        '/api/v1/users',
        'POST',
        userData
      )

      return response.user
    } catch (error) {
      console.error('Error creating user via backend:', error)
      throw error
    }
  }

  async validateUserPlan(email: string, requiredPlan: 'free' | 'plus' | 'premium'): Promise<{
    hasAccess: boolean
    userPlan: string
    requiredPlan: string
    subscriptionStatus: string
  }> {
    try {
      const response = await this.makeRequest<{
        success: boolean
        hasAccess: boolean
        userPlan: string
        requiredPlan: string
        subscriptionStatus: string
      }>(
        '/api/v1/users/validate-plan',
        'POST',
        { email, requiredPlan }
      )

      return {
        hasAccess: response.hasAccess,
        userPlan: response.userPlan,
        requiredPlan: response.requiredPlan,
        subscriptionStatus: response.subscriptionStatus
      }
    } catch (error) {
      console.error('Error validating user plan via backend:', error)
      throw error
    }
  }

  async getTemplates(): Promise<Template[]> {
    try {
      const response = await this.makeRequest<{ success: boolean; templates: Template[] }>(
        '/api/v1/templates',
        'GET'
      )

      return response.templates
    } catch (error) {
      console.error('Error fetching templates from backend:', error)
      throw error
    }
  }

  async getTemplateById(templateId: string): Promise<Template | null> {
    try {
      const encodedId = encodeURIComponent(templateId)
      const response = await this.makeRequest<{ success: boolean; template: Template }>(
        `/api/v1/templates/${encodedId}`,
        'GET'
      )

      return response.template
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null
      }
      console.error('Error fetching template from backend:', error)
      throw error
    }
  }

  async downloadTemplate(templateId: string, destinationPath: string, userEmail: string): Promise<void> {
    this.init()

    return new Promise((resolve, reject) => {
      const encodedId = encodeURIComponent(templateId)
      const url = new URL(`/api/v1/templates/${encodedId}/download`, this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const options = {
        headers: {
          'x-user-email': userEmail
        }
      }

      const req = client.get(url, options, (res) => {
        // Check for successful response
        if (res.statusCode === 200) {
          const fileStream = fs.createWriteStream(destinationPath)

          res.pipe(fileStream)

          fileStream.on('finish', () => {
            fileStream.close(() => {
              resolve()
            })
          })

          fileStream.on('error', (error: Error) => {
            fs.unlink(destinationPath, () => {}) // Clean up partial file
            reject(error)
          })

          res.on('error', (error: Error) => {
            fs.unlink(destinationPath, () => {}) // Clean up partial file
            reject(error)
          })
        } else {
          // For error responses, try to read JSON error message
          let data = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data)

              // Enhanced error message for plan validation failures
              if (res.statusCode === 403 && parsed.requiredPlan) {
                const planError = new Error(
                  `This template requires a ${parsed.requiredPlan} plan. Your current plan is ${parsed.userPlan}.`
                ) as any
                planError.code = 'PLAN_UPGRADE_REQUIRED'
                planError.requiredPlan = parsed.requiredPlan
                planError.userPlan = parsed.userPlan
                planError.subscriptionStatus = parsed.subscriptionStatus
                reject(planError)
              } else {
                reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
              }
            } catch {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`))
            }
          })
        }
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.end()
    })
  }

  async loginWithSupabaseToken(supabaseToken: string): Promise<{ token: string; user: UserData }> {
    this.init()

    return new Promise((resolve, reject) => {
      const url = new URL('/api/v1/auth/login', this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const payload = JSON.stringify({
        supabaseToken: supabaseToken
      })

      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const req = client.request(url, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ token: parsed.token, user: parsed.user })
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.write(payload)
      req.end()
    })
  }

  async createStripePortalSession(token: string): Promise<{ url: string }> {
    this.init()

    return new Promise((resolve, reject) => {
      const url = new URL('/api/v1/stripe/create-portal-session', this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const options = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }

      const req = client.request(url, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ url: parsed.url })
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.end()
    })
  }

  // Authenticated request helper for AI endpoints
  private async makeAuthenticatedRequest<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    this.init()

    if (!this.authToken) {
      throw new Error('Not authenticated')
    }

    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      const options: https.RequestOptions = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      }

      const req = client.request(url, options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)

            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed)
            } else {
              reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      if (body && method === 'POST') {
        req.write(JSON.stringify(body))
      }

      req.end()
    })
  }

  // AI Methods

  async getAIModels(): Promise<AIModelsResponse> {
    const response = await this.makeAuthenticatedRequest<{ success: boolean; models: AIModelsResponse; plan: string; limits: any }>(
      '/api/v1/ai/models'
    )
    return response.models
  }

  async getAIUsage(): Promise<AIUsageResponse> {
    const response = await this.makeAuthenticatedRequest<{ success: boolean } & AIUsageResponse>(
      '/api/v1/ai/usage'
    )
    return {
      usage: response.usage,
      limits: response.limits,
      plan: response.plan
    }
  }

  async generateImage(prompt: string, size?: string): Promise<{ image: string; usage: { imagesGenerated: number; imagesRemaining: number } }> {
    const response = await this.makeAuthenticatedRequest<{
      success: boolean
      image: string
      usage: { imagesGenerated: number; imagesRemaining: number }
    }>(
      '/api/v1/ai/image',
      'POST',
      { prompt, size }
    )
    return { image: response.image, usage: response.usage }
  }

  async removeBackground(imageBase64: string): Promise<{ success: boolean; imageUrl?: string; usage?: { count: number; limit: number; remaining: number }; error?: string }> {
    this.init()

    if (!this.authToken) {
      return { success: false, error: 'Not authenticated' }
    }

    return new Promise((resolve) => {
      const url = new URL('/api/v1/ai/background-removal', this.baseUrl)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      console.log(`[BG-REMOVER-SERVICE] Sending request to ${url.toString()}`)

      const options: https.RequestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        timeout: 120000 // 2 minute timeout
      }

      const req = client.request(url, options, (res) => {
        let data = ''
        console.log(`[BG-REMOVER-SERVICE] Response status: ${res.statusCode}`)

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          console.log(`[BG-REMOVER-SERVICE] Response received, length: ${data.length}`)
          try {
            const parsed = JSON.parse(data)
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, imageUrl: parsed.imageUrl, usage: parsed.usage })
            } else {
              resolve({ success: false, error: parsed.error || `HTTP ${res.statusCode}` })
            }
          } catch (error) {
            console.error(`[BG-REMOVER-SERVICE] JSON parse error:`, data.substring(0, 200))
            resolve({ success: false, error: 'Invalid JSON response' })
          }
        })
      })

      req.on('error', (error) => {
        console.error(`[BG-REMOVER-SERVICE] Request error:`, error.message)
        resolve({ success: false, error: error.message })
      })

      req.on('timeout', () => {
        console.error(`[BG-REMOVER-SERVICE] Request timeout`)
        req.destroy()
        resolve({ success: false, error: 'Request timeout' })
      })

      const body = JSON.stringify({ image: imageBase64 })
      console.log(`[BG-REMOVER-SERVICE] Sending body, size: ${Math.round(body.length / 1024)}KB`)
      req.write(body)
      req.end()
    })
  }

  // Streaming chat - returns a readable stream
  streamChat(
    messages: Array<{ role: string; content: string }>,
    model: string,
    onChunk: (chunk: string) => void,
    onDone: (usage: any) => void,
    onError: (error: Error) => void
  ): void {
    this.init()

    if (!this.authToken) {
      onError(new Error('Not authenticated'))
      return
    }

    const url = new URL('/api/v1/ai/chat', this.baseUrl)
    const isHttps = url.protocol === 'https:'
    const client = isHttps ? https : http

    const payload = JSON.stringify({ messages, model })

    const options: https.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${this.authToken}`
      }
    }

    const req = client.request(url, options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = ''
        res.on('data', (chunk) => { errorData += chunk })
        res.on('end', () => {
          try {
            const parsed = JSON.parse(errorData)
            onError(new Error(parsed.error || `HTTP ${res.statusCode}`))
          } catch {
            onError(new Error(`HTTP ${res.statusCode}`))
          }
        })
        return
      }

      let buffer = ''

      res.on('data', (chunk) => {
        buffer += chunk.toString()

        // Process complete SSE events
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              continue
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'chunk' && parsed.content) {
                onChunk(parsed.content)
              } else if (parsed.type === 'done') {
                onDone(parsed.usage)
              } else if (parsed.type === 'error') {
                onError(new Error(parsed.error))
              }
            } catch {
              // Ignore parse errors for incomplete data
            }
          }
        }
      })

      res.on('end', () => {
        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6)
          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'done') {
              onDone(parsed.usage)
            }
          } catch {
            // Ignore
          }
        }
      })

      res.on('error', (error) => {
        onError(error)
      })
    })

    req.on('error', (error) => {
      onError(error)
    })

    req.write(payload)
    req.end()
  }
}

export const backendService = new BackendService()
