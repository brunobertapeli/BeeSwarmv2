/**
 * Tech Stack Configuration
 *
 * Centralized configuration for tech stack display names, colors, and icon paths.
 * Used across TemplateSelector, ProjectSelector, and TechIcon components.
 *
 * Database stores lowercase keys (e.g., 'nodejs', 'react', 'mongodb')
 * This config maps them to display names and icon filenames.
 */

export interface TechStackConfig {
  displayName: string
  color: string
  iconFileName: string // SVG filename in /src/assets/tech-icons/
}

export const TECH_STACK_CONFIG: Record<string, TechStackConfig> = {
  react: {
    displayName: 'React',
    color: '#61DAFB',
    iconFileName: 'react.svg'
  },
  node: {
    displayName: 'Node.js',
    color: '#339933',
    iconFileName: 'nodejs.svg'
  },
  nodejs: {
    displayName: 'Node.js',
    color: '#339933',
    iconFileName: 'nodejs.svg'
  },
  mongodb: {
    displayName: 'MongoDB',
    color: '#47A248',
    iconFileName: 'mongodb.svg'
  },
  stripe: {
    displayName: 'Stripe',
    color: '#635BFF',
    iconFileName: 'stripe.svg'
  },
  supabase: {
    displayName: 'Supabase',
    color: '#3ECF8E',
    iconFileName: 'supabase.svg'
  },
  materialui: {
    displayName: 'Material UI',
    color: '#007FFF',
    iconFileName: 'materialui.svg'
  }
}

/**
 * Get tech stack configuration by key (case-insensitive)
 */
export function getTechConfig(techKey: string): TechStackConfig {
  if (!techKey) {
    return {
      displayName: 'Unknown',
      color: '#888888',
      iconFileName: 'default.svg'
    }
  }
  const key = techKey.toLowerCase()
  return TECH_STACK_CONFIG[key] || {
    displayName: techKey.charAt(0).toUpperCase() + techKey.slice(1),
    color: '#888888',
    iconFileName: `${key}.svg`
  }
}
