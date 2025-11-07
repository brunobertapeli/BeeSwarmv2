import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle,
  RefreshCw,
  Code,
  Server,
  Rocket,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  FileCode,
  Download,
  Palette,
  ExternalLink,
  Crown,
  Globe,
  Eye,
  EyeOff,
  Info
} from 'lucide-react'
import { Template } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'
import TechIcon from './TechIcon'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'

type WizardStep = 'category' | 'templates' | 'details' | 'configure' | 'creating' | 'installing' | 'initializing' | 'complete' | 'error'

interface ProjectCreationFlowProps {
  isOpen: boolean
  onComplete: () => void
  onCancel: () => void
}

interface ProjectCategory {
  id: 'templates' | 'import' | 'starter'
  name: string
  description: string
  icon: React.ReactNode
  available: boolean
}

interface EnvVariable {
  key: string
  value: string
  description?: string
}

// Service variants configuration
const SERVICE_IDENTIFIERS: Record<string, {
  name: string
  provider: string
  icon: string
  required: string[]
  optional: string[]
  description: string
}> = {
  // Stripe Variants
  stripe_simple: {
    name: 'Stripe Simple Checkout',
    provider: 'stripe',
    icon: 'stripe',
    required: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY'],
    optional: [],
    description: 'Basic payment processing without webhooks'
  },
  stripe_webhooks: {
    name: 'Stripe with Webhooks',
    provider: 'stripe',
    icon: 'stripe',
    required: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    optional: [],
    description: 'Full Stripe integration with real-time events'
  },
  stripe_secure: {
    name: 'Stripe Secure',
    provider: 'stripe',
    icon: 'stripe',
    required: ['STRIPE_PUBLISHABLE_KEY', 'STRIPE_RESTRICTED_KEY'],
    optional: ['STRIPE_WEBHOOK_SECRET'],
    description: 'Stripe with restricted API keys'
  },

  // Supabase Variants
  supabase_auth: {
    name: 'Supabase Authentication',
    provider: 'supabase',
    icon: 'supabase',
    required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    optional: [],
    description: 'Authentication only (login, signup, OAuth)'
  },
  supabase_database: {
    name: 'Supabase Database',
    provider: 'supabase',
    icon: 'supabase',
    required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
    optional: ['SUPABASE_SERVICE_ROLE_KEY'],
    description: 'Auth + Database read/write operations'
  },
  supabase_full: {
    name: 'Supabase Full Access',
    provider: 'supabase',
    icon: 'supabase',
    required: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
    optional: [],
    description: 'Complete Supabase features (auth, database, storage, functions)'
  },

  // MongoDB Variants
  mongodb: {
    name: 'MongoDB Atlas',
    provider: 'mongodb',
    icon: 'mongodb',
    required: ['MONGODB_URI'],
    optional: [],
    description: 'MongoDB database connection'
  },
  mongodb_read: {
    name: 'MongoDB Read-Only',
    provider: 'mongodb',
    icon: 'mongodb',
    required: ['MONGODB_URI'],
    optional: [],
    description: 'MongoDB with read-only access'
  }
}

// Key labels and descriptions
const KEY_CONFIGS: Record<string, { label: string; description: string; validate: (value: string) => boolean }> = {
  STRIPE_PUBLISHABLE_KEY: {
    label: 'Publishable Key',
    description: 'Used for client-side operations',
    validate: (key) => /^pk_(live|test)_[a-zA-Z0-9]{24,}$/.test(key)
  },
  STRIPE_SECRET_KEY: {
    label: 'Secret Key',
    description: 'Used for server-side operations',
    validate: (key) => /^sk_(live|test)_[a-zA-Z0-9]{24,}$/.test(key)
  },
  STRIPE_RESTRICTED_KEY: {
    label: 'Restricted Key',
    description: 'Limited permissions for security',
    validate: (key) => /^rk_(live|test)_[a-zA-Z0-9]{24,}$/.test(key)
  },
  STRIPE_WEBHOOK_SECRET: {
    label: 'Webhook Secret',
    description: 'Used to verify webhook events',
    validate: (key) => /^whsec_[a-zA-Z0-9]{24,}$/.test(key)
  },
  MONGODB_URI: {
    label: 'Connection String',
    description: 'Your MongoDB connection string',
    validate: (uri) => /^mongodb(\+srv)?:\/\/.+/.test(uri)
  },
  SUPABASE_URL: {
    label: 'Project URL',
    description: 'Your Supabase project URL',
    validate: (url) => /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)
  },
  SUPABASE_ANON_KEY: {
    label: 'Anon Key',
    description: 'Public anonymous key for client-side',
    validate: (key) => {
      // Support both JWT and new format
      const jwtRegex = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
      const newFormatRegex = /^sb_publishable_[A-Za-z0-9_-]+$/
      return (jwtRegex.test(key) && key.length > 100) || newFormatRegex.test(key)
    }
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    label: 'Service Role Key',
    description: 'Secret key for server-side admin operations',
    validate: (key) => {
      // Support both JWT and new format
      const jwtRegex = /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/
      const newFormatRegex = /^sb_secret_[A-Za-z0-9_-]+$/
      return (jwtRegex.test(key) && key.length > 100) || newFormatRegex.test(key)
    }
  }
}

// Service descriptions for hover tooltips
const SERVICE_DESCRIPTIONS: Record<string, string> = {
  stripe: 'Payment processing platform. You\'ll need API keys to accept payments, manage subscriptions, and handle transactions.',
  mongodb: 'NoSQL database service. You\'ll need a connection string to store and retrieve your application data.',
  supabase: 'Backend platform with database, authentication, and storage. You\'ll need API keys to use these features.',
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

// Get plan badge color
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

export function ProjectCreationFlow({ isOpen, onComplete, onCancel }: ProjectCreationFlowProps) {
  const { user } = useAppStore()
  const toast = useToast()
  const [currentStep, setCurrentStep] = useState<WizardStep>('category')
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [projectName, setProjectName] = useState('')
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([])
  const [showEnvValues, setShowEnvValues] = useState<Record<string, boolean>>({})
  const [projectId, setProjectId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRequiredInfo, setShowRequiredInfo] = useState(false)
  const hasStartedRef = useRef(false)
  const pendingUpgradeCheckRef = useRef(false)

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [keyValidation, setKeyValidation] = useState<Record<string, boolean>>({})

  const categories: ProjectCategory[] = [
    {
      id: 'templates',
      name: 'Templates',
      description: 'Ready-made websites you can customize',
      icon: <Sparkles className="w-8 h-8" />,
      available: true
    },
    {
      id: 'import',
      name: 'Website Import',
      description: 'Bring your existing website into a modern design',
      icon: <Download className="w-8 h-8" />,
      available: true
    },
    {
      id: 'starter',
      name: 'Starter Kits',
      description: 'Start completely fresh with a blank canvas',
      icon: <FileCode className="w-8 h-8" />,
      available: true
    }
  ]

  const categoryDetailedDescriptions: Record<string, string> = {
    templates: 'Browse our collection of professionally designed, production-ready templates. Each template comes with modern UI, responsive design, and optional integrations for authentication, payments, and databases. Simply pick a template, customize the branding, connect your services, and deploy.',
    import: 'Have an existing website? Import your current site and we\'ll automatically analyze its structure, extract the content, and rebuild it with a modern, responsive design. Perfect for updating outdated websites or migrating to a new tech stack while preserving your existing content.',
    starter: 'For developers who want complete control. Start with a clean, minimal boilerplate and build your application from the ground up. Choose your preferred framework, add only the dependencies you need, and architect your project exactly how you want it.'
  }

  // Check if user can access selected template (recalculates when user or selectedTemplate changes)
  const canAccess = useMemo(() => {
    if (!selectedTemplate || !user) return true
    return canAccessTemplate(user.plan, selectedTemplate.requiredPlan)
  }, [selectedTemplate, user])

  // Refresh user session when modal opens
  useEffect(() => {
    const refreshUserSession = async () => {
      if (!isOpen || !user?.email || !user?.id) return

      try {
        const result = await window.electronAPI?.auth.validateUser(user.email, user.id)

        if (result?.success && result.user) {
          // Update user in store with fresh data from MongoDB
          const { setUser } = useAppStore.getState()
          setUser(result.user)
        }
      } catch (err) {
        // Silent fail - will use cached data
      }
    }

    if (isOpen) {
      refreshUserSession()
    }
  }, [isOpen])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('category')
      setSelectedCategory(null)
      setTemplates([])
      setSelectedTemplate(null)
      setProjectName('')
      setEnvVariables([])
      setShowEnvValues({})
      setProjectId(null)
      setError(null)
      setLoading(false)
      hasStartedRef.current = false
    }
  }, [isOpen])

  // Fetch templates when templates category is selected
  useEffect(() => {
    const fetchTemplates = async () => {
      if (selectedCategory?.id !== 'templates') return

      try {
        setLoading(true)
        const result = await window.electronAPI?.templates.fetch()

        if (result?.success && result.templates) {
          setTemplates(result.templates)
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

    fetchTemplates()
  }, [selectedCategory])

  // Start project creation when in creating step
  useEffect(() => {
    if (currentStep !== 'creating' || hasStartedRef.current) return

    hasStartedRef.current = true

    const createProject = async () => {
      if (!selectedTemplate) return

      try {
        // Step 1: Clone template
        const result = await window.electronAPI?.projects.create(
          selectedTemplate.id,
          projectName
        )

        if (!result?.success) {
          throw new Error(result?.error || 'Failed to create project')
        }

        setProjectId(result.project.id)

        // Step 2: Save environment variables if any
        if (envVariables.length > 0) {
          const envConfig: Record<string, string> = {}
          envVariables.forEach((v) => {
            if (v.value) {
              envConfig[v.key] = v.value
            }
          })

          await window.electronAPI?.projects.saveEnvConfig(result.project.id, envConfig)
        }

        // Step 3: Install dependencies
        setCurrentStep('installing')

        const installResult = await window.electronAPI?.projects.installDependencies(result.project.id)

        if (!installResult?.success) {
          throw new Error('Failed to install dependencies')
        }

        // Step 4: Initialize dev server
        setCurrentStep('initializing')

        const serverResult = await window.electronAPI?.process.startDevServer(result.project.id)

        if (!serverResult?.success) {
          throw new Error('Failed to start development server')
        }

        // Step 5: Complete
        setCurrentStep('complete')
      } catch (err) {
        console.error('Project creation failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setCurrentStep('error')
      }
    }

    createProject()
  }, [currentStep, selectedTemplate, projectName, envVariables])

  const handleCategorySelect = (category: ProjectCategory) => {
    if (!category.available) return
    setSelectedCategory(category)
    setCurrentStep('templates')
  }

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    setCurrentStep('details')
  }

  const handleContinueToConfig = () => {
    if (!selectedTemplate) return

    // Build env variables from template's requiredServices using SERVICE_IDENTIFIERS
    const requiredEnvVars: EnvVariable[] = []
    selectedTemplate.requiredServices.forEach((variantId) => {
      const variant = SERVICE_IDENTIFIERS[variantId]
      if (variant) {
        // Add required keys
        variant.required.forEach((keyName) => {
          const keyConfig = KEY_CONFIGS[keyName]
          requiredEnvVars.push({
            key: keyName,
            value: '',
            description: keyConfig?.description || ''
          })
        })
        // Add optional keys
        variant.optional.forEach((keyName) => {
          const keyConfig = KEY_CONFIGS[keyName]
          requiredEnvVars.push({
            key: keyName,
            value: '',
            description: keyConfig?.description || ''
          })
        })
      }
    })

    setEnvVariables(requiredEnvVars)
    setCurrentStep('configure')
  }

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name')
      return
    }
    setCurrentStep('creating')
  }

  const handleUpgrade = () => {
    if (!selectedTemplate) return

    // Open subscription page in browser
    const upgradeUrl = `https://codedeck.app/upgrade?plan=${selectedTemplate.requiredPlan}`
    window.open(upgradeUrl, '_blank')

    // Set flag to check user plan on next focus
    pendingUpgradeCheckRef.current = true
    console.log('🔄 Upgrade initiated - will check plan on next focus')

    // Don't close the modal - user will stay on the page
  }

  // Professional upgrade check: Only refresh plan when user might have upgraded
  useEffect(() => {
    const handleFocus = async () => {
      // Only check if:
      // 1. Modal is open
      // 2. User clicked upgrade (pendingUpgradeCheckRef is true)
      if (!isOpen || !pendingUpgradeCheckRef.current || !user?.email || !user?.id) return

      try {
        const result = await window.electronAPI?.auth.validateUser(user.email, user.id)

        if (result?.success && result.user) {
          // Update user in store with fresh data from MongoDB
          const { setUser } = useAppStore.getState()
          setUser(result.user)

          // Clear the flag after checking once
          pendingUpgradeCheckRef.current = false
        } else {
          // Clear flag to avoid infinite retries
          pendingUpgradeCheckRef.current = false
        }
      } catch (err) {
        // Clear flag even on error to avoid infinite retries
        pendingUpgradeCheckRef.current = false
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isOpen])

  const toggleEnvVisibility = (key: string) => {
    setShowEnvValues(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Group environment variables by provider (not by variant)
  const groupedEnvVariables = useMemo(() => {
    const grouped: Record<string, { provider: string; icon: string; vars: EnvVariable[] }> = {}

    envVariables.forEach(envVar => {
      // Find which variant this env variable belongs to
      let matchedProvider: string | null = null
      let matchedIcon: string | null = null

      for (const [variantId, variant] of Object.entries(SERVICE_IDENTIFIERS)) {
        if (variant.required.includes(envVar.key) || variant.optional.includes(envVar.key)) {
          matchedProvider = variant.provider
          matchedIcon = variant.icon
          break
        }
      }

      // Skip if we couldn't identify the provider
      if (!matchedProvider || !matchedIcon) return

      if (!grouped[matchedProvider]) {
        grouped[matchedProvider] = {
          provider: matchedProvider,
          icon: matchedIcon,
          vars: []
        }
      }
      grouped[matchedProvider].vars.push(envVar)
    })

    return grouped
  }, [envVariables])

  if (!isOpen) return null

  // Get unique categories from templates
  const templateCategories = Array.from(new Set(templates.map(t => t.category)))

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={currentStep === 'complete' || currentStep === 'error' ? onCancel : undefined}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl h-[64vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl mx-4 overflow-hidden flex flex-col"
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border/50 relative z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {currentStep === 'category' && 'Create New Project'}
              {currentStep === 'templates' && 'Choose a Template'}
              {currentStep === 'details' && selectedTemplate?.name}
              {currentStep === 'configure' && 'Configure Your Project'}
              {(currentStep === 'creating' || currentStep === 'installing' || currentStep === 'initializing') && `Creating ${projectName}`}
              {currentStep === 'complete' && 'Project Ready!'}
              {currentStep === 'error' && 'Setup Failed'}
            </h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {currentStep === 'category' && 'Choose how you want to start'}
              {currentStep === 'templates' && `${templates.length} templates available`}
              {currentStep === 'details' && 'Review template details'}
              {currentStep === 'configure' && 'Set up your project settings'}
              {(currentStep === 'creating' || currentStep === 'installing' || currentStep === 'initializing') && 'Setting up your project...'}
              {currentStep === 'complete' && 'Your project is ready to use'}
              {currentStep === 'error' && 'Something went wrong'}
            </p>
          </div>
          {(currentStep === 'complete' || currentStep === 'error' || currentStep === 'category') && (
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
            >
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative z-10 p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Category Selection */}
            {currentStep === 'category' && (
              <motion.div
                key="category"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category)}
                      onMouseEnter={() => setHoveredCategory(category.id)}
                      onMouseLeave={() => setHoveredCategory(null)}
                      className="relative p-6 rounded-xl border-2 border-dark-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all text-left"
                    >
                      <div className="mb-4 text-primary">
                        {category.icon}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        {category.name}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {category.description}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Detailed description shown on hover */}
                <div className="min-h-[80px] flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {hoveredCategory ? (
                      <motion.div
                        key={hoveredCategory}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="max-w-3xl px-6 py-4 rounded-lg bg-dark-border/20 border border-dark-border/50"
                      >
                        <p className="text-sm text-gray-300 leading-relaxed text-center">
                          {categoryDetailedDescriptions[hoveredCategory]}
                        </p>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs text-gray-500 italic"
                      >
                        Hover over a card to learn more
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Step 2: Template List */}
            {currentStep === 'templates' && (
              <motion.div
                key="templates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-gray-400">Loading templates...</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {templateCategories.map((category) => {
                      const categoryTemplates = templates.filter((t) => t.category === category)
                      return (
                        <div key={category}>
                          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            {category}
                          </h3>
                          <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dark-border/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-primary/60 [&::-webkit-scrollbar-thumb]:transition-colors">
                            <div className="flex gap-4 min-w-min">
                            {categoryTemplates.map((template) => (
                              <div
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                className="flex-shrink-0 w-72 p-4 rounded-lg border border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <h4 className="text-sm font-medium text-white group-hover:text-primary transition-colors flex-1">
                                    {template.name}
                                  </h4>
                                  {template.requiredPlan !== 'free' && (
                                    <span
                                      className={`inline-flex items-center ${getPlanBadgeColor(template.requiredPlan)} rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide flex-shrink-0 ml-2`}
                                    >
                                      {getPlanLabel(template.requiredPlan)}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                                  {template.longDescription || template.description}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {template.techStack.slice(0, 4).map((tech) => (
                                    <TechIcon key={tech} name={tech} />
                                  ))}
                                  {template.techStack.length > 4 && (
                                    <span className="text-[9px] text-gray-600">+{template.techStack.length - 4}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Template Details */}
            {currentStep === 'details' && selectedTemplate && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl mx-auto overflow-x-hidden"
              >
                <div className="space-y-5">
                  {/* Header with Plan Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-xl font-bold text-white">
                          {selectedTemplate.name}
                        </h1>
                        {selectedTemplate.demoUrl && (
                          <a
                            href={selectedTemplate.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/70 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-xs text-gray-300 hover:text-white font-medium transition-all group"
                          >
                            <Globe size={12} className="group-hover:text-primary transition-colors" />
                            View Live Demo
                            <ExternalLink size={10} className="opacity-50" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed break-words">
                        {selectedTemplate.longDescription || selectedTemplate.description}
                      </p>
                    </div>
                    {selectedTemplate.requiredPlan !== 'free' && (
                      <span
                        className={`inline-flex items-center ${getPlanBadgeColor(selectedTemplate.requiredPlan)} rounded-md px-3 py-1 text-[11px] font-semibold text-white uppercase tracking-wide flex-shrink-0`}
                      >
                        {getPlanLabel(selectedTemplate.requiredPlan)}
                      </span>
                    )}
                  </div>

                  {/* Tech Stack */}
                  <div>
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

                  {/* Required Services */}
                  {selectedTemplate.requiredServices && selectedTemplate.requiredServices.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Required for Full Functionality
                        </h3>
                        <div className="relative group">
                          <Info size={12} className="text-gray-500 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-dark-bg/95 border border-dark-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all w-56 z-10">
                            <p className="text-xs text-gray-300 leading-relaxed">
                              These services are needed for the template to work as designed. You'll configure them in the next step.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.requiredServices.map((serviceVariantId) => {
                          const variant = SERVICE_IDENTIFIERS[serviceVariantId]
                          if (!variant) return null

                          return (
                            <TechIcon key={serviceVariantId} name={variant.icon} label={variant.description} />
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Libraries as Pills */}
                  {selectedTemplate.libraries && selectedTemplate.libraries.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                        Included Libraries
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTemplate.libraries.map((lib, index) => {
                          // Smart positioning: last 2 items open to the left
                          const isNearEnd = index >= selectedTemplate.libraries!.length - 2
                          return (
                            <div key={lib.name} className="relative group">
                              <div className="inline-flex items-center px-2.5 py-1 bg-white/5 backdrop-blur-sm border border-white/10 rounded-md hover:bg-white/10 transition-all cursor-help">
                                <span className="text-[10px] text-gray-300 leading-none">
                                  {lib.name}
                                </span>
                              </div>
                              {/* Tooltip on hover - smart positioning */}
                              <div className={`absolute ${isNearEnd ? 'right-0' : 'left-0'} bottom-full mb-1.5 px-3 py-2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all w-64 z-[9999] pointer-events-none`}>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                  {lib.description}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Configuration */}
            {currentStep === 'configure' && selectedTemplate && (
              <motion.div
                key="configure"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="space-y-6">
                  {/* Project Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="My Awesome Project"
                      className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-all"
                      autoFocus
                    />
                  </div>

                  {/* Environment Variables */}
                  {envVariables.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">
                        Environment Variables
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Connect your accounts to enable features like payments and databases. You can skip this and configure later.
                      </p>
                      <div className="space-y-3">
                        {Object.entries(groupedEnvVariables).map(([providerKey, { provider, icon, vars }]) => {
                          return (
                            <div
                              key={providerKey}
                              className="border border-dark-border rounded-lg bg-dark-bg/30"
                            >
                              {/* Service Header */}
                              <div className="px-4 py-3 flex items-center gap-3 bg-dark-border/10">
                                <div className="w-5 h-5 flex items-center justify-center">
                                  <img
                                    src={`/src/assets/tech-icons/${icon}.svg`}
                                    alt={provider}
                                    className="w-4 h-4"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none'
                                    }}
                                  />
                                </div>
                                <div className="text-left">
                                  <h4 className="text-sm font-semibold text-white capitalize">
                                    {provider}
                                  </h4>
                                  <p className="text-[10px] text-gray-500">
                                    {vars.length} {vars.length === 1 ? 'key' : 'keys'}
                                  </p>
                                </div>
                              </div>

                              {/* Service Keys */}
                              <div className="px-4 pb-4 space-y-3 pt-3">
                                {vars.map((env) => {
                                  const envIndex = envVariables.findIndex(e => e.key === env.key)
                                  const keyConfig = KEY_CONFIGS[env.key]
                                  const isValid = keyValidation[env.key]
                                  const showError = env.value && isValid === false

                                  return (
                                    <div key={env.key} className="space-y-1.5">
                                      <label className="block text-xs font-medium text-gray-300">
                                        {keyConfig?.label || env.key}
                                        {env.description && (
                                          <span className="text-gray-500 text-[10px] ml-2">
                                            {env.description}
                                          </span>
                                        )}
                                      </label>
                                      <div className="relative">
                                        <input
                                          type={showEnvValues[env.key] ? 'text' : 'password'}
                                          value={env.value}
                                          onChange={(e) => {
                                            const newValue = e.target.value
                                            const newVars = [...envVariables]
                                            newVars[envIndex].value = newValue
                                            setEnvVariables(newVars)

                                            // Validate
                                            if (newValue === '') {
                                              // Empty is valid (user can skip)
                                              setKeyValidation(prev => ({ ...prev, [env.key]: true }))
                                            } else {
                                              const isValid = keyConfig?.validate(newValue) ?? true
                                              setKeyValidation(prev => ({ ...prev, [env.key]: isValid }))
                                            }
                                          }}
                                          className={`w-full bg-dark-bg/50 border rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-all ${
                                            showError
                                              ? 'border-red-500/50 focus:border-red-500'
                                              : 'border-dark-border focus:border-primary/50'
                                          }`}
                                          placeholder={`Enter ${keyConfig?.label || env.key}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => toggleEnvVisibility(env.key)}
                                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                                        >
                                          {showEnvValues[env.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </div>
                                      {showError && (
                                        <p className="text-[10px] text-red-400 flex items-center gap-1">
                                          <AlertCircle size={10} />
                                          Invalid format. Please check your key.
                                        </p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Creation Steps (Creating, Installing, Initializing) */}
            {(currentStep === 'creating' || currentStep === 'installing' || currentStep === 'initializing') && (
              <StepContent
                key={currentStep}
                icon={
                  currentStep === 'creating' ? <Code className="w-10 h-10" /> :
                  currentStep === 'installing' ? <RefreshCw className="w-10 h-10" /> :
                  <Server className="w-10 h-10" />
                }
                title={
                  currentStep === 'creating' ? 'Cloning Repository' :
                  currentStep === 'installing' ? 'Installing Dependencies' :
                  'Starting Development Server'
                }
                description={
                  currentStep === 'creating' ? 'Fetching template files from GitHub...' :
                  currentStep === 'installing' ? 'Running npm install... This may take a few minutes' :
                  'Starting Netlify Dev and Vite...'
                }
                isLoading
              />
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-12"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-6">
                  <CheckCircle className="w-12 h-12 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Your Project is Ready!
                </h3>
                <p className="text-sm text-gray-400 mb-8">
                  {projectName} has been successfully created and is running
                </p>

                <button
                  onClick={onComplete}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-lg shadow-primary/20"
                >
                  <Rocket className="w-5 h-5" />
                  Open Project
                </button>
              </motion.div>
            )}

            {/* Error Step */}
            {currentStep === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center py-12"
              >
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/10 rounded-full mb-6">
                  <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Setup Failed
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  We encountered an error while setting up your project
                </p>
                <p className="text-xs text-red-400 mb-8 font-mono bg-red-950/30 p-4 rounded-lg border border-red-900/30 max-w-lg mx-auto">
                  {error}
                </p>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={onCancel}
                    className="px-6 py-2.5 border border-dark-border text-gray-300 rounded-lg hover:bg-dark-bg/30 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setCurrentStep('category')
                      setError(null)
                      setProjectId(null)
                      hasStartedRef.current = false
                    }}
                    className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer - Navigation & Actions */}
        {currentStep !== 'complete' && currentStep !== 'error' && currentStep !== 'creating' && currentStep !== 'installing' && currentStep !== 'initializing' && (
          <div className="border-t border-dark-border/50 px-6 py-4 bg-dark-bg/20 relative z-10">
            <div className="flex items-center justify-between min-h-[44px]">
              {/* Back Button */}
              <div className="w-24">
                {currentStep === 'templates' && (
                  <button
                    onClick={() => setCurrentStep('category')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'details' && (
                  <button
                    onClick={() => setCurrentStep('templates')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'configure' && (
                  <button
                    onClick={() => setCurrentStep('details')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
              </div>

              {/* Next/Create Button */}
              <div className="min-w-[180px] flex justify-end">
                {currentStep === 'details' && (
                  <>
                    {!canAccess ? (
                      <button
                        onClick={handleUpgrade}
                        className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all text-white shadow-lg ${
                          selectedTemplate?.requiredPlan === 'premium'
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 shadow-yellow-400/20'
                            : 'bg-primary hover:bg-primary-dark shadow-primary/20'
                        }`}
                      >
                        <Crown size={13} />
                        Upgrade to {getPlanLabel(selectedTemplate?.requiredPlan || 'plus')}
                      </button>
                    ) : (
                      <button
                        onClick={handleContinueToConfig}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium shadow-lg shadow-primary/20"
                      >
                        Continue
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </>
                )}
                {currentStep === 'configure' && (
                  <div className="flex items-center gap-3">
                    {envVariables.length > 0 && (
                      <button
                        onClick={handleCreateProject}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Skip for Now
                      </button>
                    )}
                    <button
                      onClick={handleCreateProject}
                      disabled={!projectName.trim()}
                      className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all ${
                        projectName.trim()
                          ? 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles size={13} />
                      Create Project
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress Steps Indicator */}
        {currentStep !== 'complete' && currentStep !== 'error' && (
          <div className="border-t border-dark-border/50 px-8 py-4 bg-dark-bg/20 relative z-10">
            <div className="flex items-center justify-center gap-2">
              <ProgressDot active={currentStep === 'category'} completed={['templates', 'details', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['templates', 'details', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'templates'} completed={['details', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['details', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'details'} completed={['configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'configure'} completed={['creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['creating', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'creating'} completed={['installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'installing'} completed={['initializing'].includes(currentStep)} />
              <ProgressLine completed={currentStep === 'initializing'} />
              <ProgressDot active={currentStep === 'initializing'} completed={false} />
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

function StepContent({
  icon,
  title,
  description,
  isLoading
}: {
  icon: React.ReactNode
  title: string
  description: string
  isLoading?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="text-center py-12"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
        <div className={isLoading ? 'animate-pulse' : ''}>
          <div className="text-primary">{icon}</div>
        </div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-sm text-gray-400 mb-6">{description}</p>
      {isLoading && (
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </motion.div>
  )
}

function ProgressDot({ active, completed }: { active: boolean; completed: boolean }) {
  return (
    <div
      className={`w-2 h-2 rounded-full transition-colors ${
        completed
          ? 'bg-green-500'
          : active
          ? 'bg-primary ring-2 ring-primary/30'
          : 'bg-gray-600'
      }`}
    />
  )
}

function ProgressLine({ completed }: { completed: boolean }) {
  return (
    <div
      className={`h-0.5 w-8 transition-colors ${
        completed ? 'bg-green-500' : 'bg-gray-600'
      }`}
    />
  )
}
