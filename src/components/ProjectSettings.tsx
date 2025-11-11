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
  EyeOff
} from 'lucide-react'
import type { TechConfig } from './TemplateSelector'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'
import bgImage from '../assets/images/bg.jpg'

interface ProjectSettingsProps {
  isOpen: boolean
  onClose: () => void
  projectName: string
  projectId: string
  projectPath: string
  isSetupMode?: boolean
  requiredTechConfigs?: TechConfig[]
  onSetupComplete?: () => void
  initialTab?: 'general' | 'apikeys' | 'deployment'
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
  initialTab = 'general'
}: ProjectSettingsProps) {
  const { netlifyConnected, setNetlifyConnected, currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState } = useLayoutStore()
  const toast = useToast()
  const [editedName, setEditedName] = useState(projectName)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [apiKeyValues, setApiKeyValues] = useState<ApiKeyValues>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'general' | 'apikeys' | 'deployment'>(initialTab)
  const [isInstallingDeps, setIsInstallingDeps] = useState(false)
  const [installProgress, setInstallProgress] = useState<string[]>([])

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Handle freeze frame when settings opens/closes
  useEffect(() => {
    const activeProjectId = projectId || currentProjectId

    const handleFreezeFrame = async () => {
      if (isOpen && activeProjectId) {
        // Opening settings - activate freeze frame
        const result = await window.electronAPI?.layout.captureModalFreeze(activeProjectId)
        if (result?.success && result.freezeImage) {
          setModalFreezeImage(result.freezeImage)
          setModalFreezeActive(true)
          // Hide BrowserView (unless in TOOLS state where it's already hidden)
          if (layoutState !== 'TOOLS') {
            await window.electronAPI?.preview.hide(activeProjectId)
          }
        }
      } else {
        // Closing settings - deactivate freeze frame
        setModalFreezeActive(false)
        if (activeProjectId && layoutState !== 'TOOLS') {
          await window.electronAPI?.preview.show(activeProjectId)
        }
      }
    }

    handleFreezeFrame()
  }, [isOpen, projectId, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  // Calculate setup progress based on required keys
  const totalRequiredKeys = requiredTechConfigs.reduce((sum, tech) => sum + tech.apiKeys.length, 0)
  const configuredKeys = requiredTechConfigs.reduce((count, tech) => {
    return count + tech.apiKeys.filter(key => apiKeyValues[key.name]?.trim()).length
  }, 0)
  const setupProgress = totalRequiredKeys > 0 ? (configuredKeys / totalRequiredKeys) * 100 : 100
  const isSetupComplete = setupProgress === 100

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

  const handleOpenInFinder = () => {
    // Will implement with Electron
  }

  const handleToggleNetlify = () => {
    if (netlifyConnected) {
      setNetlifyConnected(false)
      toast.warning('Netlify disconnected', 'You can reconnect anytime from settings')
    } else {
      setNetlifyConnected(true)
      toast.success('Netlify connected!', 'You can now deploy your project')
    }
  }

  const handleDeleteProject = () => {
    if (deleteConfirmation === projectId) {
      toast.error('Project deleted', `${projectName} has been permanently removed`)
      setShowDeleteModal(false)
      onClose()
      // Will implement actual deletion
    } else {
      toast.error('Incorrect confirmation', 'Please type the project ID exactly')
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/${isSetupMode ? '80' : '60'} backdrop-blur-sm animate-fadeIn`}
          onClick={isSetupMode ? undefined : onClose}
        />

        {/* Modal */}
        <div className="relative w-[700px] max-h-[80vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col">
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
          <div className="border-b border-dark-border/50 relative z-10">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-white">
                  {isSetupMode ? 'Complete Project Setup' : 'Project Settings'}
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">{projectName}</p>
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
                  onClick={() => setActiveTab('apikeys')}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === 'apikeys'
                      ? 'border-primary text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  API Keys
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
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50 transition-all"
                      />
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
                    <div className="flex-1 bg-dark-bg/30 border border-dark-border/50 rounded-lg px-3 py-2 text-xs text-gray-400 font-mono truncate">
                      {projectPath}
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

            {/* API Keys Tab (or Setup Mode) */}
            {(isSetupMode || activeTab === 'apikeys') && (
              <section className={isSetupMode ? 'ring-2 ring-primary/30 rounded-lg p-4 -m-4' : ''}>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Key size={14} className="text-primary" />
                  API Keys Configuration
                  {isSetupMode && <span className="text-xs text-primary font-normal">(Required)</span>}
                </h3>

                {isSetupMode && requiredTechConfigs.length > 0 && (
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
              </section>
            )}

            {/* Deployment Tab */}
            {!isSetupMode && activeTab === 'deployment' && (
              <section>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Rocket size={14} className="text-primary" />
                  Deployment
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleToggleNetlify}
                    className="w-full flex items-center justify-between p-3 bg-dark-bg/30 border border-dark-border/50 hover:border-dark-border rounded-lg transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded flex items-center justify-center bg-dark-bg/50">
                        <img
                          src="/src/assets/images/netlify.svg"
                          alt="Netlify"
                          className="w-5 h-5"
                          style={{
                            filter: netlifyConnected ? 'none' : 'grayscale(100%) brightness(0.5)'
                          }}
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-medium text-white">Netlify</p>
                        <p className="text-[10px] text-gray-500">
                          {netlifyConnected ? 'Connected' : 'Not connected'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded ${
                      netlifyConnected
                        ? 'bg-primary/20 text-primary'
                        : 'bg-gray-700/50 text-gray-500'
                    }`}>
                      {netlifyConnected ? 'Connected' : 'Connect'}
                    </span>
                  </button>
                </div>
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
                Cancel
              </button>
            )}
            <button
              onClick={async () => {
                if (isSetupMode && onSetupComplete) {
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
                } else {
                  toast.success('Settings saved', 'Your changes have been applied')
                  onClose()
                }
              }}
              disabled={(isSetupMode && !isSetupComplete) || isInstallingDeps}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                (isSetupMode && !isSetupComplete) || isInstallingDeps
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  : isSetupMode
                  ? 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'
                  : 'bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20'
              }`}
            >
              {isInstallingDeps ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block mr-2" />
                  Installing Dependencies...
                </>
              ) : isSetupMode ? 'Complete Setup' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative w-[450px] bg-dark-card border border-red-500/30 rounded-xl shadow-2xl p-5 overflow-hidden">
            {/* Background Image */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            <div className="flex items-start gap-3 mb-4 relative z-10">
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
                Type <span className="font-mono text-white">{projectId}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={projectId}
                className="w-full bg-dark-bg/50 border border-dark-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-red-500/50 transition-all"
              />
            </div>

            <div className="flex gap-2 relative z-10">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                }}
                className="flex-1 px-4 py-2 bg-dark-bg/50 hover:bg-dark-bg text-gray-300 text-sm font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={deleteConfirmation !== projectId}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  deleteConfirmation === projectId
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                }`}
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ProjectSettings
