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
  Info,
  ChevronDown,
  CreditCard,
  Star
} from 'lucide-react'
import { Template } from '../types/electron'
import TechIcon from './TechIcon'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'
import { ModalPortal } from './ModalPortal'

type WizardStep = 'category' | 'templates' | 'details' | 'configure' | 'creating' | 'installing' | 'initializing' | 'complete' | 'error' | 'import-url' | 'import-design' | 'template-or-starter'

interface ProjectCreationFlowProps {
  isOpen: boolean
  onComplete: (newProjectId?: string) => void
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
  isRequired?: boolean
}

// Re-export getEnvKeyTarget for components that need it
export { getEnvKeyTarget } from '../../shared/envKeyTargets'

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

// Forbidden categories for import flow
const FORBIDDEN_IMPORT_CATEGORIES = ['Ecommerce']

// Helper to determine if template uses Railway (dual process)
const isRailwayTemplate = (deployServices?: string[]): boolean => {
  return deployServices?.includes('railway') ?? false
}

// Generate initialization steps based on deployment service
type InitStep = { label: string; isComplete: boolean }

const getInitSteps = (
  deployServices: string[] | undefined,
  completedSteps: {
    clone?: boolean
    install?: boolean
    backendServer?: boolean
    frontendServer?: boolean
    server?: boolean
    ready?: boolean
  }
): InitStep[] => {
  const isRailway = isRailwayTemplate(deployServices)

  if (isRailway) {
    return [
      { label: 'Cloning template repository', isComplete: completedSteps.clone ?? false },
      { label: 'Installing dependencies (npm install)', isComplete: completedSteps.install ?? false },
      { label: 'Starting backend server', isComplete: completedSteps.backendServer ?? false },
      { label: 'Starting frontend server', isComplete: completedSteps.frontendServer ?? false },
      { label: 'Your project is ready', isComplete: completedSteps.ready ?? false }
    ]
  }

  // Netlify (default) - single server
  return [
    { label: 'Cloning template repository', isComplete: completedSteps.clone ?? false },
    { label: 'Installing dependencies (npm install)', isComplete: completedSteps.install ?? false },
    { label: 'Starting development server', isComplete: completedSteps.server ?? false },
    { label: 'Your project is ready', isComplete: completedSteps.ready ?? false }
  ]
}

export function ProjectCreationFlow({ isOpen, onComplete, onCancel }: ProjectCreationFlowProps) {
  const { user, currentProjectId } = useAppStore()
  const { layoutState, setPreviewHidden } = useLayoutStore()
  const toast = useToast()

  // Hide/show preview when modal opens/closes
  useEffect(() => {
    if (!currentProjectId || layoutState !== 'DEFAULT') return

    if (isOpen) {
      window.electronAPI?.preview.hide(currentProjectId)
      setPreviewHidden(true)
    } else {
      window.electronAPI?.preview.show(currentProjectId)
      setPreviewHidden(false)
    }
  }, [isOpen, currentProjectId, layoutState, setPreviewHidden])
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
  const [importUrl, setImportUrl] = useState('')
  const [importDesignOption, setImportDesignOption] = useState<'template' | 'screenshot' | 'ai' | 'clone' | null>(null)
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [isImportFlow, setIsImportFlow] = useState(false)
  const [isStarterFlow, setIsStarterFlow] = useState(false)
  const [isFetchingWebsite, setIsFetchingWebsite] = useState(false)
  const [fetchComplete, setFetchComplete] = useState(false)
  const [tempImportProjectId, setTempImportProjectId] = useState<string | null>(null)
  const [fetchProgress, setFetchProgress] = useState<{
    stage: 'fetching' | 'extracting' | 'downloading' | 'complete'
    message: string
    progress: number
  }>({ stage: 'fetching', message: 'Starting...', progress: 0 })
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  // Template filters
  const [filterType, setFilterType] = useState<'all' | 'frontend' | 'fullstack'>('all')
  const [filterDeployService, setFilterDeployService] = useState<string>('all')
  const [filterStripe, setFilterStripe] = useState<'all' | 'yes' | 'no'>('all')
  const [filterRecommended, setFilterRecommended] = useState(false)

  const categories: ProjectCategory[] = [
    {
      id: 'templates',
      name: 'Templates',
      description: 'Beautiful pre-built websites ready to customize',
      icon: <Sparkles className="w-8 h-8" />,
      available: true
    },
    {
      id: 'import',
      name: 'Scrape a Website',
      description: 'Copy content and design from any website',
      icon: <Download className="w-8 h-8" />,
      available: true
    },
    {
      id: 'starter',
      name: 'Starter Kits',
      description: 'Clean slate to build from scratch',
      icon: <FileCode className="w-8 h-8" />,
      available: true
    }
  ]

  const categoryDetailedDescriptions: Record<string, string> = {
    templates: 'Pick from our collection of beautiful, ready-to-use templates. Each one comes with modern design, works on all devices, and can connect to services like payments and databases. Just choose one, make it yours, and launch!',
    import: 'Found a website you love? We\'ll grab its content, images, and structure for you. Then you can either copy its exact look, use a different design style, or let AI create something fresh. Great for recreating sites or getting inspired.',
    starter: 'Want total freedom? Start with just the basics - a clean setup with your favorite framework. No extra stuff, no pre-made designs. Build exactly what you have in mind, your way.'
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
      setIsImportFlow(false)
      setIsStarterFlow(false)
      setImportUrl('')
      setImportDesignOption(null)
      setScreenshotFile(null)
      setIsFetchingWebsite(false)
      setFetchComplete(false)
      setFetchProgress({ stage: 'fetching', message: 'Starting...', progress: 0 })
      setShowSkipWarning(false)
      hasStartedRef.current = false
    }
  }, [isOpen])

  // Fetch templates when templates step is shown
  useEffect(() => {
    const fetchTemplates = async () => {
      if (currentStep !== 'templates') return

      try {
        setLoading(true)
        const result = await window.electronAPI?.templates.fetch()

        if (result?.success && result.templates) {
          // Filter templates based on flow type
          let filteredTemplates = result.templates

          if (isStarterFlow) {
            // Starter flow: show only starter=true templates (new card UI)
            filteredTemplates = result.templates.filter(t => t.starter === true)
          } else {
            // Regular templates or Import flow with Templates: show full templates (NOT starter)
            filteredTemplates = result.templates.filter(t => !t.starter)
          }

          setTemplates(filteredTemplates)
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
  }, [currentStep, isImportFlow, isStarterFlow])

  // Cleanup handler - cleans up temp data and closes wizard
  const handleCancel = async () => {
    if (tempImportProjectId) {
      await window.electronAPI?.websiteImport.cleanup(tempImportProjectId)
    }
    onCancel()
  }

  // Start project creation when in creating step
  useEffect(() => {
    if (currentStep !== 'creating' || hasStartedRef.current) return

    hasStartedRef.current = true

    const createProject = async () => {
      if (!selectedTemplate) return

      let createdProjectId: string | null = null

      try {
        // Convert screenshot to base64 if present
        let screenshotData: string | undefined
        if (screenshotFile && (importDesignOption === 'screenshot')) {
          const reader = new FileReader()
          screenshotData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(screenshotFile)
          })
        }

        // Step 1: Clone template
        const result = await window.electronAPI?.projects.create(
          selectedTemplate.id,
          projectName,
          tempImportProjectId || undefined, // Pass temp project ID if this is an import flow
          screenshotData, // Pass screenshot if present
          importDesignOption || undefined // Pass import type (template/screenshot/ai)
        )

        if (!result?.success) {
          throw new Error(result?.error || 'Failed to create project')
        }

        createdProjectId = result.project.id
        setProjectId(createdProjectId)

        // Create initialization block to show in StatusSheet
        const deployServices = selectedTemplate.deployServices
        await window.electronAPI?.chat.createInitializationBlock(
          createdProjectId,
          selectedTemplate.name,
          getInitSteps(deployServices, { clone: true })
        )

        // Step 2: Save environment variables
        const envConfig: Record<string, string> = {}

        // Add user-entered environment variables (if any)
        envVariables.forEach((v) => {
          if (v.value) {
            envConfig[v.key] = v.value
          }
        })

        // Always inject these required environment variables
        envConfig['VITE_GA_ID'] = 'G-8NGLL2W3H5'
        envConfig['VITE_PROJECT_ID'] = result.project.id

        await window.electronAPI?.projects.saveEnvConfig(result.project.id, envConfig)

        // Step 3: Install dependencies
        setCurrentStep('installing')

        // Update initialization block - installing stage
        await window.electronAPI?.chat.updateInitializationBlock(
          createdProjectId,
          getInitSteps(deployServices, { clone: true, install: true }),
          false
        )

        const installResult = await window.electronAPI?.projects.installDependencies(result.project.id)

        if (!installResult?.success) {
          throw new Error('Failed to install dependencies')
        }

        // Step 4: Initialize dev server
        setCurrentStep('initializing')

        // Update initialization block - starting server stage
        // For Railway: show backend starting first, then frontend
        const isRailway = isRailwayTemplate(deployServices)

        if (isRailway) {
          // Show backend starting
          await window.electronAPI?.chat.updateInitializationBlock(
            createdProjectId,
            getInitSteps(deployServices, { clone: true, install: true, backendServer: true }),
            false
          )
        }

        const serverResult = await window.electronAPI?.process.startDevServer(result.project.id)

        if (!serverResult?.success) {
          throw new Error('Failed to start development server')
        }

        // Update to show all servers started
        await window.electronAPI?.chat.updateInitializationBlock(
          createdProjectId,
          getInitSteps(deployServices, {
            clone: true,
            install: true,
            backendServer: true,
            frontendServer: true,
            server: true
          }),
          false
        )

        // Step 5: Clean up temp folder if this was a website import
        if (tempImportProjectId) {
          await window.electronAPI?.websiteImport.cleanup(tempImportProjectId)
          setTempImportProjectId(null)
        }

        // Step 6: Make initial commit (so users can restore to this state)
        let initialCommitHash: string | undefined
        try {
          const commitResult = await window.electronAPI?.git.initialCommit(
            createdProjectId,
            'Initial project setup'
          )
          if (commitResult?.success && commitResult.commitHash) {
            initialCommitHash = commitResult.commitHash
          }
        } catch (commitErr) {
          console.warn('Failed to create initial commit:', commitErr)
          // Don't fail project creation if commit fails
        }

        // Step 7: Complete - mark initialization as complete (with commit hash for restore)
        await window.electronAPI?.chat.updateInitializationBlock(
          createdProjectId,
          getInitSteps(deployServices, {
            clone: true,
            install: true,
            backendServer: true,
            frontendServer: true,
            server: true,
            ready: true
          }),
          true, // Mark as complete
          initialCommitHash // Pass commit hash for restore functionality
        )

        setCurrentStep('complete')
      } catch (err) {
        console.error('Project creation failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setCurrentStep('error')

        // If we have a project ID, mark initialization as failed
        if (createdProjectId) {
          await window.electronAPI?.chat.updateInitializationBlock(
            createdProjectId,
            [],
            true // Mark as complete (failed)
          )
        }
      }
    }

    createProject()
  }, [currentStep, selectedTemplate, projectName, envVariables, tempImportProjectId, screenshotFile, importDesignOption])

  const handleCategorySelect = (category: ProjectCategory) => {
    if (!category.available) return
    setSelectedCategory(category)

    if (category.id === 'import') {
      setIsImportFlow(true)
      setIsStarterFlow(false)
      setCurrentStep('import-url')
    } else if (category.id === 'starter') {
      setIsImportFlow(false)
      setIsStarterFlow(true)
      setCurrentStep('templates')
    } else {
      setIsImportFlow(false)
      setIsStarterFlow(false)
      setCurrentStep('templates')
    }
  }

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    // In import flow, go directly to configure (skip details)
    if (isImportFlow) {
      // Build env variables from template's requiredServices
      const requiredEnvVars: EnvVariable[] = []
      template.requiredServices.forEach((variantId) => {
        const variant = SERVICE_IDENTIFIERS[variantId]
        if (variant) {
          variant.required.forEach((keyName) => {
            const keyConfig = KEY_CONFIGS[keyName]
            requiredEnvVars.push({
              key: keyName,
              value: '',
              description: keyConfig?.description || '',
              isRequired: true
            })
          })
          variant.optional.forEach((keyName) => {
            const keyConfig = KEY_CONFIGS[keyName]
            requiredEnvVars.push({
              key: keyName,
              value: '',
              description: keyConfig?.description || '',
              isRequired: false
            })
          })
        }
      })
      setEnvVariables(requiredEnvVars)
      setCurrentStep('configure')
    } else {
      setCurrentStep('details')
    }
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
            description: keyConfig?.description || '',
            isRequired: true
          })
        })
        // Add optional keys
        variant.optional.forEach((keyName) => {
          const keyConfig = KEY_CONFIGS[keyName]
          requiredEnvVars.push({
            key: keyName,
            value: '',
            description: keyConfig?.description || '',
            isRequired: false
          })
        })
      }
    })

    setEnvVariables(requiredEnvVars)
    setCurrentStep('configure')
  }

  const handleCreateProject = (skipValidation = false) => {
    if (!projectName.trim()) {
      toast.error('Please enter a project name')
      return
    }

    // If not skipping validation, check credentials
    if (!skipValidation && envVariables.length > 0) {
      // Check if any required field is empty
      const missingRequired = envVariables.filter((env) => env.isRequired && !env.value.trim())
      if (missingRequired.length > 0) {
        toast.error(`Please fill in all required credentials or click "Skip for Now"`)
        return
      }

      // Check if any field has a value that is invalid
      const hasInvalidCredentials = envVariables.some((env) => {
        const isValid = keyValidation[env.key]
        return env.value && isValid === false
      })

      if (hasInvalidCredentials) {
        toast.error('Please fix invalid credentials before creating the project')
        return
      }
    }

    setCurrentStep('creating')
  }

  const handleSkipForNow = () => {
    setShowSkipWarning(true)
  }

  const handleConfirmSkip = () => {
    setShowSkipWarning(false)
    handleCreateProject(true) // Skip validation
  }

  const normalizeUrl = (url: string): string => {
    let normalized = url.trim()
    // Add https:// if no protocol
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = 'https://' + normalized
    }
    return normalized
  }

  const isValidWebsiteUrl = (url: string): boolean => {
    if (!url.trim()) return false

    const normalized = normalizeUrl(url)

    try {
      const urlObj = new URL(normalized)

      // Must have a valid hostname
      if (!urlObj.hostname) return false

      // Must have at least one dot (e.g., example.com)
      if (!urlObj.hostname.includes('.')) return false

      // Hostname must be at least 4 characters (e.g., a.co)
      if (urlObj.hostname.length < 4) return false

      // Must not be just a TLD (e.g., not just ".com")
      const parts = urlObj.hostname.split('.')
      if (parts.length < 2) return false
      if (parts.some(part => part.length === 0)) return false

      // The last part (TLD) should be at least 2 characters
      const tld = parts[parts.length - 1]
      if (tld.length < 2) return false

      return true
    } catch {
      return false
    }
  }

  const handleStartFetch = async () => {
    if (!isValidWebsiteUrl(importUrl)) {
      toast.error('Please enter a valid website URL')
      return
    }

    // Normalize URL
    const normalizedUrl = normalizeUrl(importUrl)
    setImportUrl(normalizedUrl) // Update with normalized URL

    setIsFetchingWebsite(true)
    setFetchComplete(false)

    try {
      // Stage 1: Fetching website (0-30%)
      setFetchProgress({ stage: 'fetching', message: 'Launching browser...', progress: 5 })
      await new Promise(resolve => setTimeout(resolve, 500))

      setFetchProgress({ stage: 'fetching', message: 'Connecting to website...', progress: 10 })

      // Call Puppeteer backend
      const analysisPromise = window.electronAPI.websiteImport.analyze(normalizedUrl)

      // Show progress while Puppeteer works
      setFetchProgress({ stage: 'fetching', message: 'Loading page content...', progress: 20 })
      await new Promise(resolve => setTimeout(resolve, 2000))

      setFetchProgress({ stage: 'fetching', message: 'Analyzing structure...', progress: 30 })
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Stage 2: Extracting content (30-60%)
      setFetchProgress({ stage: 'extracting', message: 'Extracting text content...', progress: 40 })
      await new Promise(resolve => setTimeout(resolve, 1500))

      setFetchProgress({ stage: 'extracting', message: 'Identifying sections...', progress: 50 })
      await new Promise(resolve => setTimeout(resolve, 1500))

      setFetchProgress({ stage: 'extracting', message: 'Processing navigation...', progress: 60 })
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Stage 3: Downloading images (60-95%)
      setFetchProgress({ stage: 'downloading', message: 'Finding images...', progress: 65 })
      await new Promise(resolve => setTimeout(resolve, 1000))

      setFetchProgress({ stage: 'downloading', message: 'Downloading images...', progress: 75 })
      await new Promise(resolve => setTimeout(resolve, 2000))

      setFetchProgress({ stage: 'downloading', message: 'Processing images...', progress: 85 })
      await new Promise(resolve => setTimeout(resolve, 1500))

      setFetchProgress({ stage: 'downloading', message: 'Creating manifest...', progress: 95 })

      // Wait for analysis to complete
      const result = await analysisPromise

      if (result.success && result.tempProjectId) {
        // Store temp project ID for later use
        setTempImportProjectId(result.tempProjectId)

        // Stage 4: Complete (100%)
        setFetchProgress({ stage: 'complete', message: 'Website analysis complete!', progress: 100 })
        setFetchComplete(true)

        toast.success(`Analyzed ${result.stats?.sections || 0} sections, ${result.stats?.images || 0} images!`)
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
    } catch (error) {
      console.error('❌ [WEBSITE IMPORT] Error:', error)
      toast.error('Failed to analyze website. Please try again.')
      setFetchComplete(false)
    } finally {
      setIsFetchingWebsite(false)
    }
  }

  const handleContinueToDesignSelection = () => {
    if (!fetchComplete) {
      toast.error('Please wait for website analysis to complete')
      return
    }
    setCurrentStep('import-design')
  }

  const handleUpgrade = async () => {
    if (!selectedTemplate) return

    // Open subscription page in system browser
    await window.electronAPI?.shell?.openExternal('https://www.codedeckai.com/#pricing')

    // Set flag to check user plan on next focus
    pendingUpgradeCheckRef.current = true

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

  // Get unique deploy services from all templates for filter dropdown
  const allDeployServices = Array.from(
    new Set(templates.flatMap(t => t.deployServices || []))
  ).sort()

  // Stripe-related service identifiers
  const STRIPE_SERVICES = ['stripe_secure', 'stripe_webhooks', 'stripe_simple']

  // Apply filters to templates
  const filteredTemplates = templates.filter(template => {
    // Type filter
    if (filterType !== 'all' && template.type !== filterType) return false

    // Deploy service filter
    if (filterDeployService !== 'all') {
      if (!template.deployServices?.includes(filterDeployService)) return false
    }

    // Stripe filter
    if (filterStripe !== 'all') {
      const hasStripe = template.requiredServices?.some(s => STRIPE_SERVICES.includes(s)) || false
      if (filterStripe === 'yes' && !hasStripe) return false
      if (filterStripe === 'no' && hasStripe) return false
    }

    // Recommended filter
    if (filterRecommended && !template.recommended) return false

    return true
  })

  // Get unique categories from filtered templates
  const templateCategories = Array.from(new Set(filteredTemplates.map(t => t.category)))

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={currentStep === 'complete' || currentStep === 'error' ? onCancel : handleCancel}
        />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`relative w-full bg-dark-card border border-dark-border rounded-lg shadow-2xl mx-4 overflow-hidden flex flex-col ${
          currentStep === 'category'
            ? 'max-w-4xl h-[64vh]'
            : 'max-w-6xl h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--tg-heading-font-family)' }}>
                {currentStep === 'category' && 'Create New Project'}
                {currentStep === 'template-or-starter' && 'Pick Your Base'}
                {currentStep === 'templates' && (isStarterFlow ? 'Starter Kits' : 'Choose a Template')}
                {currentStep === 'details' && (isImportFlow && importDesignOption === 'screenshot' ? 'Upload Design' : selectedTemplate?.name)}
                {currentStep === 'configure' && 'Almost There!'}
                {currentStep === 'import-url' && 'Scrape a Website'}
                {currentStep === 'import-design' && 'What Next?'}
                {(currentStep === 'creating' || currentStep === 'installing' || currentStep === 'initializing') && `Creating ${projectName}`}
                {currentStep === 'complete' && 'You\'re All Set!'}
                {currentStep === 'error' && 'Oops!'}
              </h2>
              <p className="text-sm text-white/60 mt-1" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
                {currentStep === 'category' && 'How do you want to start?'}
                {currentStep === 'template-or-starter' && 'Template or blank canvas?'}
                {currentStep === 'templates' && (isStarterFlow ? `${filteredTemplates.length} starter kits to choose from` : `${filteredTemplates.length} templates to choose from`)}
                {currentStep === 'details' && (isImportFlow && importDesignOption === 'screenshot' ? 'Show us a design you like' : 'Check out the details')}
                {currentStep === 'configure' && 'Name your project and add any API keys'}
                {currentStep === 'import-url' && 'Paste a URL and we\'ll grab everything'}
                {currentStep === 'import-design' && 'Choose what to do with the scraped content'}
                {(currentStep === 'creating' || currentStep === 'installing' || currentStep === 'initializing') && 'Hang tight, we\'re setting things up...'}
                {currentStep === 'complete' && 'Your project is ready to rock!'}
                {currentStep === 'error' && 'Something went wrong'}
              </p>
            </div>
            {(currentStep === 'complete' || currentStep === 'error' || currentStep === 'category') && (
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} className="text-white/70" />
              </button>
            )}
          </div>

          {/* Filters - Show in templates step for both templates and starters */}
          {currentStep === 'templates' && (
            <div className="flex items-center gap-3 mt-4">
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'frontend' | 'fullstack')}
                  className="appearance-none bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer hover:border-white/30 transition-colors"
                >
                  <option value="all">All Types</option>
                  <option value="frontend">Frontend</option>
                  <option value="fullstack">Fullstack</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
              </div>

              {/* Deploy Service Filter */}
              <div className="relative">
                <select
                  value={filterDeployService}
                  onChange={(e) => setFilterDeployService(e.target.value)}
                  className="appearance-none bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer hover:border-white/30 transition-colors"
                >
                  <option value="all">All Deploys</option>
                  {allDeployServices.map((service) => (
                    <option key={service} value={service}>
                      {service.charAt(0).toUpperCase() + service.slice(1)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
              </div>

              {/* Stripe Payment Filter - Only for templates, not starters */}
              {!isStarterFlow && (
                <div className="relative">
                  <select
                    value={filterStripe}
                    onChange={(e) => setFilterStripe(e.target.value as 'all' | 'yes' | 'no')}
                    className="appearance-none bg-dark-bg border border-dark-border rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none focus:border-primary/50 cursor-pointer hover:border-white/30 transition-colors"
                  >
                    <option value="all">Stripe: Any</option>
                    <option value="yes">With Stripe</option>
                    <option value="no">Without Stripe</option>
                  </select>
                  <CreditCard size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>
              )}

              {/* Divider */}
              <div className="w-px h-6 bg-dark-border" />

              {/* Recommended Filter - Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={filterRecommended}
                    onChange={(e) => setFilterRecommended(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                    filterRecommended
                      ? 'bg-amber-500 border-amber-500'
                      : 'bg-dark-bg border-dark-border group-hover:border-white/30'
                  }`}>
                    {filterRecommended && (
                      <Star size={10} className="text-white fill-white" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-white/80 group-hover:text-white transition-colors flex items-center gap-1.5">
                  <Star size={12} className="text-amber-500" />
                  Recommended
                </span>
              </label>

              {/* Active Filters Count & Clear */}
              {(filterType !== 'all' || filterDeployService !== 'all' || (!isStarterFlow && filterStripe !== 'all') || filterRecommended) && (
                <button
                  onClick={() => {
                    setFilterType('all')
                    setFilterDeployService('all')
                    setFilterStripe('all')
                    setFilterRecommended(false)
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <X size={12} />
                  Clear filters
                </button>
              )}
            </div>
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

            {/* Import Step 1: URL Input */}
            {currentStep === 'import-url' && (
              <motion.div
                key="import-url"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-3">
                    <Globe className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">
                    Scrape a Website
                  </h3>
                  <p className="text-xs text-gray-400">
                    Enter any website URL and we'll grab its content, images, and structure
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={importUrl}
                        onChange={(e) => {
                          setImportUrl(e.target.value)
                          setFetchComplete(false)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && isValidWebsiteUrl(importUrl) && !isFetchingWebsite) {
                            handleStartFetch()
                          }
                        }}
                        placeholder="https://example.com"
                        className="flex-1 bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        autoFocus
                        disabled={isFetchingWebsite}
                      />
                      <button
                        onClick={handleStartFetch}
                        disabled={!isValidWebsiteUrl(importUrl) || isFetchingWebsite || fetchComplete}
                        className={`px-4 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 flex-shrink-0 ${
                          fetchComplete
                            ? 'bg-primary text-white cursor-not-allowed'
                            : isFetchingWebsite
                            ? 'bg-primary/20 text-primary cursor-not-allowed'
                            : isValidWebsiteUrl(importUrl)
                            ? 'bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary'
                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {fetchComplete ? (
                          <>
                            <CheckCircle size={16} />
                            Done
                          </>
                        ) : isFetchingWebsite ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            Scraping
                          </>
                        ) : (
                          <>
                            <Download size={16} />
                            Scrape
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Progress Animation */}
                  <AnimatePresence mode="wait">
                    {isFetchingWebsite && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-dark-border/20 border border-dark-border/50 rounded-lg p-4">
                          <div className="space-y-3">
                            {/* Progress Bar */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-white">{fetchProgress.message}</span>
                                <span className="text-xs text-gray-400">{fetchProgress.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-dark-bg/50 rounded-full overflow-hidden">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-primary to-primary/60"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${fetchProgress.progress}%` }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </div>
                            </div>

                            {/* Stage Indicators */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              <div className={`flex items-center gap-1.5 text-[10px] transition-all ${
                                ['fetching', 'extracting', 'downloading', 'complete'].includes(fetchProgress.stage)
                                  ? 'text-primary'
                                  : 'text-gray-500'
                              }`}>
                                {['extracting', 'downloading', 'complete'].includes(fetchProgress.stage) ? (
                                  <CheckCircle size={12} className="text-primary" />
                                ) : fetchProgress.stage === 'fetching' ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border-2 border-gray-600" />
                                )}
                                <span>Fetching</span>
                              </div>
                              <div className={`flex items-center gap-1.5 text-[10px] transition-all ${
                                ['extracting', 'downloading', 'complete'].includes(fetchProgress.stage)
                                  ? 'text-primary'
                                  : 'text-gray-500'
                              }`}>
                                {['downloading', 'complete'].includes(fetchProgress.stage) ? (
                                  <CheckCircle size={12} className="text-primary" />
                                ) : fetchProgress.stage === 'extracting' ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border-2 border-gray-600" />
                                )}
                                <span>Extracting</span>
                              </div>
                              <div className={`flex items-center gap-1.5 text-[10px] transition-all ${
                                ['downloading', 'complete'].includes(fetchProgress.stage)
                                  ? 'text-primary'
                                  : 'text-gray-500'
                              }`}>
                                {fetchProgress.stage === 'complete' ? (
                                  <CheckCircle size={12} className="text-primary" />
                                ) : fetchProgress.stage === 'downloading' ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border-2 border-gray-600" />
                                )}
                                <span>Images</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {fetchComplete && !isFetchingWebsite && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-primary/10 border border-primary/30 rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle size={16} className="text-primary flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-primary">Scraping Complete!</p>
                            <p className="text-[10px] text-primary/70 mt-0.5">Got the content, images, and structure. Let's continue!</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isFetchingWebsite && !fetchComplete && (
                    <div className="bg-dark-border/20 border border-dark-border/50 rounded-lg p-3">
                      <div className="flex items-start gap-2.5">
                        <Info size={14} className="text-primary flex-shrink-0 mt-0.5" />
                        <div className="text-[11px] text-gray-400 leading-relaxed">
                          <p className="mb-1.5">We'll grab everything from the website:</p>
                          <ul className="space-y-0.5 ml-3 list-disc">
                            <li>All the text and how it's organized</li>
                            <li>Images and other media</li>
                            <li>Menu links and page sections</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Import Step 2: Design Selection */}
            {currentStep === 'import-design' && (
              <motion.div
                key="import-design"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl mx-auto"
              >
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-white mb-1">
                    What do you want to do with it?
                  </h3>
                  <p className="text-xs text-gray-400">
                    Choose how to use the scraped content
                  </p>
                </div>

                <div className="space-y-2.5">
                  {/* Option 1: Clone Website */}
                  <button
                    onClick={() => {
                      setImportDesignOption('clone')
                      setCurrentStep('template-or-starter')
                    }}
                    className={`w-full p-3.5 rounded-lg border-2 transition-all text-left group ${
                      importDesignOption === 'clone'
                        ? 'border-primary bg-primary/5'
                        : 'border-dark-border hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        importDesignOption === 'clone' ? 'bg-primary/20' : 'bg-dark-border/30 group-hover:bg-primary/10'
                      }`}>
                        <Code className={`w-5 h-5 ${importDesignOption === 'clone' ? 'text-primary' : 'text-gray-400 group-hover:text-primary'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white mb-0.5">
                          Clone the Design
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Copy the exact look - same colors, layout, style, everything. Like a pixel-perfect replica.
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                        importDesignOption === 'clone'
                          ? 'border-primary bg-primary'
                          : 'border-gray-600'
                      }`}>
                        {importDesignOption === 'clone' && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Upload Screenshot */}
                  <button
                    onClick={() => {
                      setImportDesignOption('screenshot')
                      setCurrentStep('details')
                    }}
                    className={`w-full p-3.5 rounded-lg border-2 transition-all text-left group ${
                      importDesignOption === 'screenshot'
                        ? 'border-primary bg-primary/5'
                        : 'border-dark-border hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        importDesignOption === 'screenshot' ? 'bg-primary/20' : 'bg-dark-border/30 group-hover:bg-primary/10'
                      }`}>
                        <Palette className={`w-5 h-5 ${importDesignOption === 'screenshot' ? 'text-primary' : 'text-gray-400 group-hover:text-primary'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white mb-0.5">
                          Use a Different Design
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Upload a screenshot of a design you like, and we'll style your content to match it.
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                        importDesignOption === 'screenshot'
                          ? 'border-primary bg-primary'
                          : 'border-gray-600'
                      }`}>
                        {importDesignOption === 'screenshot' && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Option 3: AI Redesign */}
                  <button
                    onClick={() => {
                      setImportDesignOption('ai')
                      setCurrentStep('template-or-starter')
                    }}
                    className={`w-full p-3.5 rounded-lg border-2 transition-all text-left group ${
                      importDesignOption === 'ai'
                        ? 'border-primary bg-primary/5'
                        : 'border-dark-border hover:border-primary/50 hover:bg-primary/5'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        importDesignOption === 'ai' ? 'bg-primary/20' : 'bg-dark-border/30 group-hover:bg-primary/10'
                      }`}>
                        <Sparkles className={`w-5 h-5 ${importDesignOption === 'ai' ? 'text-primary' : 'text-gray-400 group-hover:text-primary'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-white mb-0.5">
                          Let AI Design Something New
                        </h4>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          AI will take your content and create a fresh, modern design from scratch.
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                        importDesignOption === 'ai'
                          ? 'border-primary bg-primary'
                          : 'border-gray-600'
                      }`}>
                        {importDesignOption === 'ai' && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Template or Starter Selection (Import Flow) */}
            {currentStep === 'template-or-starter' && (
              <motion.div
                key="template-or-starter"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-2xl mx-auto"
              >
                <div className="text-center mb-6">
                  <h3 className="text-base font-semibold text-white mb-2">
                    Pick Your Base
                  </h3>
                  <p className="text-xs text-gray-400">
                    Start with a beautiful template or a clean slate
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Templates Option */}
                  <button
                    onClick={() => {
                      setIsStarterFlow(false)
                      setCurrentStep('templates')
                    }}
                    className="p-5 rounded-xl border-2 border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        Templates
                      </h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                      Beautiful pre-made designs with pages and components. Just add your content!
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <CheckCircle size={12} className="text-primary" />
                      <span>Ready to customize</span>
                    </div>
                  </button>

                  {/* Starter Kits Option */}
                  <button
                    onClick={() => {
                      setIsStarterFlow(true)
                      setCurrentStep('templates')
                    }}
                    className="p-5 rounded-xl border-2 border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                        <FileCode className="w-5 h-5 text-blue-400" />
                      </div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors">
                        Starter Kits
                      </h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-3">
                      Just the basics - pick your framework and build everything yourself.
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <CheckCircle size={12} className="text-blue-400" />
                      <span>Blank canvas</span>
                    </div>
                  </button>
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
                      <p className="text-xs text-gray-400">{isStarterFlow ? 'Loading starter kits...' : 'Loading templates...'}</p>
                    </div>
                  </div>
                ) : isStarterFlow ? (
                  /* Starter Kits UI - Professional Design */
                  <div className="space-y-6">
                    {/* Frontend Starters */}
                    {filteredTemplates.filter(t => t.type === 'frontend').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-1.5 bg-blue-500/10 rounded-lg">
                            <Code className="w-4 h-4 text-blue-400" />
                          </div>
                          <h3 className="text-sm font-semibold text-white">Frontend</h3>
                          <span className="text-xs text-gray-500">Client-side only</span>
                        </div>
                        <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dark-border/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-primary/60">
                          <div className="flex gap-4" style={{ width: 'max-content' }}>
                            {filteredTemplates.filter(t => t.type === 'frontend').map((template) => (
                              <div
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                className="w-[calc((100vw-theme(spacing.16)-theme(spacing.8)*2-theme(spacing.4)*2)/3)] max-w-[320px] min-w-[280px] flex-shrink-0 rounded-xl border border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer overflow-hidden"
                              >
                                {/* Screenshot Thumbnail */}
                                {template.screenshot ? (
                                  <div className="w-full h-40 bg-dark-bg/50 overflow-hidden relative">
                                    <img
                                      src={template.screenshot}
                                      alt={template.name}
                                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                    {/* Type Badge Overlay */}
                                    <span className="absolute top-2 right-2 inline-flex items-center bg-blue-500/90 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide shadow-lg">
                                      Frontend
                                    </span>
                                    {/* Recommended Star */}
                                    {template.recommended && (
                                      <div className="absolute top-2 left-2 group/star">
                                        <div className="p-1.5 bg-amber-500/90 rounded-lg shadow-lg">
                                          <Star size={12} className="text-white fill-white" />
                                        </div>
                                        <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none z-10">
                                          <div className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap">
                                            <span className="text-[10px] text-white">Recommended by CodeDeck</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-full h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center relative">
                                    <div className="flex gap-3">
                                      {template.techStack.slice(0, 3).map((tech) => (
                                        <TechIcon key={tech} name={tech} />
                                      ))}
                                    </div>
                                    <span className="absolute top-2 right-2 inline-flex items-center bg-blue-500/90 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide shadow-lg">
                                      Frontend
                                    </span>
                                    {/* Recommended Star */}
                                    {template.recommended && (
                                      <div className="absolute top-2 left-2 group/star">
                                        <div className="p-1.5 bg-amber-500/90 rounded-lg shadow-lg">
                                          <Star size={12} className="text-white fill-white" />
                                        </div>
                                        <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none z-10">
                                          <div className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap">
                                            <span className="text-[10px] text-white">Recommended by CodeDeck</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="p-4">
                                  <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors mb-1.5">
                                    {template.name}
                                  </h4>
                                  <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                                    {template.description}
                                  </p>

                                  {/* Tech Stack & Deploy */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      {template.techStack.slice(0, 3).map((tech) => (
                                        <TechIcon key={tech} name={tech} />
                                      ))}
                                      {template.techStack.length > 3 && (
                                        <span className="text-[10px] text-gray-500">+{template.techStack.length - 3}</span>
                                      )}
                                    </div>

                                    {/* Deploy Services */}
                                    {template.deployServices && template.deployServices.length > 0 && (
                                      <div className="flex items-center gap-1 bg-dark-bg/50 rounded-md px-2 py-1">
                                        {template.deployServices.map((service) => (
                                          <TechIcon key={service} name={service} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fullstack Starters */}
                    {filteredTemplates.filter(t => t.type === 'fullstack').length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-1.5 bg-green-500/10 rounded-lg">
                            <Server className="w-4 h-4 text-green-400" />
                          </div>
                          <h3 className="text-sm font-semibold text-white">Fullstack</h3>
                          <span className="text-xs text-gray-500">Frontend + Backend</span>
                        </div>
                        <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dark-border/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-primary/60">
                          <div className="flex gap-4" style={{ width: 'max-content' }}>
                            {filteredTemplates.filter(t => t.type === 'fullstack').map((template) => (
                              <div
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                className="w-[calc((100vw-theme(spacing.16)-theme(spacing.8)*2-theme(spacing.4)*2)/3)] max-w-[320px] min-w-[280px] flex-shrink-0 rounded-xl border border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer overflow-hidden"
                              >
                                {/* Screenshot Thumbnail */}
                                {template.screenshot ? (
                                  <div className="w-full h-40 bg-dark-bg/50 overflow-hidden relative">
                                    <img
                                      src={template.screenshot}
                                      alt={template.name}
                                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                      }}
                                    />
                                    {/* Type Badge Overlay */}
                                    <span className="absolute top-2 right-2 inline-flex items-center bg-green-500/90 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide shadow-lg">
                                      Fullstack
                                    </span>
                                    {/* Recommended Star */}
                                    {template.recommended && (
                                      <div className="absolute top-2 left-2 group/star">
                                        <div className="p-1.5 bg-amber-500/90 rounded-lg shadow-lg">
                                          <Star size={12} className="text-white fill-white" />
                                        </div>
                                        <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none z-10">
                                          <div className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap">
                                            <span className="text-[10px] text-white">Recommended by CodeDeck</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-full h-40 bg-gradient-to-br from-green-500/10 to-emerald-500/10 flex items-center justify-center relative">
                                    <div className="flex gap-3">
                                      {template.techStack.slice(0, 3).map((tech) => (
                                        <TechIcon key={tech} name={tech} />
                                      ))}
                                    </div>
                                    <span className="absolute top-2 right-2 inline-flex items-center bg-green-500/90 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide shadow-lg">
                                      Fullstack
                                    </span>
                                    {/* Recommended Star */}
                                    {template.recommended && (
                                      <div className="absolute top-2 left-2 group/star">
                                        <div className="p-1.5 bg-amber-500/90 rounded-lg shadow-lg">
                                          <Star size={12} className="text-white fill-white" />
                                        </div>
                                        <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none z-10">
                                          <div className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap">
                                            <span className="text-[10px] text-white">Recommended by CodeDeck</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="p-4">
                                  <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors mb-1.5">
                                    {template.name}
                                  </h4>
                                  <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                                    {template.description}
                                  </p>

                                  {/* Tech Stack & Deploy */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      {template.techStack.slice(0, 3).map((tech) => (
                                        <TechIcon key={tech} name={tech} />
                                      ))}
                                      {template.techStack.length > 3 && (
                                        <span className="text-[10px] text-gray-500">+{template.techStack.length - 3}</span>
                                      )}
                                    </div>

                                    {/* Deploy Services */}
                                    {template.deployServices && template.deployServices.length > 0 && (
                                      <div className="flex items-center gap-1 bg-dark-bg/50 rounded-md px-2 py-1">
                                        {template.deployServices.map((service) => (
                                          <TechIcon key={service} name={service} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* No results message */}
                    {filteredTemplates.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="p-4 bg-dark-bg/50 rounded-full mb-4">
                          <FileCode className="w-8 h-8 text-gray-500" />
                        </div>
                        <h4 className="text-sm font-medium text-white mb-1">No starter kits found</h4>
                        <p className="text-xs text-gray-500">Try adjusting your filters</p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Regular Templates UI */
                  <div className="space-y-6">
                    {templateCategories.map((category) => {
                      const categoryTemplates = filteredTemplates.filter((t) => t.category === category)
                      return (
                        <div key={category}>
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
                            {category}
                          </h3>
                          <div className="overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dark-border/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-primary/60">
                            <div className="flex gap-4" style={{ width: 'max-content' }}>
                              {categoryTemplates.map((template) => (
                                <div
                                  key={template.id}
                                  onClick={() => handleTemplateSelect(template)}
                                  className="w-[calc((100vw-theme(spacing.16)-theme(spacing.8)*2-theme(spacing.4)*2)/3)] max-w-[320px] min-w-[280px] flex-shrink-0 rounded-xl border border-dark-border hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer overflow-hidden"
                                >
                                  {/* Screenshot Thumbnail */}
                                  {template.screenshot && (
                                    <div className="w-full h-40 bg-dark-bg/50 overflow-hidden relative">
                                      <img
                                        src={template.screenshot}
                                        alt={template.name}
                                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none'
                                        }}
                                      />
                                      {/* Plan Badge Overlay */}
                                      {template.requiredPlan !== 'free' && (
                                        <span
                                          className={`absolute top-2 right-2 inline-flex items-center ${getPlanBadgeColor(template.requiredPlan)} rounded px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wide shadow-lg`}
                                        >
                                          {getPlanLabel(template.requiredPlan)}
                                        </span>
                                      )}
                                      {/* Recommended Star */}
                                      {template.recommended && (
                                        <div className="absolute top-2 left-2 group/star">
                                          <div className="p-1.5 bg-amber-500/90 rounded-lg shadow-lg">
                                            <Star size={12} className="text-white fill-white" />
                                          </div>
                                          <div className="absolute left-0 top-full mt-1 opacity-0 group-hover/star:opacity-100 transition-opacity pointer-events-none z-10">
                                            <div className="bg-dark-bg border border-dark-border rounded-lg px-2 py-1 shadow-xl whitespace-nowrap">
                                              <span className="text-[10px] text-white">Recommended by CodeDeck</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="p-4">
                                    <h4 className="text-sm font-semibold text-white group-hover:text-primary transition-colors mb-1.5 flex items-center gap-1.5">
                                      {template.name}
                                      {template.recommended && !template.screenshot && (
                                        <Star size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                                      )}
                                    </h4>
                                    <p className="text-xs text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                                      {template.description}
                                    </p>

                                    {/* Tech Stack & Deploy */}
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5">
                                        {template.techStack.slice(0, 3).map((tech) => (
                                          <TechIcon key={tech} name={tech} />
                                        ))}
                                        {template.techStack.length > 3 && (
                                          <span className="text-[10px] text-gray-500">+{template.techStack.length - 3}</span>
                                        )}
                                      </div>

                                      {/* Deploy Services */}
                                      {template.deployServices && template.deployServices.length > 0 && (
                                        <div className="flex items-center gap-1 bg-dark-bg/50 rounded-md px-2 py-1">
                                          {template.deployServices.map((service) => (
                                            <TechIcon key={service} name={service} />
                                          ))}
                                        </div>
                                      )}
                                    </div>
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
            {currentStep === 'details' && (selectedTemplate || importDesignOption === 'screenshot') && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-3xl mx-auto overflow-x-hidden"
              >
                {/* Screenshot Upload - Import flow only */}
                {isImportFlow && importDesignOption === 'screenshot' && !selectedTemplate ? (
                  <div className="max-w-lg mx-auto space-y-6">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-full mb-3">
                        <Palette className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold text-white mb-1.5">
                        Show Us the Look You Want
                      </h3>
                      <p className="text-xs text-gray-400">
                        Upload a screenshot of a design you like. We'll style your content to match it.
                      </p>
                    </div>

                    <label className="block w-full p-8 border-2 border-dashed border-dark-border rounded-xl hover:border-primary/50 transition-all cursor-pointer group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <div className="text-center">
                        {screenshotFile ? (
                          <div className="space-y-2">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/20 rounded-full">
                              <CheckCircle className="w-6 h-6 text-primary" />
                            </div>
                            <p className="text-sm text-white font-medium">{screenshotFile.name}</p>
                            <p className="text-xs text-gray-500">Click to change file</p>
                          </div>
                        ) : (
                          <>
                            <Download className="w-10 h-10 text-gray-400 mx-auto mb-3 group-hover:text-primary transition-colors" />
                            <p className="text-sm text-gray-300 group-hover:text-white transition-colors mb-1">
                              Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">
                              PNG, JPG up to 10MB
                            </p>
                          </>
                        )}
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-5">{selectedTemplate && (
                    <>
                  {/* Screenshot Preview (Large) */}
                  {selectedTemplate.screenshot && (
                    <div className="w-full rounded-lg overflow-hidden border border-dark-border bg-dark-bg/30 relative">
                      <img
                        src={selectedTemplate.screenshot}
                        alt={selectedTemplate.name}
                        className="w-full h-auto object-contain max-h-64"
                        onError={(e) => {
                          e.currentTarget.parentElement!.style.display = 'none'
                        }}
                      />
                      {/* Plan Badge Overlay */}
                      {selectedTemplate.requiredPlan !== 'free' && (
                        <span
                          className={`absolute top-3 right-3 inline-flex items-center ${getPlanBadgeColor(selectedTemplate.requiredPlan)} rounded-md px-3 py-1 text-[11px] font-semibold text-white uppercase tracking-wide shadow-lg`}
                        >
                          {getPlanLabel(selectedTemplate.requiredPlan)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-xl font-bold text-white">
                          {selectedTemplate.name}
                        </h1>
                        {selectedTemplate.demoUrl && (
                          <button
                            onClick={() => window.electronAPI?.shell?.openExternal(selectedTemplate.demoUrl!)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-bg/70 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-xs text-gray-300 hover:text-white font-medium transition-all group opacity-60 hover:opacity-100"
                          >
                            <Globe size={12} className="group-hover:text-primary transition-colors" />
                            View Live Demo
                            <ExternalLink size={10} className="opacity-50" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed break-words">
                        {selectedTemplate.longDescription || selectedTemplate.description}
                      </p>
                    </div>
                  </div>

                  {/* Tech Stack & Deploy Services Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tech Stack */}
                    <div>
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
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

                    {/* Deploy Services */}
                    {selectedTemplate.deployServices && selectedTemplate.deployServices.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
                          Deploy To
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedTemplate.deployServices.map((service) => (
                            <TechIcon
                              key={service}
                              name={service}
                              label={service.charAt(0).toUpperCase() + service.slice(1)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Required Services */}
                  {selectedTemplate.requiredServices && selectedTemplate.requiredServices.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
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
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
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
                    </>
                  )}
                </div>
                )}
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
                    <label className="block text-sm font-semibold text-white/70 mb-2" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
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
                      <h3 className="text-sm font-semibold text-white/70 mb-2" style={{ fontFamily: 'var(--tg-body-font-family)' }}>
                        API Keys (Optional)
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Add your API keys to enable things like payments and databases. Don't have them yet? No worries — you can add them later.
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
                                        {env.isRequired && (
                                          <span className="text-red-400 ml-1">*</span>
                                        )}
                                        {env.description && (
                                          <span className="text-gray-500 text-[10px] ml-2">
                                            {env.description}
                                          </span>
                                        )}
                                        {!env.isRequired && (
                                          <span className="text-gray-500 text-[10px] ml-2 italic">(optional)</span>
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
                  selectedTemplate?.deployServices?.includes('railway')
                    ? 'Starting backend and frontend servers...'
                    : selectedTemplate?.deployServices?.includes('vercel')
                    ? 'Starting Vercel Dev Server...'
                    : 'Starting Netlify Dev and Vite...'
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
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
                  <CheckCircle className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Your Project is Ready!
                </h3>
                <p className="text-sm text-gray-400 mb-8">
                  {projectName} has been successfully created and is running
                </p>

                <button
                  onClick={() => onComplete(projectId)}
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
                    onClick={handleCancel}
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
          <div className="border-t border-dark-border px-6 py-4 relative z-10">
            <div className="flex items-center justify-between min-h-[44px]">
              {/* Back Button */}
              <div className="w-24">
                {currentStep === 'templates' && (
                  <button
                    onClick={() => {
                      setSelectedTemplate(null)
                      setCurrentStep(isImportFlow ? 'template-or-starter' : 'category')
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'template-or-starter' && (
                  <button
                    onClick={() => {
                      if (importDesignOption === 'screenshot') {
                        setSelectedTemplate(null)
                        setCurrentStep('details')
                      } else {
                        setCurrentStep('import-design')
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'import-url' && (
                  <button
                    onClick={() => setCurrentStep('category')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'import-design' && (
                  <button
                    onClick={async () => {
                      // Clean up temp data when going back
                      if (tempImportProjectId) {
                        await window.electronAPI?.websiteImport.cleanup(tempImportProjectId)
                        setTempImportProjectId(null)
                      }

                      setFetchComplete(false)
                      setIsFetchingWebsite(false)
                      setCurrentStep('import-url')
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'details' && (
                  <button
                    onClick={() => {
                      if (isImportFlow && importDesignOption === 'screenshot') {
                        // Screenshot upload - go back to import-design
                        setCurrentStep('import-design')
                      } else {
                        setCurrentStep('templates')
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
                {currentStep === 'configure' && (
                  <button
                    onClick={() => {
                      if (isImportFlow) {
                        setSelectedTemplate(null)
                        setCurrentStep('templates')
                      } else {
                        setCurrentStep('details')
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back
                  </button>
                )}
              </div>

              {/* Next/Create Button */}
              <div className="min-w-[180px] flex justify-end">
                {currentStep === 'import-url' && (
                  <button
                    onClick={handleContinueToDesignSelection}
                    disabled={!fetchComplete}
                    className={fetchComplete ? 'px-5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all inline-flex items-center gap-2' : 'bg-gray-700/50 text-gray-500 cursor-not-allowed inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all'}
                  >
                    Continue
                  </button>
                )}
                {/* import-design navigation handled by option buttons - no footer Continue needed */}
                {currentStep === 'details' && (
                  <>
                    {/* Import flow screenshot upload - go to template-or-starter */}
                    {isImportFlow && importDesignOption === 'screenshot' && !selectedTemplate ? (
                      <button
                        onClick={() => setCurrentStep('template-or-starter')}
                        disabled={!screenshotFile}
                        className={screenshotFile
                          ? 'px-5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all inline-flex items-center gap-2'
                          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all'
                        }
                      >
                        Continue
                      </button>
                    ) : !canAccess && selectedTemplate ? (
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
                        onClick={() => handleContinueToConfig()}
                        className="px-5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all inline-flex items-center gap-2"
                      >
                        Continue
                      </button>
                    )}
                  </>
                )}
                {currentStep === 'configure' && (
                  <div className="flex items-center gap-3">
                    {envVariables.length > 0 && (
                      <button
                        onClick={handleSkipForNow}
                        className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Skip for Now
                      </button>
                    )}
                    <button
                      onClick={() => handleCreateProject(false)}
                      disabled={!projectName.trim()}
                      className={projectName.trim() ? 'px-5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all inline-flex items-center gap-2' : 'bg-gray-700/50 text-gray-500 cursor-not-allowed inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all'}
                    >
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
          <div className="border-t border-dark-border px-8 py-4 relative z-10">
            <div className="flex items-center justify-center gap-2">
              {/* Import Flow Progress */}
              {isImportFlow ? (
                <>
                  <ProgressDot active={currentStep === 'category'} completed={['import-url', 'import-design', 'details', 'template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['import-url', 'import-design', 'details', 'template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'import-url'} completed={['import-design', 'details', 'template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['import-design', 'details', 'template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'import-design' || currentStep === 'details'} completed={['template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['template-or-starter', 'templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'template-or-starter'} completed={['templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['templates', 'configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'templates'} completed={['configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['configure', 'creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'configure'} completed={['creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['creating', 'installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'creating'} completed={['installing', 'initializing'].includes(currentStep)} />
                  <ProgressLine completed={['installing', 'initializing'].includes(currentStep)} />
                  <ProgressDot active={currentStep === 'installing'} completed={['initializing'].includes(currentStep)} />
                  <ProgressLine completed={currentStep === 'initializing'} />
                  <ProgressDot active={currentStep === 'initializing'} completed={false} />
                </>
              ) : (
                <>
                  {/* Template Flow Progress */}
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
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Skip Warning Modal */}
      <AnimatePresence>
        {showSkipWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSkipWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card border border-dark-border rounded-lg shadow-2xl p-6 max-w-md mx-4"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Info className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-white mb-2">
                    No API Keys Yet? That's Fine!
                  </h3>
                  <div className="space-y-3 text-xs text-gray-400 leading-relaxed">
                    <p>
                      Go ahead and skip this — you can add your API keys anytime in Project Settings.
                    </p>
                    <p>
                      Quick note: <span className="text-white font-medium">We use YOUR accounts, not shared ones.</span> Your Stripe, Supabase, MongoDB — it's all yours. Your data stays yours, forever.
                    </p>
                    <p>
                      Some features won't work until you add them, but our guides make it super easy when you're ready.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowSkipWarning(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={handleConfirmSkip}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all"
                >
                  Skip for Now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </ModalPortal>
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
          ? 'bg-primary'
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
        completed ? 'bg-primary' : 'bg-gray-600'
      }`}
    />
  )
}
