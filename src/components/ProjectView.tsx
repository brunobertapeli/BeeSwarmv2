import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'
import { useWebsiteImport } from '../hooks/useWebsiteImport'
import ActionBar from './ActionBar'
import ResearchAgent from './ResearchAgent'
import ResearchAgentStatusSheet from './ResearchAgentStatusSheet'
import ProjectSelector from './ProjectSelector'
import UserProfile from './UserProfile'
import { ProjectCreationFlow } from './ProjectCreationFlow'
import ProjectSettings from './ProjectSettings'
import TerminalModal from './TerminalModal'
import DesktopPreviewFrame from './DesktopPreviewFrame'
import MobilePreviewFrame from './MobilePreviewFrame'
import HelpChat from './HelpChat'
import KanbanWidget from './KanbanWidget'
import StickyNoteWidget from './StickyNoteWidget'
import AnalyticsWidget from './AnalyticsWidget'
import ProjectAssetsWidget from './ProjectAssetsWidget'
import { ModalPortal } from './ModalPortal'
import { Project, ProcessState, ProcessOutput } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'
import mainShapeImage from '../assets/images/main_shape.png'
import noiseBgImage from '../assets/images/noise_bg.png'

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
    showStatusSheet,
    isProjectSetupMode,
    setProjectSetupMode,
    newProjectData,
    setNewProjectData,
    netlifyConnected,
    viewMode,
    selectedDevice,
    setSelectedDevice,
  } = useAppStore()

  const { setModalFreezeActive, setModalFreezeImage, layoutState, kanbanEnabled, loadKanbanState, stickyNotes, loadStickyNotesState, analyticsWidgetEnabled, loadAnalyticsWidgetState, projectAssetsWidgetEnabled, loadProjectAssetsWidgetState } = useLayoutStore()
  const toast = useToast()
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'environment' | 'deployment'>('general')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreationFlow, setShowCreationFlow] = useState(false)
  const [showUserProfileModal, setShowUserProfileModal] = useState(false)
  const [showHelpChat, setShowHelpChat] = useState(false)
  const [helpChatFreezeReady, setHelpChatFreezeReady] = useState(false)
  const [researchAgentStatusExpanded, setResearchAgentStatusExpanded] = useState(false)

  // Dev server and preview state
  const [serverStatus, setServerStatus] = useState<ProcessState>('stopped')
  const [serverPort, setServerPort] = useState<number | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<ProcessOutput[]>([])
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const researchAgentRef = useRef<HTMLDivElement>(null)

  // Website import state
  const websiteImport = useWebsiteImport(currentProjectId)
  const [websiteImportPrompt, setWebsiteImportPrompt] = useState<string | undefined>(undefined)

  // Fetch projects and auto-open last project
  useEffect(() => {
    let isCancelled = false

    const fetchProjects = async () => {
      try {
        setLoading(true)
        const result = await window.electronAPI?.projects.getAll()

        if (isCancelled) return

        if (result?.success && result.projects) {
          setProjects(result.projects)

          // Auto-open the last project (most recent lastOpenedAt)
          if (result.projects.length > 0 && !currentProjectId) {
            const lastProject = result.projects[0] // Already sorted by lastOpenedAt DESC
            await window.electronAPI?.process.setCurrentProject(lastProject.id)
            if (!isCancelled) {
              setCurrentProject(lastProject.id)
            }
          }
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Error fetching projects:', error)
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    fetchProjects()

    return () => {
      isCancelled = true
    }
  }, [refreshKey, isAuthenticated])

  const currentProject = projects.find((p) => p.id === currentProjectId)

  // Handle device emulation based on viewMode
  useEffect(() => {
    if (!currentProjectId) {
      return
    }

    const applyDeviceEmulation = async () => {
      // Sync view mode with LayoutManager
      await window.electronAPI?.layout.setViewMode(viewMode)

      if (viewMode === 'mobile' && selectedDevice) {
        await window.electronAPI?.preview.enableDeviceEmulation(currentProjectId, selectedDevice.name)
      } else if (viewMode === 'desktop') {
        await window.electronAPI?.preview.disableDeviceEmulation(currentProjectId)
      }
    }

    applyDeviceEmulation()
  }, [viewMode, selectedDevice, currentProjectId])

  // Load Kanban widget state when project changes
  useEffect(() => {
    if (currentProjectId) {
      loadKanbanState(currentProjectId)
      loadStickyNotesState(currentProjectId)
      loadAnalyticsWidgetState(currentProjectId)
      loadProjectAssetsWidgetState(currentProjectId)
    }
  }, [currentProjectId, loadKanbanState, loadStickyNotesState, loadAnalyticsWidgetState, loadProjectAssetsWidgetState])

  // Handle freeze frame when UserProfile opens/closes
  useEffect(() => {
    let isCancelled = false

    const handleFreezeFrame = async () => {
      if (showUserProfileModal && currentProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(currentProjectId)

          if (isCancelled) return

          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(currentProjectId)
          }
        }
      } else {
        // Closing UserProfile - deactivate freeze frame
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (currentProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(currentProjectId)
        }
      }
    }

    handleFreezeFrame()

    return () => {
      isCancelled = true
    }
  }, [showUserProfileModal, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  // Handle freeze frame when HelpChat opens/closes
  useEffect(() => {
    let isCancelled = false

    const handleFreezeFrame = async () => {
      if (showHelpChat && currentProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(currentProjectId)

          if (isCancelled) return

          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(currentProjectId)
            setHelpChatFreezeReady(true)
          }
        } else {
          // Not in DEFAULT state, show immediately
          setHelpChatFreezeReady(true)
        }
      } else {
        // Closing HelpChat - deactivate freeze frame
        setHelpChatFreezeReady(false)
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (currentProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(currentProjectId)
        }
      }
    }

    handleFreezeFrame()

    return () => {
      isCancelled = true
    }
  }, [showHelpChat, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  // Handle website import - auto-send prompt
  useEffect(() => {
    // Only run when we detect a first-time website import
    // The .migration-completed flag (checked via isFirstOpen) ensures this only runs once
    if (websiteImport.isWebsiteImport && websiteImport.isFirstOpen && currentProjectId) {
      // Generate the appropriate prompt based on import type
      let prompt = ''
      const manifestPath = '/website-import/manifest.json'
      const imagesPath = '/website-import/images'

      switch (websiteImport.importType) {
        case 'template':
          prompt = `I want to migrate all content from my old website into this codebase while preserving the current template's design and structure.

My old website's data is located at: ${manifestPath} (contains all text content, sections, navigation, and footer data)
Images from my old website are at: ${imagesPath}

Please analyze the manifest.json to understand my content, then integrate it into the current template, use bash command to transfer the images from the old website to this codebase, replacing placeholder content while maintaining the template's design patterns and component structure.`
          break

        case 'screenshot':
          prompt = `I want to create a new website using my old website's content and a design inspired by a screenshot I provided.

- Design reference: Look for user-design-screenshot.* in the project root (use this as design inspiration)
- Content data: ${manifestPath} (contains all text, sections, navigation)
- Images: ${imagesPath}

Please create a website that matches the design aesthetic from the screenshot while incorporating all the content from my old website. Use bash command to transfer the images from the old website to this codebase`
          break

        case 'ai':
          prompt = `I want you to create a modern, sleek website using content from my old website.

- Content data: ${manifestPath} (analyze this to understand my website's purpose, industry, and content)
- Images: ${imagesPath}

Please read the manifest to understand what my website is about, then create an appropriate theme, color palette, and design style that fits my use case. Make it modern and professional. Use bash command to transfer the images from the old website to this codebase`
          break
      }

      setWebsiteImportPrompt(prompt)
    }

    // Clean up state when switching projects
    return () => {
      setWebsiteImportPrompt(undefined)
    }
  }, [websiteImport.isWebsiteImport, websiteImport.isFirstOpen, websiteImport.importType, currentProjectId])

  // Handle marking migration as complete when auto-message is sent
  const handleWebsiteImportPromptSent = useCallback(async () => {
    try {
      await websiteImport.markMigrationComplete()
      setWebsiteImportPrompt(undefined) // Clear the prompt so it doesn't send again
    } catch (error) {
      console.error('⭐ [WEBSITE IMPORT] Failed to mark migration complete:', error)
    }
  }, [websiteImport, currentProjectId])

  // Define startDevServer at component level so it's accessible throughout
  const startDevServer = useCallback(async () => {
    if (!currentProject) return

    try {
      // Create terminal session for this project
      await window.electronAPI?.terminal.createSession(currentProject.id)

      // NOTE: Claude session will be started on first message (lazy initialization)
      // This prevents blocking the input field on project load

      // Check if server is already running for this project FIRST
      // This prevents unnecessary "Starting server..." flash when switching back
      const statusResult = await window.electronAPI?.process.getStatus(currentProject.id)
      if (statusResult?.success && statusResult.status === 'running' && statusResult.port) {
        // Server already running - preserve existing state
        setServerPort(statusResult.port)
        setServerStatus('running')
        setPreviewReady(false) // Preview needs to be recreated
        return
      }

      // Server not running - reset state for fresh start
      setServerPort(null)
      setServerStatus('starting')
      setPreviewReady(false)
      setTerminalOutput([])

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

    // Setup preview console listener (for BrowserView console.log capture)
    const unsubConsole = window.electronAPI?.preview.onConsole?.((projectId, message) => {
      if (projectId === currentProject.id) {
        // Log frontend console messages to our console
        // TODO: Feed to Claude for debugging loop
        // You can add logic here to automatically send errors to Claude
        // if (message.level === 2) { // Error level
        //   window.electronAPI?.claude.sendPrompt(
        //     currentProject.id,
        //     `Frontend error detected: ${message.message} at ${message.sourceId}:${message.line}`,
        //     'haiku',
        //     [],
        //     false,
        //     false
        //   )
        // }
      }
    })

    // Cleanup on unmount or project change
    return () => {
      unsubStatusChanged?.()
      unsubOutput?.()
      unsubReady?.()
      unsubError?.()
      unsubConsole?.()

      // Keep all background processes running (Claude, dev servers, terminals)
      // Each project runs independently with isolated paths and ports
    }
  }, [currentProject?.id])

  // Listen for Tab key for layout cycling (local keyboard handler)
  useEffect(() => {
    if (!currentProject?.id) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Tab - Cycle layout state
      if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        window.electronAPI?.layout.cycleState(currentProject.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentProject?.id])

  // NEW: Listen for layout state changes from Electron
  useEffect(() => {
    const unsubscribe = window.electronAPI?.layout.onStateChanged?.((newState, previousState) => {
      useLayoutStore.getState().setLayoutState(newState)
    })

    return unsubscribe
  }, [])

  // Determine project name for header
  const getProjectName = () => {
    if (loading) {
      return 'Loading...'
    }
    if (currentProject) {
      return currentProject.name
    }
    return ''
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

  const handleOpenSettings = (tab: 'general' | 'environment' | 'deployment') => {
    setSettingsInitialTab(tab)
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

    // Set as current project in ProcessManager to prevent accidental server stops
    await window.electronAPI?.process.setCurrentProject(projectId)

    // Ensure layout state is reset to DEFAULT for new project
    await window.electronAPI?.layout.setState('DEFAULT', projectId)
    useLayoutStore.getState().setLayoutState('DEFAULT')

    setCurrentProject(projectId)
    setShowProjectSelector(false)
    if (project) {
      toast.success('Project switched', `Now viewing ${project.name}`)
    }
  }

  const handleCreateProject = () => {
    setShowProjectSelector(false)
    setShowCreationFlow(true)
  }

  const handleCreationFlowComplete = async (newProjectId?: string) => {
    // Creation flow is complete - refresh projects and close
    setShowCreationFlow(false)
    setRefreshKey(prev => prev + 1)

    // If we received the new project ID, switch to it immediately
    if (newProjectId) {
      await window.electronAPI?.process.setCurrentProject(newProjectId)
      setCurrentProject(newProjectId)
    }
  }

  const handleCreationFlowCancel = () => {
    setShowCreationFlow(false)
  }

  // Debug: Log all clicks in workspace mode
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (layoutState === 'TOOLS') {
        // Handle workspace clicks if needed
      }
    }

    document.addEventListener('click', handleGlobalClick, true)
    return () => document.removeEventListener('click', handleGlobalClick, true)
  }, [layoutState])

  return (
    <div className="w-full h-screen relative flex flex-col bg-[#0A0020] overflow-hidden">
      {/* Fixed shape background - Behind all content */}
      <div
        className="fixed left-0 top-0 w-full h-full pointer-events-none opacity-60"
        style={{
          backgroundImage: `url(${mainShapeImage})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          zIndex: 0
        }}
      />

      {/* Noise texture overlay - Behind all content */}
      <div
        className="fixed left-0 top-0 w-full h-full opacity-70 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'soft-light',
          zIndex: 1
        }}
      />

      {/* Top Header Bar */}
      <div className="fixed top-0 left-0 right-0 h-[40px] z-[99] border-b border-gray-700/50 bg-gray-800/50 flex items-center justify-center relative overflow-hidden" style={{ WebkitAppRegion: 'drag' } as any}>
        {/* Background image with low opacity */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Unified Control - Project Name + View Switcher */}
        {projects.length > 0 && (
          <div
            className="flex items-center bg-dark-card/95 backdrop-blur-xl border border-gray-700/60 rounded-lg relative z-10 mt-[3px] overflow-hidden"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            {/* Project Name */}
            <button
              onClick={() => setShowProjectSelector(true)}
              className="px-4 py-1.5 flex items-center gap-2 group hover:bg-dark-bg/30 transition-all border-r border-gray-700/50"
            >
              <span className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">{getProjectName()}</span>
              <ChevronDown size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
            </button>

            {/* View Switcher */}
            <div className="flex items-center p-0.5">
              <button
                onClick={() => {
                  if (currentProject?.id) {
                    window.electronAPI?.layout.setState('DEFAULT', currentProject.id)
                  }
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${layoutState === 'DEFAULT'
                    ? 'bg-primary/20 text-primary'
                    : 'text-gray-400 hover:text-gray-300'
                  }`}
              >
                Browser View
              </button>
              <button
                onClick={() => {
                  if (currentProject?.id) {
                    window.electronAPI?.layout.setState('TOOLS', currentProject.id)
                  }
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-medium transition-all ${layoutState === 'TOOLS'
                    ? 'bg-primary/20 text-primary'
                    : 'text-gray-400 hover:text-gray-300'
                  }`}
              >
                Workspace
              </button>
            </div>
          </div>
        )}

        {/* Settings Icon - Absolute Right Side, Vertically Centered */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowUserProfileModal(!showUserProfileModal)
          }}
          data-settings-button
          className="absolute right-4 p-1.5 hover:bg-dark-bg/50 rounded-lg transition-colors z-10 mt-[3px]"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <Settings size={16} className="text-gray-400 hover:text-white transition-colors" />
        </button>
      </div>

      {/* User Profile Modal */}
      {showUserProfileModal && (
        <ModalPortal>
          <div className="fixed top-[48px] right-2 z-[300]">
            <UserProfile
              onClose={() => setShowUserProfileModal(false)}
              excludeElement="[data-settings-button]"
              onOpenHelp={() => setShowHelpChat(true)}
            />
          </div>
        </ModalPortal>
      )}

      {/* Project Selector Modal */}
      <ProjectSelector
        isOpen={showProjectSelector}
        currentProjectId={currentProjectId || '1'}
        onClose={() => setShowProjectSelector(false)}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onProjectUpdated={() => setRefreshKey(prev => prev + 1)}
      />

      {/* Project Creation Flow */}
      <ProjectCreationFlow
        isOpen={showCreationFlow}
        onComplete={handleCreationFlowComplete}
        onCancel={handleCreationFlowCancel}
      />

      {/* Preview Area - Desktop or Mobile Mode */}
      <div
        className={`w-full relative overflow-hidden p-[5px] ${projects.length > 0 ? 'border-b border-gray-700/50' : ''} z-[101] ${layoutState === 'TOOLS' ? 'pointer-events-none' : ''
          }`}
        style={{ height: 'calc(100vh - 40px - 200px)' }}
      >
        {loading ? (
          // Loading State
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center relative z-10">
              <div className="spinner">
                <div className="rect1" />
                <div className="rect2" />
                <div className="rect3" />
                <div className="rect4" />
                <div className="rect5" />
              </div>
              <p className="banner-subtitle mt-8" style={{ marginBottom: '0' }}>Loading your projects...</p>
            </div>
          </div>
        ) : projects.length === 0 ? (
          // No Projects State
          <div className="absolute inset-0 flex items-center justify-center pt-[33.33vh]">
            <div className="text-center relative z-10 max-w-4xl mx-auto px-8">
              <h2 className="banner-title">No Projects Yet</h2>
              <p className="banner-subtitle">Create your first project to get started</p>

              <button
                onClick={handleCreateProject}
                className="gradient-btn gradient-btn-two"
              >
                Create Project
              </button>
            </div>
          </div>
        ) : viewMode === 'mobile' ? (
          // Mobile Mode: Use MobilePreviewFrame with device emulation
          <div className="w-full h-full">
            <MobilePreviewFrame
              port={serverPort || undefined}
              projectId={currentProject?.id}
            />
          </div>
        ) : (
          // Desktop Mode: Use DesktopPreviewFrame
          <div className="w-full h-full">
            <DesktopPreviewFrame
              port={serverPort || undefined}
              projectId={currentProject?.id}
              useBrowserView={true}
            >
              {!(serverPort && serverStatus === 'running') && (
                <div className="w-full h-full bg-white flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center">
                      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M32 8L16 24L32 40L48 24L32 8Z" fill="url(#grad1)" opacity="0.9" />
                        <path d="M32 28L20 40L32 52L44 40L32 28Z" fill="url(#grad2)" opacity="0.7" />
                        <defs>
                          <linearGradient id="grad1" x1="16" y1="8" x2="48" y2="40" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981" />
                            <stop offset="1" stopColor="#059669" />
                          </linearGradient>
                          <linearGradient id="grad2" x1="20" y1="28" x2="44" y2="52" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#10B981" />
                            <stop offset="1" stopColor="#8B5CF6" />
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
                          className="px-6 py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-lg transition-colors font-medium"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* )} END OF IFRAME FALLBACK COMMENT */}
            </DesktopPreviewFrame>
          </div>
        )}
      </div>

      {/* Bottom Section - Split into AI Agents (left 40%) and Action Bar (right 60%) */}
      {projects.length > 0 && currentProject && (
        <div className="fixed bottom-0 left-0 right-0 h-[200px] flex border-t border-gray-700/50 pt-[2px] z-[102]">
          {/* Left Section: AI Agents Block */}
          <div className="w-[40%] h-full border-r border-gray-700/50 relative">
            {/* Research Agent Status Sheet */}
            <ResearchAgentStatusSheet
              projectId={currentProjectId || undefined}
              researchAgentRef={researchAgentRef}
              isExpanded={researchAgentStatusExpanded}
              onToggleExpand={() => setResearchAgentStatusExpanded(!researchAgentStatusExpanded)}
            />

            {/* Research Agent */}
            <ResearchAgent
              ref={researchAgentRef}
              projectId={currentProjectId || undefined}
              onStatusClick={() => setResearchAgentStatusExpanded(!researchAgentStatusExpanded)}
            />
          </div>

          {/* Right Section: Action Bar Block */}
          <div className="w-[60%] h-full relative">
            {/* Action Bar */}
            <ActionBar
              projectId={currentProjectId || undefined}
              onChatClick={handleChatClick}
              onImagesClick={handleImagesClick}
              onSettingsClick={handleSettingsClick}
              onOpenSettings={handleOpenSettings}
              onConsoleClick={handleConsoleClick}
              autoOpen={websiteImport.isWebsiteImport && websiteImport.isFirstOpen}
              autoPinned={websiteImport.isWebsiteImport && websiteImport.isFirstOpen}
              autoMessage={websiteImportPrompt}
              onAutoMessageSent={handleWebsiteImportPromptSent}
              onRefreshEnvCount={() => {}}
            />
          </div>
        </div>
      )}

      {/* Kanban Widget */}
      {kanbanEnabled && layoutState === 'TOOLS' && <KanbanWidget />}

      {/* Analytics Widget */}
      {analyticsWidgetEnabled && layoutState === 'TOOLS' && <AnalyticsWidget />}

      {/* Project Assets Widget */}
      {projectAssetsWidgetEnabled && layoutState === 'TOOLS' && <ProjectAssetsWidget />}

      {/* Sticky Notes */}
      {layoutState === 'TOOLS' && stickyNotes.map((note) => (
        <StickyNoteWidget key={note.id} note={note} />
      ))}

      {/* Help Chat */}
      <HelpChat
        projectId={currentProjectId || undefined}
        isOpen={showHelpChat && helpChatFreezeReady}
        onClose={() => setShowHelpChat(false)}
      />

      {/* Project Settings Modal */}
      <ProjectSettings
        isOpen={showProjectSettings}
        onClose={() => {
          // Only allow closing if not in setup mode
          if (!isProjectSetupMode) {
            setShowProjectSettings(false)
            // Refresh env count in ActionBar after settings close
            if ((window as any).__refreshEnvCountForActionBar) {
              (window as any).__refreshEnvCountForActionBar()
            }
          }
        }}
        projectName={currentProject?.name || 'Untitled Project'}
        projectId={currentProjectId || '1'}
        projectPath={currentProject?.path || ''}
        isSetupMode={isProjectSetupMode}
        requiredTechConfigs={newProjectData?.requiredTechConfigs || []}
        onSetupComplete={handleSetupComplete}
        initialTab={settingsInitialTab}
        onProjectUpdated={() => setRefreshKey(prev => prev + 1)}
        onSelectProject={handleSelectProject}
        deployServices={currentProject?.deployServices || null}
      />

      {/* Terminal Modal */}
      {currentProject && (
        <TerminalModal
          isOpen={showTerminal}
          onClose={() => setShowTerminal(false)}
          projectId={currentProject.id}
          projectName={currentProject.name}
          projectPath={currentProject.path}
        />
      )}
    </div>
  )
}

export default ProjectView
