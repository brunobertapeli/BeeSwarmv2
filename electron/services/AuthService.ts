import { BrowserWindow, shell, app } from 'electron'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  name: string
  photoUrl?: string
  plan: 'free' | 'plus' | 'premium'
}

class AuthService {
  private supabase: SupabaseClient | null = null
  private supabaseUrl: string = ''
  private supabaseAnonKey: string = ''
  private initialized: boolean = false

  private init() {
    if (this.initialized) return

    // These are public Supabase credentials (anon key is designed to be public)
    // In dev, env vars are available via Vite; in production, use hardcoded values
    this.supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://xstqigedezzkrvtsnmko.supabase.co'
    this.supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzdHFpZ2VkZXp6a3J2dHNubWtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3NzEzODcsImV4cCI6MjA1ODM0NzM4N30.XzbXQJLJENxBDpMSefpZiV8P8tQ8rV03ddB3SkPAP2g'

    this.initialized = true
  }

  getSupabaseClient(): SupabaseClient {
    this.init()

    if (!this.supabase) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true
        }
      })
    }
    return this.supabase
  }

  async signInWithGoogle(mainWindow: BrowserWindow): Promise<{ url: string; popup: BrowserWindow | null }> {
    try {
      const supabase = this.getSupabaseClient()

      // Use deep link callback for production, localhost for dev
      const redirectTo = app.isPackaged
        ? 'codedeck://auth/callback'
        : 'http://localhost:5173/auth/callback'

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })

      if (error) {
        throw error
      }

      if (!data.url) {
        throw new Error('No OAuth URL returned from Supabase')
      }

      // In production, use system browser (Google blocks embedded browsers)
      // In dev, use popup window for easier debugging
      if (app.isPackaged) {
        shell.openExternal(data.url)
        return { url: data.url, popup: null }
      } else {
        // Create a popup window for OAuth (dev only)
        const popup = new BrowserWindow({
          width: 500,
          height: 700,
          show: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          },
          parent: mainWindow,
          modal: true,
          title: 'Sign in with Google'
        })

        popup.loadURL(data.url)
        return { url: data.url, popup }
      }
    } catch (error) {
      throw error
    }
  }

  async signInWithFacebook(mainWindow: BrowserWindow): Promise<{ url: string; popup: BrowserWindow }> {
    try {
      const supabase = this.getSupabaseClient()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: 'http://localhost:5173/auth/callback',
          skipBrowserRedirect: true
        }
      })

      if (error) {
        throw error
      }

      if (!data.url) {
        throw new Error('No OAuth URL returned from Supabase')
      }

      // Create a popup window for OAuth
      const popup = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        parent: mainWindow,
        modal: true,
        title: 'Sign in with Facebook'
      })

      popup.loadURL(data.url)

      return { url: data.url, popup }
    } catch (error) {
      throw error
    }
  }

  async signInWithGithub(mainWindow: BrowserWindow): Promise<{ url: string; popup: BrowserWindow }> {
    try {
      const supabase = this.getSupabaseClient()

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:5173/auth/callback',
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account'
          }
        }
      })

      if (error) {
        throw error
      }

      if (!data.url) {
        throw new Error('No OAuth URL returned from Supabase')
      }

      // Create a popup window for OAuth
      const popup = new BrowserWindow({
        width: 500,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        },
        parent: mainWindow,
        modal: true,
        title: 'Sign in with GitHub'
      })

      popup.loadURL(data.url)

      return { url: data.url, popup }
    } catch (error) {
      throw error
    }
  }

  async handleAuthCallback(url: string): Promise<any> {
    try {
      const supabase = this.getSupabaseClient()

      // Extract the code from URL
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')

      if (!code) {
        throw new Error('No authorization code found in callback URL')
      }

      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        throw error
      }

      if (!data.session) {
        throw new Error('No session returned from Supabase')
      }

      return {
        session: data.session,
        user: data.user
      }
    } catch (error) {
      throw error
    }
  }

  async getSession(): Promise<any> {
    try {
      const supabase = this.getSupabaseClient()
      const { data, error } = await supabase.auth.getSession()

      if (error) {
        throw error
      }

      return data.session
    } catch (error) {
      throw error
    }
  }

  async signOut(): Promise<void> {
    try {
      const supabase = this.getSupabaseClient()
      const { error } = await supabase.auth.signOut({ scope: 'local' })

      if (error) {
        throw error
      }

      // Reset the client to clear any cached state
      this.supabase = null
    } catch (error) {
      throw error
    }
  }
}

export const authService = new AuthService()
