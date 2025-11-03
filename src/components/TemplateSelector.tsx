import { useState, useEffect } from 'react'
import { X, Sparkles, ExternalLink, Crown } from 'lucide-react'
import TechIcon from './TechIcon'
import { useAppStore } from '../store/appStore'
import { Template } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'

interface TemplateSelectorProps {
  isOpen: boolean
  onClose: () => void
  onCreateProject: (template: Template, projectName: string) => void
}

// Tech configuration with required API keys
export interface TechApiKey {
  name: string
  label: string
  placeholder: string
  description?: string
}

export interface TechConfig {
  name: string
  displayName: string
  icon: string
  apiKeys: TechApiKey[]
}

const TECH_CONFIGS: Record<string, TechConfig> = {
  stripe: {
    name: 'stripe',
    displayName: 'Stripe',
    icon: '/src/assets/tech-icons/stripe.svg',
    apiKeys: [
      {
        name: 'STRIPE_PUBLISHABLE_KEY',
        label: 'Publishable Key',
        placeholder: 'pk_test_...',
        description: 'Used for client-side operations',
      },
      {
        name: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        placeholder: 'sk_test_...',
        description: 'Used for server-side operations',
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        label: 'Webhook Signing Secret',
        placeholder: 'whsec_...',
        description: 'Used to verify webhook events',
      },
    ],
  },
  mongodb: {
    name: 'mongodb',
    displayName: 'MongoDB',
    icon: '/src/assets/tech-icons/mongodb.svg',
    apiKeys: [
      {
        name: 'MONGODB_URI',
        label: 'Connection String',
        placeholder: 'mongodb+srv://username:password@cluster.mongodb.net/database',
        description: 'Your MongoDB connection string',
      },
    ],
  },
  supabase: {
    name: 'supabase',
    displayName: 'Supabase',
    icon: '/src/assets/tech-icons/supabase.svg',
    apiKeys: [
      {
        name: 'SUPABASE_URL',
        label: 'Project URL',
        placeholder: 'https://xxxxx.supabase.co',
        description: 'Your Supabase project URL',
      },
      {
        name: 'SUPABASE_ANON_KEY',
        label: 'Anon Key',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Public anonymous key for client-side',
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        label: 'Service Role Key',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        description: 'Secret key for server-side admin operations',
      },
    ],
  },
}

// Get required tech configs based on required services
const getRequiredTechConfigs = (requiredServices: string[]): TechConfig[] => {
  const configs: TechConfig[] = []
  requiredServices.forEach((service) => {
    if (TECH_CONFIGS[service]) {
      configs.push(TECH_CONFIGS[service])
    }
  })
  return configs
}

// Plan hierarchy
const PLAN_HIERARCHY = {
  free: 0,
  plus: 1,
  premium: 2,
}

// Check if user can access a template
const canAccessTemplate = (userPlan: 'free' | 'plus' | 'premium', requiredPlan: 'free' | 'plus' | 'premium'): boolean => {
  return PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[requiredPlan]
}

// Get plan badge color (matching UserProfile design)
const getPlanBadgeColor = (plan: 'free' | 'plus' | 'premium') => {
  switch (plan) {
    case 'premium':
      return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    case 'plus':
      return 'bg-primary'
    default:
      return 'bg-gray-500'
  }
}

// Get plan label
const getPlanLabel = (plan: 'free' | 'plus' | 'premium') => {
  switch (plan) {
    case 'premium':
      return 'Premium'
    case 'plus':
      return 'Plus'
    default:
      return 'Free'
  }
}

// Mini tech icon component for the list (with hover effects)
function MiniTechIcon({ tech }: { tech: string }) {
  const [isHovered, setIsHovered] = useState(false)
  const config = {
    react: { color: '#61DAFB', displayName: 'React' },
    node: { color: '#339933', displayName: 'Node.js' },
    mongodb: { color: '#47A248', displayName: 'MongoDB' },
    stripe: { color: '#635BFF', displayName: 'Stripe' },
    supabase: { color: '#3ECF8E', displayName: 'Supabase' },
    materialui: { color: '#007FFF', displayName: 'Material UI' },
  }[tech.toLowerCase()] || { color: '#888888', displayName: tech }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-4 h-4">
        <img
          src={`/src/assets/tech-icons/${tech}.svg`}
          alt={tech}
          className="w-full h-full transition-all duration-200"
          style={{
            filter: isHovered ? 'none' : 'grayscale(100%) brightness(0.5) opacity(0.7)',
          }}
        />
      </div>
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 pointer-events-none z-10">
          <div className="px-1.5 py-0.5 bg-dark-bg/95 backdrop-blur-sm border border-dark-border rounded shadow-xl whitespace-nowrap">
            <span className="text-[9px] text-white font-medium">{config.displayName}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateSelector({ isOpen, onClose, onCreateProject }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [projectName, setProjectName] = useState('')
  const { user } = useAppStore()

  // Check if user can access selected template
  const canAccess = selectedTemplate && user ? canAccessTemplate(user.plan, selectedTemplate.requiredPlan) : true

  // Refresh user session when modal opens (to get latest plan data)
  useEffect(() => {
    const refreshUserSession = async () => {
      try {
        const result = await window.electronAPI?.auth.getSession()

        if (result?.success && result.user) {
          // Update user in store with fresh data from Supabase
          const { setUser } = useAppStore.getState()
          setUser(result.user)

          // Update localStorage to stay in sync
          const storedAuth = localStorage.getItem('beeswarm_auth')
          if (storedAuth) {
            const parsed = JSON.parse(storedAuth)
            parsed.user = result.user
            localStorage.setItem('beeswarm_auth', JSON.stringify(parsed))
          }

          console.log('✅ Refreshed user session, plan:', result.user.plan)
        }
      } catch (err) {
        console.error('Error refreshing user session:', err)
      }
    }

    if (isOpen) {
      refreshUserSession()
    }
  }, [isOpen])

  // Fetch templates from MongoDB
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true)
        setError(null)

        const result = await window.electronAPI?.templates.fetch()

        if (result?.success && result.templates) {
          setTemplates(result.templates)
          // Set first template as default selection
          if (result.templates.length > 0) {
            setSelectedTemplate(result.templates[0])
          }
        } else {
          setError(result?.error || 'Failed to fetch templates')
        }
      } catch (err) {
        console.error('Error fetching templates:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (isOpen) {
      fetchTemplates()
    }
  }, [isOpen])

  // Get unique categories from templates
  const categories = Array.from(new Set(templates.map(t => t.category)))

  // Convert project name to project ID (lowercase, spaces to dashes)
  const projectId = projectName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const handleCreate = () => {
    if (!selectedTemplate || !projectName.trim()) return

    // Just trigger the wizard - it will handle all the creation steps
    onCreateProject(selectedTemplate, projectName.trim())

    // Reset state and close
    setProjectName('')
    onClose()
  }

  const handleUpgrade = () => {
    if (!selectedTemplate) return

    // Open subscription page in browser
    const upgradeUrl = `https://beeswarm.app/upgrade?plan=${selectedTemplate.requiredPlan}`
    window.open(upgradeUrl, '_blank')

    // Close the modal
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[800px] max-h-[70vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col">
        {/* Background Image */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Header - Spans Both Columns */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50 relative z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">Create New Project</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {loading ? 'Loading templates...' : `${templates.length} templates available`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content - Two Columns */}
        <div className="flex flex-1 overflow-hidden relative z-10">
          {/* Loading State */}
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-gray-400">Loading templates...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="text-xs text-red-400 mb-2">Failed to load templates</p>
                <p className="text-[10px] text-gray-500">{error}</p>
              </div>
            </div>
          )}

          {/* Templates Content */}
          {!loading && !error && templates.length > 0 && (
            <>
          {/* Left Column - Templates List */}
          <div className="w-[320px] border-r border-dark-border flex flex-col">
            {/* Templates List by Category with Scrollbar */}
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              <div className="space-y-3">
                {categories.map((category) => {
                  const categoryTemplates = templates.filter((t) => t.category === category)
                  return (
                    <div key={category}>
                      <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-1">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryTemplates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => setSelectedTemplate(template)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg border transition-all ${
                              selectedTemplate?.id === template.id
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:border-dark-border hover:bg-dark-bg/30'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <h4 className="text-[12px] font-medium text-white">{template.name}</h4>
                              {template.requiredPlan !== 'free' && (
                                <span
                                  className={`inline-flex items-center ${getPlanBadgeColor(template.requiredPlan)} rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide`}
                                >
                                  {getPlanLabel(template.requiredPlan)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {template.techStack.slice(0, 5).map((tech) => (
                                <MiniTechIcon key={tech} tech={tech} />
                              ))}
                              {template.techStack.length > 5 && (
                                <span className="text-[9px] text-gray-600">+{template.techStack.length - 5}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Template Details */}
          <div className="flex-1 flex flex-col">
            {/* Template Details Content */}
            {selectedTemplate && (
              <div className="flex-1 overflow-y-auto p-5">
                {/* Template Title */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-lg font-bold text-white">{selectedTemplate.name}</h1>
                    {selectedTemplate.requiredPlan !== 'free' && (
                      <span
                        className={`inline-flex items-center ${getPlanBadgeColor(selectedTemplate.requiredPlan)} rounded-md px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide`}
                      >
                        {getPlanLabel(selectedTemplate.requiredPlan)}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-400 leading-relaxed">{selectedTemplate.description}</p>
                </div>

                {/* Demo Link Button */}
                <div className="mb-5">
                  <a
                    href={selectedTemplate.demoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/70 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-[11px] text-gray-300 hover:text-white font-medium transition-all group"
                  >
                    <ExternalLink size={11} className="group-hover:text-primary transition-colors" />
                    View Live Demo
                  </a>
                </div>

                {/* Tech Stack */}
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.techStack.map((tech) => (
                      <TechIcon
                        key={tech}
                        name={tech}
                        label={tech.charAt(0).toUpperCase() + tech.slice(1)}
                      />
                    ))}
                  </div>
                </div>

                {/* Project Name Input */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Awesome Project"
                    className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-all"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreate()
                    }}
                  />
                  {projectId && (
                    <p className="text-[10px] text-gray-500 mt-1.5">
                      Project ID: <span className="text-gray-400 font-mono">{projectId}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer - Create/Upgrade Button */}
            <div className="px-5 py-3 border-t border-dark-border/50 bg-dark-bg/20">
              {!canAccess ? (
                // Upgrade Button (when user cannot access template)
                <button
                  onClick={handleUpgrade}
                  className={`w-full px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all text-white shadow-lg ${
                    selectedTemplate?.requiredPlan === 'premium'
                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 shadow-yellow-400/20 hover:shadow-yellow-400/40'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/20 hover:shadow-primary/40'
                  }`}
                >
                  <Crown size={14} />
                  Upgrade to {getPlanLabel(selectedTemplate?.requiredPlan || 'plus')}
                </button>
              ) : (
                // Create Button (when user can access template)
                <button
                  onClick={handleCreate}
                  disabled={!projectName.trim()}
                  className={`w-full px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                    projectName.trim()
                      ? 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 hover:shadow-primary/40'
                      : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles size={14} />
                  Create Project
                </button>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  )
}

export default TemplateSelector
