export interface User {
  id: string
  email: string
  name: string
  photoUrl?: string
  plan: 'free' | 'plus' | 'premium'
}

export interface AuthSession {
  user: User
  expiresAt: number // Unix timestamp
  supabaseSession?: any // Supabase session object
}

export interface AuthResponse {
  success: boolean
  user?: User
  session?: any
  error?: string
}
