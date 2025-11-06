import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'
import ActionBar from './ActionBar'
import ProjectHeader from './ProjectHeader'
import ProjectSelector from './ProjectSelector'
import TemplateSelector from './TemplateSelector'
import { ProjectCreationWizard } from './ProjectCreationWizard'
import ProjectSettings from './ProjectSettings'
import TerminalModal from './TerminalModal'
import DeviceFrame from './DeviceFrame'
import DesktopPreviewFrame from './DesktopPreviewFrame'
import DeviceSelector from './DeviceSelector'
import HelpChat from './HelpChat'
import { Project, ProcessState, ProcessOutput, Template } from '../types/electron'

function ProjectView() {
  const {
    isAuthenticated,
    currentProjectId,
    setCurrentProject,
    showProjectSelector,
    setShowProjectSelector,
    showTemplateSelector,
    setShowTemplateSelector,
    showProjectSettings,
    setShowProjectSettings,
    showTerminal,
    setShowTerminal,
    isProjectSetupMode,
    setProjectSetupMode,
    newProjectData,
    setNewProjectData,
    netlifyConnected,
    viewMode,
    selectedDevice,
    setSelectedDevice,
    orientation,
    toggleOrientation,
  } = useAppStore()

  const toast = useToast()
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'apikeys' | 'deployment'>('general')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreationWizard, setShowCreationWizard] = useState(false)
  const [wizardProjectName, setWizardProjectName] = useState('')
  const [wizardTemplate, setWizardTemplate] = useState<Template | null>(null)

  // Dev server and preview state
  const [serverStatus, setServerStatus] = useState<ProcessState>('stopped')
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<ProcessOutput[]>([])
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // Fetch projects and auto-open last project
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true)
        const result = await window.electronAPI?.projects.getAll()

        if (result?.success && result.projects) {
          setProjects(result.projects)

          // Auto-open the last project (most recent lastOpenedAt)
          if (result.projects.length > 0 && !currentProjectId) {
            const lastProject = result.projects[0] // Already sorted by lastOpenedAt DESC
            setCurrentProject(lastProject.id)
          }
        }
      } catch (error) {
        console.error('Error fetching projects:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [refreshKey, isAuthenticated])

  const currentProject = projects.find((p) => p.id === currentProjectId)

  // Define startDevServer at component level so it's accessible throughout
  const startDevServer = useCallback(async () => {
    if (!currentProject) return

    try {
      // Reset state when switching projects
      setServerPort(null)
      setServerStatus('starting')
      setPreviewReady(false)
      setTerminalOutput([])

      // Create terminal session for this project
      await window.electronAPI?.terminal.createSession(currentProject.id)

      // NOTE: Claude session will be started on first message (lazy initialization)
      // This prevents blocking the input field on project load

      // Check if server is already running for this project
      const statusResult = await window.electronAPI?.process.getStatus(currentProject.id)
      if (statusResult?.success && statusResult.status === 'running' && statusResult.port) {
        setServerPort(statusResult.port)
        setServerStatus('running')
        return
      }

      // Check if dependencies are installed
      if (!currentProject.dependenciesInstalled) {
        toast.info('Installing dependencies...', 'This may take a few minutes')
        const installResult = await window.electronAPI?.projects.installDependencies(currentProject.id)
        if (!installResult?.success) {
          console.error('Failed to install dependencies:', installResult?.error)
          setServerStatus('error')
          toast.error('Installation failed', installResult?.error || 'Could not install dependencies')
          return
        }

        // Refresh project data to get updated dependenciesInstalled flag
        const updatedProject = await window.electronAPI?.projects.getById(currentProject.id)
        if (updatedProject?.success && updatedProject.project) {
          // Update local projects list with new data
          setProjects(prev => prev.map(p =>
            p.id === currentProject.id ? updatedProject.project! : p
          ))
        }

        toast.success('Dependencies installed!', 'Starting dev server...')
      }

      // Start the dev server
      const result = await window.electronAPI?.process.startDevServer(currentProject.id)
      if (result?.success && result.port) {
        setServerPort(result.port)
        // Don't show toast - server ready will show one
      } else {
        console.error('Failed to start dev server:', result?.error)
        setServerStatus('error')
        toast.error('Server failed to start', result?.error || 'Could not start dev server')
      }
    } catch (error) {
      console.error('Error starting dev server:', error)
      setServerStatus('error')
      toast.error('Error', 'Failed to start project')
    }
  }, [currentProject, toast])

  // Start dev server and setup preview when project loads
  useEffect(() => {
    if (!currentProject) return

    startDevServer()

    // Setup process event listeners
    const unsubStatusChanged = window.electronAPI?.process.onStatusChanged((projectId, status) => {
      if (projectId === currentProject.id) {
        setServerStatus(status)
      }
    })

    const unsubOutput = window.electronAPI?.process.onOutput((projectId, output) => {
      if (projectId === currentProject.id) {
        setTerminalOutput(prev => [...prev, output])
      }
    })

    const unsubReady = window.electronAPI?.process.onReady((projectId, port) => {
      if (projectId === currentProject.id) {
        setServerPort(port)
        toast.success('Dev server ready!', `Running on http://localhost:${port}`)
      }
    })

    const unsubError = window.electronAPI?.process.onError((projectId, error) => {
      if (projectId === currentProject.id) {
        // Errors are already logged to terminal output, no need for toast
        console.error('[Process Error]:', error)
      }
    })

    // Cleanup on unmount or project change
    return () => {
      unsubStatusChanged?.()
      unsubOutput?.()
      unsubReady?.()
      unsubError?.()

      // Destroy terminal and Claude sessions when switching projects or unmounting
      if (currentProject) {
        window.electronAPI?.terminal.destroySession(currentProject.id)
        window.electronAPI?.claude.destroySession(currentProject.id)
      }
    }
  }, [currentProject?.id])

  // Determine project name for header
  const getProjectName = () => {
    if (loading) {
      return 'Loading...'
    }
    if (currentProject) {
      return currentProject.name
    }
    return 'Untitled Project'
  }

  const handleChatClick = () => {
    toast.info('Starting conversation...', 'Claude is ready to help you build!')
  }

  const handleImagesClick = () => {
    toast.info('Image manager', 'Opening image management modal...')
  }

  const handleConsoleClick = () => {
    setShowTerminal(true)
  }

  const handleSettingsClick = () => {
    // If Netlify not connected, open to deployment tab
    if (!netlifyConnected) {
      setSettingsInitialTab('deployment')
    } else {
      setSettingsInitialTab('general')
    }
    setShowProjectSettings(true)
  }

  const handleSetupComplete = () => {
    // Mark setup as complete
    setProjectSetupMode(false)
    setNewProjectData(null)
    setShowProjectSettings(false)
    toast.success('Setup complete!', 'Your project is ready to use')
  }

  const handleSelectProject = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)

    // Update lastOpenedAt in database
    await window.electronAPI?.projects.updateLastOpened(projectId)

    setCurrentProject(projectId)
    setShowProjectSelector(false)
    if (project) {
      toast.success('Project switched', `Now viewing ${project.name}`)
    }
  }

  const handleCreateProject = () => {
    setShowProjectSelector(false)
    setShowTemplateSelector(true)
  }

  const handleCreateFromTemplate = (template: Template, projectName: string) => {
    // Close template selector and open wizard
    setShowTemplateSelector(false)
    setWizardProjectName(projectName)
    setWizardTemplate(template)
    setShowCreationWizard(true)
  }

  const handleWizardComplete = async () => {
    // Wizard is complete - refresh projects and open the new project
    setShowCreationWizard(false)
    setRefreshKey(prev => prev + 1)

    // Wait for refresh then find and open the new project
    setTimeout(async () => {
      const result = await window.electronAPI?.projects.getAll()
      if (result?.success) {
        const newProject = result.projects.find(
          (p: any) => p.name.toLowerCase() === wizardProjectName.toLowerCase()
        )
        if (newProject) {
          setCurrentProject(newProject.id)
        }
      }
    }, 500)
  }

  const handleWizardCancel = () => {
    setShowCreationWizard(false)
    setWizardProjectName('')
    setWizardTemplate(null)
  }

  const handleRefresh = () => {
    // Trigger iframe reload by updating its src
    const iframe = document.querySelector('iframe[title="Mobile Preview"]') as HTMLIFrameElement
    if (iframe && iframe.src) {
      iframe.src = iframe.src
    }
  }

  return (
    <div className="w-full h-screen relative flex flex-col pt-12 bg-gradient-to-br from-purple-950 via-blue-950 to-black">
      {/* Project Header - Fixed */}
      <ProjectHeader
        projectName={getProjectName()}
        onOpenProjectSelector={() => setShowProjectSelector(true)}
      />

      {/* Project Selector Modal */}
      <ProjectSelector
        isOpen={showProjectSelector}
        currentProjectId={currentProjectId || '1'}
        onClose={() => setShowProjectSelector(false)}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onProjectUpdated={() => setRefreshKey(prev => prev + 1)}
      />

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onCreateProject={handleCreateFromTemplate}
      />

      {/* Project Creation Wizard */}
      {wizardTemplate && (
        <ProjectCreationWizard
          isOpen={showCreationWizard}
          projectName={wizardProjectName}
          template={wizardTemplate}
          onComplete={handleWizardComplete}
          onCancel={handleWizardCancel}
        />
      )}

      {/* Preview Area - Desktop or Mobile Mode */}
      <div className="w-full flex-1 relative overflow-hidden">
        {loading ? (
          // Loading State
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-blue-950 to-black" />
            <div className="absolute inset-0 bg-black/40" />

            {/* Dot Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(139, 92, 246, 0.5) 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
            />

            <div className="text-center relative z-10">
              <div className="w-16 h-16 mx-auto mb-4">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
              </div>
              <p className="text-gray-300 text-lg">Loading your projects...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          // No Projects State
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-blue-950 to-black" />
            <div className="absolute inset-0 bg-black/40" />

            {/* Dot Pattern Overlay */}
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle, rgba(139, 92, 246, 0.5) 1px, transparent 1px)`,
                backgroundSize: "24px 24px",
              }}
            />

            <div className="text-center relative z-10">
              <div className="w-32 h-32 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No Projects Yet</h2>
              <p className="text-gray-400 mb-8">Create your first project to get started</p>
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 flex items-center gap-2 mx-auto"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Create Project
              </button>
            </div>
          </div>
        ) : viewMode === 'desktop' ? (
          // Desktop Mode: Browser frame with scaled preview
          <DesktopPreviewFrame port={serverPort || undefined}>
              {serverPort && serverStatus === 'running' ? (
                <iframe
                  key={`${currentProject?.id}-${serverPort}`}
                  src={`http://localhost:${serverPort}`}
                  className="w-full h-full border-0 bg-white"
                  title="Desktop Preview"
                  onLoad={() => setPreviewReady(true)}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center">
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 8L16 24L32 40L48 24L32 8Z" fill="url(#grad1)" opacity="0.9"/>
                        <path d="M32 28L20 40L32 52L44 40L32 28Z" fill="url(#grad2)" opacity="0.7"/>
                        <defs>
                          <linearGradient id="grad1" x1="16" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981"/>
                            <stop offset="1" stopColor="#059669"/>
                          </linearGradient>
                          <linearGradient id="grad2" x1="20" y1="28" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981"/>
                            <stop offset="1" stopColor="#8B5CF6"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Project Preview</h2>
                    <p className="text-gray-600">
                      {serverStatus === 'starting' && 'Starting dev server...'}
                      {serverStatus === 'running' && !previewReady && 'Loading preview...'}
                      {serverStatus === 'error' && 'Error starting server. Check console for details.'}
                      {serverStatus === 'crashed' && 'Server crashed. Check console for details.'}
                      {serverStatus === 'stopped' && 'Server stopped'}
                    </p>
                    {(serverStatus === 'starting' || (serverStatus === 'running' && !previewReady)) && (
                      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span>{serverStatus === 'starting' ? 'Starting servers...' : 'Loading preview...'}</span>
                      </div>
                    )}
                    {(serverStatus === 'error' || serverStatus === 'crashed') && (
                      <div className="mt-8">
                        <button
                          onClick={startDevServer}
                          className="px-6 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DesktopPreviewFrame>
        ) : (
          // Mobile Mode: Device frame with phone silhouette
          <div className="w-full h-full animate-fadeIn">
            <DeviceFrame device={selectedDevice} orientation={orientation}>
              {/* Preview content inside the device frame */}
              {serverPort && serverStatus === 'running' ? (
                <iframe
                  key={`${currentProject?.id}-${serverPort}`}
                  src={`http://localhost:${serverPort}`}
                  className="w-full h-full border-0 bg-white"
                  title="Mobile Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 8L16 24L32 40L48 24L32 8Z" fill="url(#grad1)" opacity="0.9"/>
                        <path d="M32 28L20 40L32 52L44 40L32 28Z" fill="url(#grad2)" opacity="0.7"/>
                        <defs>
                          <linearGradient id="grad1" x1="16" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981"/>
                            <stop offset="1" stopColor="#059669"/>
                          </linearGradient>
                          <linearGradient id="grad2" x1="20" y1="28" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981"/>
                            <stop offset="1" stopColor="#8B5CF6"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Your Project Preview</h2>
                    <p className="text-sm text-gray-600">
                      {serverStatus === 'starting' && 'Starting servers...'}
                      {serverStatus === 'stopped' && 'Server stopped'}
                      {serverStatus === 'error' && 'Error starting server'}
                    </p>
                    {serverStatus === 'starting' && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                        <span>Loading...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DeviceFrame>
          </div>
        )}

        {/* Device Selector - Only for mobile mode */}
        {viewMode === 'mobile' && (
          <DeviceSelector
            viewMode={viewMode}
            selectedDevice={selectedDevice}
            orientation={orientation}
            onSelectDevice={setSelectedDevice}
            onToggleOrientation={toggleOrientation}
            onRefresh={handleRefresh}
          />
        )}
      </div>

      {/* Floating Action Bar */}
      <ActionBar
        projectId={currentProjectId || undefined}
        onChatClick={handleChatClick}
        onImagesClick={handleImagesClick}
        onSettingsClick={handleSettingsClick}
        onConsoleClick={handleConsoleClick}
      />

      {/* Help Chat */}
      <HelpChat projectId={currentProjectId || undefined} />

      {/* Project Settings Modal */}
      <ProjectSettings
        isOpen={showProjectSettings}
        onClose={() => {
          // Only allow closing if not in setup mode
          if (!isProjectSetupMode) {
            setShowProjectSettings(false)
          }
        }}
        projectName={currentProject?.name || 'Untitled Project'}
        projectId={currentProjectId || '1'}
        projectPath="~/Documents/CodeDeck/Projects/ecommerce-dashboard"
        isSetupMode={isProjectSetupMode}
        requiredTechConfigs={newProjectData?.requiredTechConfigs || []}
        onSetupComplete={handleSetupComplete}
        initialTab={settingsInitialTab}
      />

      {/* Terminal Modal */}
      {currentProject && (
        <TerminalModal
          isOpen={showTerminal}
          onClose={() => setShowTerminal(false)}
          onStop={() => {
            window.electronAPI?.process.stopDevServer(currentProject.id)
            toast.info('Stopping dev server...')
          }}
          projectId={currentProject.id}
          projectName={currentProject.name}
        />
      )}
    </div>
  )
}

export default ProjectView
