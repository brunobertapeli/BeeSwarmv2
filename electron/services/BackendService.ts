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
  imagePath?: string
  screenshot?: string
}

class BackendService {
  private baseUrl: string = ''
  private initialized: boolean = false

  private init() {
    if (this.initialized) return

    this.baseUrl = process.env.VITE_BACKEND_URL || 'https://codedeck-backend.onrender.com'
    this.initialized = true
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
}

export const backendService = new BackendService()
