import { useState, useEffect } from 'react'
import {
  X,
  FolderOpen,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Key,
  Rocket,
  Info,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Edit3,
  Copy,
  Plus,
  Check
} from 'lucide-react'
import type { TechConfig } from './TemplateSelector'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'
import { ModalPortal } from './ModalPortal'

interface ProjectSettingsProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  projectId: string
  projectPath: string
  isSetupMode?: boolean
  requiredTechConfigs?: TechConfig[]
  onSetupComplete?: () => void
  initialTab?: 'general' | 'environment' | 'deployment'
  onProjectUpdated?: () => void
  onSelectProject?: (projectId: string) => void
  deployServices?: string | null // JSON array of deployment services
}

// Store API key values by key name
interface ApiKeyValues {
  [keyName: string]: string
}

function ProjectSettings({
  isOpen,
  onClose,
  projectName,
  projectId,
  projectPath,
  isSetupMode = false,
  requiredTechConfigs = [],
  onSetupComplete,
  initialTab = 'general',
  onProjectUpdated,
  onSelectProject,
  deployServices
}: ProjectSettingsProps) {
  const { currentProjectId } = useAppStore()
  const { layoutState } = useLayoutStore()
  const toast = useToast()

  // Hide/show preview when modal opens/closes
  useEffect(() => {
    const activeProjectId = projectId || currentProjectId
    if (!activeProjectId || layoutState !== 'DEFAULT') return

    if (isOpen) {
      window.electronAPI?.preview.hide(activeProjectId)
    } else {
      window.electronAPI?.preview.show(activeProjectId)
    }
  }, [isOpen, projectId, currentProjectId, layoutState])
  const [editedName, setEditedName] = useState(projectName)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [apiKeyValues, setApiKeyValues] = useState<ApiKeyValues>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'general' | 'environment' | 'deployment'>(initialTab)
  const [isInstallingDeps, setIsInstallingDeps] = useState(false)
  const [installProgress, setInstallProgress] = useState<string[]>([])
  const [isEditingName, setIsEditingName] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [envFiles, setEnvFiles] = useState<Array<{
    path: string
    label: string
    description: string
    variables: Record<string, string>
    exists: boolean
  }>>([])
  const [loadingEnvFiles, setLoadingEnvFiles] = useState(false)
  const [envFileChanges, setEnvFileChanges] = useState<Record<string, Record<string, string>>>({})
  const [savedEnvFileValues, setSavedEnvFileValues] = useState<Record<string, Record<string, string>>>({})
  const [visibleEnvVars, setVisibleEnvVars] = useState<Set<string>>(new Set())
  const [addingVarForFile, setAddingVarForFile] = useState<string | null>(null)
  const [newVarKey, setNewVarKey] = useState('')
  const [newVarValue, setNewVarValue] = useState('')

  // Deployment token state (global, not project-specific)
  const [connectedServices, setConnectedServices] = useState<Set<string>>(new Set())
  const [expandedService, setExpandedService] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(true)

  // Track if there are unsaved changes
  const hasUnsavedChanges = editedName.trim() !== projectName && editedName.trim() !== '' || Object.keys(envFileChanges).length > 0

  // Format path to show meaningful parts: ~/.../{last-2-folders}
  const formatPath = (path: string) => {
    if (!path) return ''

    // Replace home directory with ~
    const homeDir = '/Users/' + (path.split('/')[2] || '')
    let displayPath = path.replace(homeDir, '~')

    // Split path into parts
    const parts = displayPath.split('/')

    // If path is short enough, show it all
    if (displayPath.length <= 40) return displayPath

    // Show ~/.../{parent-folder}/{project-folder}
    if (parts.length > 3) {
      const lastTwo = parts.slice(-2).join('/')
      return `~/.../​${lastTwo}`
    }

    return displayPath
  }

  // Sync editedName with projectName prop changes
  useEffect(() => {
    setEditedName(projectName)
  }, [projectName])

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Load env files when tab is opened
  useEffect(() => {
    const loadEnvFiles = async () => {
      if (!isOpen || isSetupMode || activeTab !== 'environment') {
        return
      }

      setLoadingEnvFiles(true)
      try {
        const result = await window.electronAPI?.projects.readEnvFiles(projectId)

        if (result?.success && result.envFiles) {
          setEnvFiles(result.envFiles)
          // Initialize changes object and saved values
          const initialChanges: Record<string, Record<string, string>> = {}
          result.envFiles.forEach(file => {
            initialChanges[file.path] = { ...file.variables }
          })
          setEnvFileChanges(initialChanges)
          setSavedEnvFileValues(initialChanges) // Track what was saved
        }
      } catch (error) {
        console.error('❌ Failed to load env files:', error)
        toast.error('Failed to load', 'Could not load environment variables')
      } finally {
        setLoadingEnvFiles(false)
      }
    }

    loadEnvFiles()
  }, [isOpen, isSetupMode, activeTab, projectId])

  // Load connected deployment services (global, not project-specific)
  useEffect(() => {
    const loadConnectedServices = async () => {
      if (!isOpen) return

      setLoadingConnections(true)
      try {
        const result = await window.electronAPI?.deployment?.getConnectedServices()
        if (result?.success && result.services) {
          setConnectedServices(new Set(result.services))
        }
      } catch (error) {
        console.error('Failed to load connected services:', error)
      } finally {
        setLoadingConnections(false)
      }
    }

    loadConnectedServices()
  }, [isOpen])

  // Calculate setup progress based on required keys
  const totalRequiredKeys = requiredTechConfigs.reduce((sum, tech) => sum + tech.apiKeys.length, 0)
  const configuredKeys = requiredTechConfigs.reduce((count, tech) => {
    return count + tech.apiKeys.filter(key => apiKeyValues[key.name]?.trim()).length
  }, 0)
  const setupProgress = totalRequiredKeys > 0 ? (configuredKeys / totalRequiredKeys) * 100 : 100
  const isSetupComplete = setupProgress === 100

  // Calculate how many environment variables need attention (are empty in saved state)
  const emptyEnvVarsCount = Object.entries(savedEnvFileValues).reduce((total, [_filePath, vars]) => {
    const emptyCount = Object.values(vars).filter(value => !value || value.trim() === '').length
    return total + emptyCount
  }, 0)

  // Parse deployment services from JSON
  const parsedDeployServices = deployServices ? JSON.parse(deployServices) : []

  // Deployment service configurations
  const deploymentServiceConfigs: Record<string, {
    name: string
    logo: string
    description: string
    tokenUrl: string
    tokenPlaceholder: string
    tokenEnvVar: string
  }> = {
    netlify: {
      name: 'Netlify',
      logo: '/src/assets/images/netlify.svg',
      description: 'Deploy with instant rollbacks and automatic HTTPS',
      tokenUrl: 'https://app.netlify.com/user/applications#personal-access-tokens',
      tokenPlaceholder: 'nfp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      tokenEnvVar: 'NETLIFY_AUTH_TOKEN'
    },
    vercel: {
      name: 'Vercel',
      logo: '/src/assets/images/vercel.svg',
      description: 'Deploy with edge functions and instant cache invalidation',
      tokenUrl: 'https://vercel.com/account/tokens',
      tokenPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      tokenEnvVar: 'VERCEL_TOKEN'
    },
    cloudflare: {
      name: 'Cloudflare Pages',
      logo: '/src/assets/images/cloudflare.svg',
      description: 'Deploy with global CDN and Workers',
      tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
      tokenPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      tokenEnvVar: 'CLOUDFLARE_API_TOKEN'
    },
    railway: {
      name: 'Railway',
      logo: '/src/assets/tech-icons/railway.svg',
      description: 'Deploy with instant infrastructure and automatic scaling',
      tokenUrl: 'https://railway.com/account/tokens',
      tokenPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      tokenEnvVar: 'RAILWAY_TOKEN'
    }
  }

  // Handle saving deployment token
  const handleSaveToken = async (serviceId: string) => {
    if (!tokenInput.trim()) {
      toast.error('Token required', 'Please enter your personal access token')
      return
    }

    setSavingToken(true)
    try {
      const result = await window.electronAPI?.deployment?.saveToken(serviceId, tokenInput.trim())
      if (result?.success) {
        setConnectedServices(prev => new Set([...prev, serviceId]))
        setExpandedService(null)
        setTokenInput('')
        toast.success('Connected', `${deploymentServiceConfigs[serviceId]?.name || serviceId} connected successfully`)
      } else {
        toast.error('Failed to save', result?.error || 'Could not save token')
      }
    } catch (error) {
      console.error('Error saving token:', error)
      toast.error('Error', 'Failed to save token')
    } finally {
      setSavingToken(false)
    }
  }

  // Handle disconnecting deployment service
  const handleDisconnect = async (serviceId: string) => {
    try {
      const result = await window.electronAPI?.deployment?.disconnect(serviceId)
      if (result?.success) {
        setConnectedServices(prev => {
          const newSet = new Set(prev)
          newSet.delete(serviceId)
          return newSet
        })
        toast.success('Disconnected', `${deploymentServiceConfigs[serviceId]?.name || serviceId} disconnected`)
      } else {
        toast.error('Failed to disconnect', result?.error || 'Could not disconnect service')
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      toast.error('Error', 'Failed to disconnect service')
    }
  }

  const toggleKeyVisibility = (keyName: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyName)) {
        newSet.delete(keyName)
      } else {
        newSet.add(keyName)
      }
      return newSet
    })
  }

  const updateKeyValue = (keyName: string, value: string) => {
    setApiKeyValues(prev => ({ ...prev, [keyName]: value }))
  }

  const toggleEnvVarVisibility = (varKey: string) => {
    setVisibleEnvVars(prev => {
      const newSet = new Set(prev)
      if (newSet.has(varKey)) {
        newSet.delete(varKey)
      } else {
        newSet.add(varKey)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied', `${label} copied to clipboard`)
  }

  const handleSaveChanges = async () => {
    try {
      // Handle project rename if name changed
      if (editedName.trim() !== projectName && editedName.trim() !== '') {
        const result = await window.electronAPI?.projects.rename(projectId, editedName.trim())
        if (result?.success && result.project) {
          toast.success('Project renamed', `Project renamed to "${result.project.name}"`)
          onProjectUpdated?.()
          setIsEditingName(false)
        } else if (result && 'reason' in result && result.reason === 'claude_active') {
          toast.warning(
            'Cannot rename project',
            'Claude is currently working on this project. Please wait for Claude to complete or stop the session first.'
          )
          setEditedName(projectName)
          return
        } else if (result?.error) {
          toast.error('Rename failed', result.error)
          setEditedName(projectName)
          return
        }
      }

      // Handle env file changes
      if (Object.keys(envFileChanges).length > 0) {
        for (const [filePath, variables] of Object.entries(envFileChanges)) {
          // Find original file to check if variables changed
          const originalFile = envFiles.find(f => f.path === filePath)
          if (originalFile && JSON.stringify(originalFile.variables) !== JSON.stringify(variables)) {
            const result = await window.electronAPI?.projects.writeEnvFile(projectId, filePath, variables)
            if (!result?.success) {
              toast.error('Save failed', `Failed to save ${filePath}`)
              return
            }
          }
        }
        // Update saved values after successful save
        setSavedEnvFileValues({ ...envFileChanges })
      }

      toast.success('Settings saved', 'Your changes have been applied')
      onClose()
    } catch (error) {
      console.error('Error saving changes:', error)
      toast.error('Save failed', error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const handleOpenInFinder = async () => {
    try {
      await window.electronAPI?.projects.showInFinder(projectId)
    } catch (error) {
      console.error('Error showing in Finder:', error)
      toast.error('Failed to open', 'Could not open project location')
    }
  }

  const handleDeleteProject = async () => {
    if (deleteConfirmation !== projectName) {
      toast.error('Incorrect confirmation', 'Please type the project name exactly')
      return
    }

    setIsDeleting(true)

    try {
      // Fetch all projects to find next project to switch to
      const projectsResult = await window.electronAPI?.projects.getAll()
      const allProjects = projectsResult?.projects || []

      const result = await window.electronAPI?.projects.delete(projectId)

      if (result?.success) {
        toast.success('Project deleted', `"${projectName}" has been deleted successfully`)

        // If we deleted the current project, switch to another one
        const remainingProjects = allProjects.filter(p => p.id !== projectId)
        if (remainingProjects.length > 0) {
          const mostRecentProject = remainingProjects[0] // Already sorted by lastOpenedAt DESC
          await window.electronAPI?.process.setCurrentProject(mostRecentProject.id)
          onSelectProject?.(mostRecentProject.id)
          toast.info('Switched project', `Now viewing ${mostRecentProject.name}`)
        }

        // Notify parent to refresh
        onProjectUpdated?.()

        // Close modal and reset state
        setShowDeleteModal(false)
        setDeleteConfirmation('')
        onClose()
      } else {
        toast.error('Delete failed', result?.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/${isSetupMode ? '80' : '60'} backdrop-blur-sm animate-fadeIn`}
          onClick={isSetupMode ? undefined : onClose}
        />

        {/* Modal */}
        <div className="relative w-[700px] max-h-[80vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b border-dark-border/50">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">
                  {isSetupMode ? 'Complete Project Setup' : 'Project Settings'}
                </h2>
              </div>
              {!isSetupMode && (
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
                >
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </div>
            {/* Setup Progress Bar */}
            {isSetupMode && totalRequiredKeys > 0 && (
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-400">
                    {configuredKeys} of {totalRequiredKeys} required API keys configured
                  </span>
                  <span className="text-xs font-semibold text-primary">{Math.round(setupProgress)}%</span>
                </div>
                <div className="h-1.5 bg-dark-bg/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary-dark transition-all duration-500 rounded-full"
                    style={{ width: `${setupProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tabs - Hidden in setup mode */}
          {!isSetupMode && (
            <div className="border-b border-dark-border/50 px-5 relative z-10">
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === 'general'
                      ? 'border-primary text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setActiveTab('environment')}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all flex items-center gap-2 ${
                    activeTab === 'environment'
                      ? 'border-primary text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Environment Variables
                  {emptyEnvVarsCount > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/30 rounded text-[10px] font-semibold text-yellow-400">
                      <AlertTriangle size={9} />
                      {emptyEnvVarsCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('deployment')}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === 'deployment'
                      ? 'border-primary text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Deployment
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin relative z-10">
            {/* General Tab */}
            {!isSetupMode && activeTab === 'general' && (
              <>
                {/* Project Information */}
                <section>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Info size={14} className="text-primary" />
                    Project Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        Project Name
                      </label>
                      <div className="flex items-center gap-2">
                        {isEditingName ? (
                          <input
                            type="text"
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                setEditedName(projectName)
                                setIsEditingName(false)
                              }
                            }}
                            onBlur={() => setIsEditingName(false)}
                            className="flex-1 bg-dark-bg/50 border border-primary/50 rounded-lg px-3 py-2 text-sm text-white outline-none transition-all"
                            autoFocus
                          />
                        ) : (
                          <>
                            <div className="flex-1 bg-dark-bg/30 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-white">
                              {projectName}
                            </div>
                            <button
                              onClick={() => setIsEditingName(true)}
                              className="px-3 py-2 bg-dark-bg/50 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-xs text-gray-300 hover:text-white font-medium transition-all flex items-center gap-1.5"
                            >
                              <Edit3 size={12} />
                              Edit Name
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        Project ID
                      </label>
                      <div className="w-full bg-dark-bg/30 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-gray-500 font-mono">
                        {projectId}
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">Cannot be changed</p>
                    </div>
                  </div>
                </section>

                {/* Project Location */}
                <section>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <FolderOpen size={14} className="text-primary" />
                    Project Location
                  </h3>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 bg-dark-bg/30 border border-dark-border/50 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono overflow-hidden"
                      title={projectPath}
                    >
                      {formatPath(projectPath)}
                    </div>
                    <button
                      onClick={handleOpenInFinder}
                      className="px-3 py-2 bg-dark-bg/50 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg text-xs text-gray-300 hover:text-white font-medium transition-all flex items-center gap-1.5"
                    >
                      <ExternalLink size={12} />
                      Open
                    </button>
                  </div>
                </section>

                {/* Danger Zone */}
                <section>
                  <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    Danger Zone
                  </h3>
                  <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-medium text-white">Delete this project</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Once deleted, this project cannot be recovered.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 text-red-400 text-xs font-medium rounded transition-all"
                      >
                        Delete Project
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Environment Variables Tab (or Setup Mode with API Keys) */}
            {(isSetupMode || activeTab === 'environment') && (
              <section className={isSetupMode ? 'ring-2 ring-primary/30 rounded-lg p-4 -m-4' : ''}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Key size={14} className="text-primary" />
                  {isSetupMode ? 'API Keys Configuration' : 'Environment Variables'}
                  {isSetupMode && <span className="text-xs text-primary font-normal">(Required)</span>}
                </h3>

                {/* Setup Mode: Show API Keys Configuration */}
                {isSetupMode && (
                  <>
                    {requiredTechConfigs.length > 0 && (
                      <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={14} className="text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-white mb-1">Complete Service Configuration</p>
                            <p className="text-[11px] text-gray-400">
                              Configure the API keys below for each service required by this template.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-5">
                      {requiredTechConfigs.length > 0 ? (
                        requiredTechConfigs.map((tech) => (
                      <div key={tech.name} className="space-y-3">
                        {/* Tech Header */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-dark-bg/50 flex items-center justify-center">
                            <img src={tech.icon} alt={tech.displayName} className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xs font-semibold text-white">{tech.displayName}</h4>
                            <p className="text-[10px] text-gray-500">
                              {tech.apiKeys.filter(k => apiKeyValues[k.name]?.trim()).length} of {tech.apiKeys.length} configured
                            </p>
                          </div>
                          {tech.apiKeys.every(k => apiKeyValues[k.name]?.trim()) && (
                            <CheckCircle2 size={14} className="text-primary" />
                          )}
                        </div>

                        {/* API Key Fields */}
                        <div className="pl-9 space-y-2.5">
                          {tech.apiKeys.map((keyConfig) => {
                            const isConfigured = apiKeyValues[keyConfig.name]?.trim()
                            const isVisible = visibleKeys.has(keyConfig.name)

                            return (
                              <div key={keyConfig.name} className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  {isConfigured ? (
                                    <CheckCircle2 size={11} className="text-primary" />
                                  ) : (
                                    <Circle size={11} className="text-gray-600" />
                                  )}
                                  <label className="text-[11px] font-medium text-gray-400">
                                    {keyConfig.label}
                                  </label>
                                </div>
                                <div className="relative">
                                  <input
                                    type={isVisible ? 'text' : 'password'}
                                    value={apiKeyValues[keyConfig.name] || ''}
                                    onChange={(e) => updateKeyValue(keyConfig.name, e.target.value)}
                                    placeholder={keyConfig.placeholder}
                                    className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 pr-10 text-xs text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all font-mono"
                                  />
                                  <button
                                    onClick={() => toggleKeyVisibility(keyConfig.name)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-dark-bg/70 rounded transition-all"
                                  >
                                    {isVisible ? (
                                      <EyeOff size={12} className="text-gray-500" />
                                    ) : (
                                      <Eye size={12} className="text-gray-500" />
                                    )}
                                  </button>
                                </div>
                                {keyConfig.description && (
                                  <p className="text-[10px] text-gray-600">{keyConfig.description}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-8">
                          No API keys required for this project template.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Normal Mode: Show Environment Variables from .env files */}
                {!isSetupMode && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500 mb-4">
                      Manage environment variables for your project. Changes will be saved to your .env files.
                    </p>

                    {loadingEnvFiles ? (
                      <p className="text-xs text-gray-400 text-center py-8">
                        Loading environment variables...
                      </p>
                    ) : envFiles.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-8">
                        No environment files configured for this project.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {envFiles.map((envFile) => (
                          <div key={envFile.path} className="space-y-3">
                            {/* File Header */}
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-white">{envFile.label}</h4>
                                <p className="text-[10px] text-gray-500 mt-0.5">{envFile.description}</p>
                                <p className="text-[10px] text-gray-600 font-mono mt-1">{envFile.path}</p>
                              </div>
                              {!envFile.exists && (
                                <span className="text-[10px] px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                                  File will be created
                                </span>
                              )}
                            </div>

                            {/* Variables - Split into Required (empty) and Configured */}
                            <div className="pl-0 space-y-4">
                              {(() => {
                                const allVars = Object.entries(envFileChanges[envFile.path] || {})
                                const savedVars = savedEnvFileValues[envFile.path] || {}
                                // Check against SAVED values, not current input
                                const emptyVars = allVars.filter(([key, _]) => !savedVars[key] || savedVars[key].trim() === '')
                                const configuredVars = allVars.filter(([key, _]) => savedVars[key] && savedVars[key].trim() !== '')

                                return (
                                  <>
                                    {/* Empty/Required Variables - Highlighted */}
                                    {emptyVars.length > 0 && (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <AlertTriangle size={12} className="text-yellow-500" />
                                          <h5 className="text-[11px] font-semibold text-yellow-500 uppercase tracking-wide">
                                            Action Required ({emptyVars.length})
                                          </h5>
                                        </div>
                                        <div className="space-y-2">
                                          {emptyVars.map(([key, value]) => {
                                            const varId = `${envFile.path}:${key}`
                                            const isVisible = visibleEnvVars.has(varId)

                                            return (
                                              <div key={key} className="flex items-center gap-2 group">
                                                <div className="flex-1 flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2.5 font-mono text-xs">
                                                  <span className="text-yellow-400 font-semibold">{key}</span>
                                                  <span className="text-gray-600">=</span>
                                                  <input
                                                    type={isVisible ? 'text' : 'password'}
                                                    value={value}
                                                    onChange={(e) => {
                                                      setEnvFileChanges(prev => ({
                                                        ...prev,
                                                        [envFile.path]: {
                                                          ...prev[envFile.path],
                                                          [key]: e.target.value
                                                        }
                                                      }))
                                                    }}
                                                    placeholder={`Add your ${key.toLowerCase().replace(/_/g, ' ')} here`}
                                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none min-w-0"
                                                  />
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button
                                                    onClick={() => toggleEnvVarVisibility(varId)}
                                                    className="p-1.5 hover:bg-dark-bg/50 rounded transition-all"
                                                    title={isVisible ? 'Hide value' : 'Show value'}
                                                  >
                                                    {isVisible ? (
                                                      <EyeOff size={12} className="text-gray-400" />
                                                    ) : (
                                                      <Eye size={12} className="text-gray-400" />
                                                    )}
                                                  </button>
                                                  {value && (
                                                    <button
                                                      onClick={() => copyToClipboard(value, key)}
                                                      className="p-1.5 hover:bg-dark-bg/50 rounded transition-all"
                                                      title="Copy value"
                                                    >
                                                      <Copy size={12} className="text-gray-400" />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Configured Variables */}
                                    {configuredVars.length > 0 && (
                                      <div className="space-y-2">
                                        {emptyVars.length > 0 && (
                                          <div className="flex items-center gap-2">
                                            <CheckCircle2 size={12} className="text-primary" />
                                            <h5 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                              Configured ({configuredVars.length})
                                            </h5>
                                          </div>
                                        )}
                                        <div className="space-y-2">
                                          {configuredVars.map(([key, value]) => {
                                            const varId = `${envFile.path}:${key}`
                                            const isVisible = visibleEnvVars.has(varId)

                                            return (
                                              <div key={key} className="flex items-center gap-2 group">
                                                <div className="flex-1 flex items-center gap-1.5 bg-dark-bg/30 border border-dark-border/50 rounded-lg px-3 py-2 font-mono text-xs hover:border-dark-border transition-colors">
                                                  <span className="text-primary font-semibold">{key}</span>
                                                  <span className="text-gray-600">=</span>
                                                  <input
                                                    type={isVisible ? 'text' : 'password'}
                                                    value={value}
                                                    onChange={(e) => {
                                                      setEnvFileChanges(prev => ({
                                                        ...prev,
                                                        [envFile.path]: {
                                                          ...prev[envFile.path],
                                                          [key]: e.target.value
                                                        }
                                                      }))
                                                    }}
                                                    placeholder={`Add your ${key.toLowerCase().replace(/_/g, ' ')} here`}
                                                    className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none min-w-0"
                                                  />
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button
                                                    onClick={() => toggleEnvVarVisibility(varId)}
                                                    className="p-1.5 hover:bg-dark-bg/50 rounded transition-all"
                                                    title={isVisible ? 'Hide value' : 'Show value'}
                                                  >
                                                    {isVisible ? (
                                                      <EyeOff size={12} className="text-gray-400" />
                                                    ) : (
                                                      <Eye size={12} className="text-gray-400" />
                                                    )}
                                                  </button>
                                                  <button
                                                    onClick={() => copyToClipboard(value, key)}
                                                    className="p-1.5 hover:bg-dark-bg/50 rounded transition-all"
                                                    title="Copy value"
                                                  >
                                                    <Copy size={12} className="text-gray-400" />
                                                  </button>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {allVars.length === 0 && (
                                      <p className="text-[11px] text-gray-600 italic">No variables defined</p>
                                    )}
                                  </>
                                )
                              })()}

                              {/* Add new variable - Inline form */}
                              {addingVarForFile === envFile.path ? (
                                <div className="space-y-2 pt-2 border-t border-dark-border/30">
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold">New Variable</p>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center gap-1.5 bg-dark-bg/50 border border-primary/30 rounded-lg px-3 py-2 font-mono text-xs">
                                      <input
                                        type="text"
                                        value={newVarKey}
                                        onChange={(e) => setNewVarKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                                        placeholder="VARIABLE_NAME"
                                        className="w-32 bg-transparent text-primary font-semibold placeholder-gray-600 outline-none"
                                        autoFocus
                                      />
                                      <span className="text-gray-600">=</span>
                                      <input
                                        type="text"
                                        value={newVarValue}
                                        onChange={(e) => setNewVarValue(e.target.value)}
                                        placeholder="value"
                                        className="flex-1 bg-transparent text-white placeholder-gray-600 outline-none min-w-0"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && newVarKey.trim()) {
                                            setEnvFileChanges(prev => ({
                                              ...prev,
                                              [envFile.path]: {
                                                ...prev[envFile.path],
                                                [newVarKey.trim()]: newVarValue
                                              }
                                            }))
                                            setNewVarKey('')
                                            setNewVarValue('')
                                            setAddingVarForFile(null)
                                          } else if (e.key === 'Escape') {
                                            setNewVarKey('')
                                            setNewVarValue('')
                                            setAddingVarForFile(null)
                                          }
                                        }}
                                      />
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (newVarKey.trim()) {
                                          setEnvFileChanges(prev => ({
                                            ...prev,
                                            [envFile.path]: {
                                              ...prev[envFile.path],
                                              [newVarKey.trim()]: newVarValue
                                            }
                                          }))
                                          setNewVarKey('')
                                          setNewVarValue('')
                                          setAddingVarForFile(null)
                                        }
                                      }}
                                      disabled={!newVarKey.trim()}
                                      className="p-1.5 bg-primary hover:bg-primary-dark disabled:bg-dark-bg/50 disabled:cursor-not-allowed rounded transition-all"
                                      title="Add variable"
                                    >
                                      <Check size={12} className="text-white" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setNewVarKey('')
                                        setNewVarValue('')
                                        setAddingVarForFile(null)
                                      }}
                                      className="p-1.5 hover:bg-dark-bg/50 rounded transition-all"
                                      title="Cancel"
                                    >
                                      <X size={12} className="text-gray-500" />
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-gray-600">
                                    Press <kbd className="px-1 py-0.5 bg-dark-bg/50 border border-dark-border/50 rounded text-[9px]">Enter</kbd> to add or <kbd className="px-1 py-0.5 bg-dark-bg/50 border border-dark-border/50 rounded text-[9px]">Esc</kbd> to cancel
                                  </p>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddingVarForFile(envFile.path)}
                                  className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary-dark transition-colors group"
                                >
                                  <Plus size={12} className="group-hover:scale-110 transition-transform" />
                                  Add Variable
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Deployment Tab */}
            {!isSetupMode && activeTab === 'deployment' && (
              <section>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Rocket size={14} className="text-primary" />
                  Deployment Services
                </h3>

                {loadingConnections ? (
                  <div className="text-center py-8">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Loading connections...</p>
                  </div>
                ) : parsedDeployServices.length === 0 ? (
                  <div className="text-center py-8">
                    <Info size={16} className="text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">
                      No deployment services configured for this template.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {parsedDeployServices.map((serviceId: string) => {
                      const config = deploymentServiceConfigs[serviceId]
                      if (!config) return null

                      const isConnected = connectedServices.has(serviceId)
                      const isExpanded = expandedService === serviceId

                      return (
                        <div
                          key={serviceId}
                          className={`bg-dark-bg/30 border rounded-lg transition-all overflow-hidden ${
                            isExpanded ? 'border-primary/50' : 'border-dark-border/50 hover:border-dark-border'
                          }`}
                        >
                          {/* Service Header */}
                          <div
                            className="flex items-center justify-between p-3 cursor-pointer"
                            onClick={() => {
                              if (isConnected) return // Don't expand if connected
                              setExpandedService(isExpanded ? null : serviceId)
                              setTokenInput('')
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded flex items-center justify-center bg-dark-bg/50">
                                <img
                                  src={config.logo}
                                  alt={config.name}
                                  className="w-5 h-5"
                                  style={{
                                    filter: isConnected ? 'none' : 'grayscale(100%) brightness(0.5)'
                                  }}
                                />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-medium text-white">{config.name}</p>
                                <p className="text-[10px] text-gray-500">
                                  {isConnected ? 'Connected' : config.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isConnected ? (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDisconnect(serviceId)
                                  }}
                                  className="text-[10px] font-medium px-2 py-1 rounded bg-primary/20 text-primary hover:bg-red-500/20 hover:text-red-400 transition-colors"
                                >
                                  Disconnect
                                </button>
                              ) : (
                                <span className={`text-[10px] font-medium px-2 py-1 rounded ${
                                  isExpanded
                                    ? 'bg-primary/20 text-primary'
                                    : 'bg-gray-700/50 text-gray-500'
                                }`}>
                                  {isExpanded ? 'Connecting...' : 'Connect'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Expanded Token Input */}
                          {isExpanded && !isConnected && (
                            <div className="px-3 pb-3 pt-0 space-y-3 border-t border-dark-border/30">
                              <div className="pt-3">
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                                  Personal Access Token
                                </label>
                                <div className="relative">
                                  <input
                                    type="password"
                                    value={tokenInput}
                                    onChange={(e) => setTokenInput(e.target.value)}
                                    placeholder={config.tokenPlaceholder}
                                    className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all font-mono"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && tokenInput.trim()) {
                                        handleSaveToken(serviceId)
                                      } else if (e.key === 'Escape') {
                                        setExpandedService(null)
                                        setTokenInput('')
                                      }
                                    }}
                                  />
                                </div>
                                {/* Get Token Button - Prominent for non-tech users */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.electronAPI?.shell?.openExternal(config.tokenUrl)
                                  }}
                                  className="w-full mt-3 px-3 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-lg text-xs font-medium text-primary transition-all flex items-center justify-center gap-2"
                                >
                                  <ExternalLink size={14} />
                                  Get your {config.name} token
                                </button>
                                <p className="text-[10px] text-gray-500 text-center mt-2">
                                  Opens in your browser. Copy the token and paste it above.
                                </p>

                                {/* Action buttons */}
                                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-dark-border/30">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setExpandedService(null)
                                      setTokenInput('')
                                    }}
                                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSaveToken(serviceId)
                                    }}
                                    disabled={!tokenInput.trim() || savingToken}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                                      tokenInput.trim() && !savingToken
                                        ? 'bg-primary text-white hover:bg-primary-dark'
                                        : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                                    }`}
                                  >
                                    {savingToken && (
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {savingToken ? 'Saving...' : 'Save Token'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-dark-border/50 bg-dark-bg/20 flex justify-end gap-2 relative z-10">
            {!isSetupMode && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-dark-bg/50 hover:bg-dark-bg text-gray-300 text-sm font-medium rounded-lg transition-all"
              >
                {hasUnsavedChanges ? 'Cancel' : 'Close'}
              </button>
            )}
            {!isSetupMode && hasUnsavedChanges && (
              <button
                onClick={handleSaveChanges}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary"
              >
                Save Changes
              </button>
            )}
            {isSetupMode && (
              <button
                onClick={async () => {
                  if (onSetupComplete) {
                    // Save environment configuration
                    try {
                      setIsInstallingDeps(true)
                      setInstallProgress([])

                      const result = await window.electronAPI?.projects.saveEnvConfig(projectId, apiKeyValues)

                      if (result?.success) {
                        toast.success('Configuration saved!', 'Environment variables written to .env')

                        // Start npm install
                        toast.info('Installing dependencies...', 'This may take a few minutes')

                        // Listen for progress
                        window.electronAPI?.onDependencyProgress?.((data: string) => {
                          setInstallProgress(prev => [...prev, data])
                        })

                        const installResult = await window.electronAPI?.projects.installDependencies(projectId)

                        setIsInstallingDeps(false)

                        if (installResult?.success) {
                          toast.success('Setup complete!', 'Dependencies installed successfully')
                          onSetupComplete()
                        } else {
                          toast.error('Dependency installation failed', installResult?.error || 'Unknown error')
                        }
                      } else {
                        setIsInstallingDeps(false)
                        toast.error('Failed to save configuration', result?.error || 'Unknown error')
                      }
                    } catch (error) {
                      setIsInstallingDeps(false)
                      console.error('Error during setup:', error)
                      toast.error('Setup failed', error instanceof Error ? error.message : 'Unknown error')
                    }
                  }
                }}
                disabled={!isSetupComplete || isInstallingDeps}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  !isSetupComplete || isInstallingDeps
                    ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                    : 'bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary shadow-lg shadow-primary/20'
                }`}
              >
                {isInstallingDeps ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block mr-2" />
                    Installing Dependencies...
                  </>
                ) : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[310] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              if (!isDeleting) {
                setShowDeleteModal(false)
                setDeleteConfirmation('')
              }
            }}
          />
          <div className="relative w-[450px] bg-dark-card border border-red-500/30 rounded-xl shadow-2xl p-5 overflow-hidden">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">Delete Project</h3>
                <p className="text-xs text-gray-400">
                  This action cannot be undone. This will permanently delete the project and all its files.
                </p>
              </div>
            </div>

            <div className="mb-4 relative z-10">
              <label className="block text-xs font-medium text-gray-400 mb-2">
                Type <span className="font-mono text-white">{projectName}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmation === projectName && !isDeleting) {
                    handleDeleteProject()
                  }
                  if (e.key === 'Escape' && !isDeleting) {
                    setShowDeleteModal(false)
                    setDeleteConfirmation('')
                  }
                }}
                disabled={isDeleting}
                placeholder={projectName}
                className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
            </div>

            <div className="flex gap-2 relative z-10">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-dark-bg/50 hover:bg-dark-bg text-gray-300 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleteConfirmation !== projectName || isDeleting}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  deleteConfirmation === projectName && !isDeleting
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isDeleting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalPortal>
  )
}

export default ProjectSettings
