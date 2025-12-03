import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, RefreshCw, Code, Server, Rocket, X, AlertCircle } from 'lucide-react'
import { Template } from '../types/electron'
import { ModalPortal } from './ModalPortal'

type WizardStep = 'cloning' | 'env-config' | 'installing' | 'initializing' | 'complete' | 'error'

// Tech configuration for API keys (matching TemplateSelector)
const TECH_CONFIGS: Record<string, { name: string; apiKeys: { name: string; label: string; description?: string }[] }> = {
  stripe: {
    name: 'stripe',
    apiKeys: [
      { name: 'STRIPE_PUBLISHABLE_KEY', label: 'Publishable Key', description: 'Used for client-side operations' },
      { name: 'STRIPE_SECRET_KEY', label: 'Secret Key', description: 'Used for server-side operations' },
      { name: 'STRIPE_WEBHOOK_SECRET', label: 'Webhook Signing Secret', description: 'Used to verify webhook events' },
    ],
  },
  mongodb: {
    name: 'mongodb',
    apiKeys: [
      { name: 'MONGODB_URI', label: 'Connection String', description: 'Your MongoDB connection string' },
    ],
  },
  supabase: {
    name: 'supabase',
    apiKeys: [
      { name: 'SUPABASE_URL', label: 'Project URL', description: 'Your Supabase project URL' },
      { name: 'SUPABASE_ANON_KEY', label: 'Anon Key', description: 'Public anonymous key for client-side' },
      { name: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Service Role Key', description: 'Secret key for server-side admin operations' },
    ],
  },
}

interface ProjectCreationWizardProps {
  isOpen: boolean
  projectName: string
  template: Template
  onComplete: () => void
  onCancel: () => void
}

interface EnvVariable {
  key: string
  value: string
  description?: string
}

export function ProjectCreationWizard({
  isOpen,
  projectName,
  template,
  onComplete,
  onCancel
}: ProjectCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('cloning')
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasStartedRef = useRef(false)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('cloning')
      setEnvVariables([])
      setProjectId(null)
      setError(null)
      hasStartedRef.current = false
    }
  }, [isOpen])

  // Start project creation process
  useEffect(() => {
    if (!isOpen || hasStartedRef.current) return

    hasStartedRef.current = true

    const createProject = async () => {
      try {
        // Step 1: Clone template
        setCurrentStep('cloning')

        // Create project
        const result = await window.electronAPI?.projects.create(
          template.id,
          projectName
        )

        if (!result?.success) {
          throw new Error(result?.error || 'Failed to create project')
        }

        setProjectId(result.project.id)

        // Step 2: Environment configuration
        setCurrentStep('env-config')

        // Build env variables from template's requiredServices
        const requiredEnvVars: EnvVariable[] = []
        template.requiredServices.forEach((service) => {
          const config = TECH_CONFIGS[service]
          if (config) {
            config.apiKeys.forEach((apiKey) => {
              requiredEnvVars.push({
                key: apiKey.name,
                value: '',
                description: apiKey.description
              })
            })
          }
        })

        if (requiredEnvVars.length > 0) {
          setEnvVariables(requiredEnvVars)
        } else {
          // No env variables needed, skip to installation
          await proceedToInstallation(result.project.id)
        }
      } catch (err) {
        console.error('Project creation failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setCurrentStep('error')
      }
    }

    createProject()
  }, [isOpen])

  const proceedToInstallation = async (projId: string) => {
    try {
      // Step 3: Install dependencies
      setCurrentStep('installing')

      const installResult = await window.electronAPI?.projects.installDependencies(projId)

      if (!installResult?.success) {
        throw new Error('Failed to install dependencies')
      }

      // Step 4: Initialize dev server
      setCurrentStep('initializing')

      const serverResult = await window.electronAPI?.process.startDevServer(projId)

      if (!serverResult?.success) {
        throw new Error('Failed to start development server')
      }

      // Step 5: Complete
      setCurrentStep('complete')
    } catch (err) {
      console.error('Installation failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setCurrentStep('error')
    }
  }

  const handleEnvSubmit = async () => {
    if (!projectId) return

    try {
      // Save environment variables
      const envConfig: Record<string, string> = {}
      envVariables.forEach((v) => {
        if (v.value) {
          envConfig[v.key] = v.value
        }
      })

      await window.electronAPI?.projects.saveEnvConfig(projectId, envConfig)

      // Proceed to installation
      await proceedToInstallation(projectId)
    } catch (err) {
      console.error('Failed to save env config:', err)
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
      setCurrentStep('error')
    }
  }

  const handleSkipEnv = async () => {
    if (!projectId) return
    await proceedToInstallation(projectId)
  }

  const handleComplete = () => {
    onComplete()
  }

  const handleRetry = () => {
    setCurrentStep('cloning')
    setError(null)
    setProjectId(null)
    hasStartedRef.current = false
  }

  if (!isOpen) return null

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
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
        className="relative w-full max-w-lg bg-dark-card border border-dark-border rounded-lg shadow-2xl mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <div>
            <h2 className="text-sm font-semibold text-white">Creating {projectName}</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Setting up your {template.name} project
            </p>
          </div>
          {(currentStep === 'complete' || currentStep === 'error') && (
            <button
              onClick={onCancel}
              className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
            >
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {/* Cloning Step */}
            {currentStep === 'cloning' && (
              <StepContent
                key="cloning"
                icon={<Code className="w-10 h-10" />}
                title="Cloning Repository"
                description="Fetching template files from GitHub..."
                isLoading
              />
            )}

            {/* Environment Configuration Step */}
            {currentStep === 'env-config' && (
              <motion.div
                key="env-config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-5">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
                    <Code className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">
                    Configure Environment
                  </h3>
                  <p className="text-xs text-gray-400">
                    Set up your environment variables for development
                  </p>
                </div>

                <div className="space-y-3 max-h-80 overflow-y-auto mb-5 scrollbar-thin">
                  {envVariables.map((env, index) => (
                    <div key={env.key} className="space-y-1.5">
                      <label className="block text-xs font-medium text-gray-300">
                        {env.key}
                        {env.description && (
                          <span className="text-gray-500 text-[10px] ml-2">
                            {env.description}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={env.value}
                        onChange={(e) => {
                          const newVars = [...envVariables]
                          newVars[index].value = e.target.value
                          setEnvVariables(newVars)
                        }}
                        className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-all"
                        placeholder={`Enter ${env.key}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSkipEnv}
                    className="flex-1 px-4 py-2 border border-dark-border text-gray-300 rounded-lg hover:bg-dark-bg/30 transition-colors text-sm font-medium"
                  >
                    Skip for Now
                  </button>
                  <button
                    onClick={handleEnvSubmit}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}

            {/* Installing Dependencies Step */}
            {currentStep === 'installing' && (
              <StepContent
                key="installing"
                icon={<RefreshCw className="w-10 h-10" />}
                title="Installing Dependencies"
                description="Running npm install... This may take a few minutes"
                isLoading
              />
            )}

            {/* Initializing Dev Server Step */}
            {currentStep === 'initializing' && (
              <StepContent
                key="initializing"
                icon={<Server className="w-10 h-10" />}
                title="Initializing Development Server"
                description={
                  template.deployServices?.includes('railway')
                    ? "Starting backend and frontend servers..."
                    : "Starting Netlify Dev and Vite..."
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
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-5">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Your Project is Ready!
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  {projectName} has been successfully created and is running
                </p>

                <button
                  onClick={handleComplete}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium text-sm shadow-lg shadow-primary/20"
                >
                  <Rocket className="w-4 h-4" />
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
                className="text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-5">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  Setup Failed
                </h3>
                <p className="text-sm text-gray-400 mb-3">
                  We encountered an error while setting up your project
                </p>
                <p className="text-xs text-red-400 mb-6 font-mono bg-red-950/30 p-3 rounded-lg border border-red-900/30">
                  {error}
                </p>

                <div className="flex gap-2 justify-center">
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 border border-dark-border text-gray-300 rounded-lg hover:bg-dark-bg/30 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Steps Indicator */}
        {currentStep !== 'complete' && currentStep !== 'error' && (
          <div className="border-t border-dark-border px-8 py-4">
            <div className="flex items-center justify-center gap-2">
              <ProgressDot active={currentStep === 'cloning'} completed={['env-config', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['env-config', 'installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'env-config'} completed={['installing', 'initializing'].includes(currentStep)} />
              <ProgressLine completed={['installing', 'initializing'].includes(currentStep)} />
              <ProgressDot active={currentStep === 'installing'} completed={['initializing'].includes(currentStep)} />
              <ProgressLine completed={currentStep === 'initializing'} />
              <ProgressDot active={currentStep === 'initializing'} completed={false} />
            </div>
          </div>
        )}
      </motion.div>
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
      className="text-center py-6"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-5">
        <div className={isLoading ? 'animate-pulse' : ''}>
          <div className="text-primary">{icon}</div>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400 mb-5">{description}</p>
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
