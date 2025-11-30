/**
 * Shared env key target mappings
 * Used by both frontend (ProjectCreationFlow) and backend (projectHandlers)
 * to determine which .env file each key should be written to
 */

export type EnvTarget = 'frontend' | 'backend'

// Explicit mappings for known keys
export const ENV_KEY_TARGETS: Record<string, EnvTarget> = {
  // Stripe - publishable is frontend, secrets are backend
  STRIPE_PUBLISHABLE_KEY: 'frontend',
  STRIPE_SECRET_KEY: 'backend',
  STRIPE_RESTRICTED_KEY: 'backend',
  STRIPE_WEBHOOK_SECRET: 'backend',

  // Supabase - URL and anon key are frontend, service role is backend
  SUPABASE_URL: 'frontend',
  SUPABASE_ANON_KEY: 'frontend',
  SUPABASE_SERVICE_ROLE_KEY: 'backend',

  // MongoDB - always backend
  MONGODB_URI: 'backend',
}

/**
 * Get the target .env file for a given key
 * - VITE_ prefixed keys always go to frontend
 * - Known keys use the mapping above
 * - Unknown keys default to backend (safer for secrets)
 */
export const getEnvKeyTarget = (key: string): EnvTarget => {
  // VITE_ prefixed keys always go to frontend
  if (key.startsWith('VITE_')) return 'frontend'
  return ENV_KEY_TARGETS[key] || 'backend'
}
