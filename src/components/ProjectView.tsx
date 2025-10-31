import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'
import ActionBar from './ActionBar'
import ProjectHeader from './ProjectHeader'
import ProjectSelector from './ProjectSelector'
import TemplateSelector from './TemplateSelector'
import ProjectSettings from './ProjectSettings'
import TerminalModal from './TerminalModal'
import DeviceFrame from './DeviceFrame'
import DeviceSelector from './DeviceSelector'

// Mock projects data
const MOCK_PROJECTS = [
  { id: '1', name: 'E-commerce Dashboard', isDeployed: true },
  { id: '2', name: 'SaaS Landing Page', isDeployed: false },
  { id: '3', name: 'Portfolio Website', isDeployed: true },
  { id: '4', name: 'Blog Platform', isDeployed: false },
]

function ProjectView() {
  const {
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

  const currentProject = MOCK_PROJECTS.find((p) => p.id === currentProjectId)

  const handleChatClick = () => {
    toast.info('Starting conversation...', 'Claude is ready to help you build!')
    console.log('Chat clicked')
  }

  const handleImagesClick = () => {
    toast.info('Image manager', 'Opening image management modal...')
    console.log('Images clicked')
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
    console.log('Project setup completed!')
  }

  const handleSelectProject = (projectId: string) => {
    const project = MOCK_PROJECTS.find((p) => p.id === projectId)
    setCurrentProject(projectId)
    setShowProjectSelector(false)
    toast.success('Project switched', `Now viewing ${project?.name}`)
    console.log('Switched to project:', projectId)
  }

  const handleCreateProject = () => {
    setShowProjectSelector(false)
    setShowTemplateSelector(true)
  }

  const handleCreateFromTemplate = (templateId: string, projectName: string) => {
    toast.success('Project created!', `${projectName} is being set up...`)
    console.log('Creating project from template:', templateId, projectName)
    // TODO: Implement actual project creation logic
    // For now, just close the template selector
    setShowTemplateSelector(false)
    // In future, this will create the project and switch to it
  }

  return (
    <div className="w-full h-full relative">
      {/* Project Header */}
      <ProjectHeader
        projectName={currentProject?.name || 'Untitled Project'}
        onOpenProjectSelector={() => setShowProjectSelector(true)}
      />

      {/* Project Selector Modal */}
      <ProjectSelector
        isOpen={showProjectSelector}
        currentProjectId={currentProjectId || '1'}
        onClose={() => setShowProjectSelector(false)}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
      />

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onCreateProject={handleCreateFromTemplate}
      />

      {/* Preview Area - Desktop or Mobile Mode */}
      <div className="w-full h-full relative">
        {viewMode === 'desktop' ? (
          // Desktop Mode: Full screen preview
          <div className="w-full h-full bg-gradient-to-br from-gray-900 via-dark-bg to-gray-900 flex items-center justify-center transition-all duration-500 animate-fadeIn">
            {/* Placeholder content */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30 flex items-center justify-center">
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
              <h2 className="text-2xl font-bold text-white mb-2">Your Project Preview</h2>
              <p className="text-gray-400">Your live app will appear here</p>
              <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                <span>Servers starting...</span>
              </div>
            </div>
          </div>
        ) : (
          // Mobile Mode: Device frame with phone silhouette
          <div className="w-full h-full animate-fadeIn">
            <DeviceFrame device={selectedDevice} orientation={orientation}>
              {/* Preview content inside the device frame */}
              <div className="w-full h-full bg-white flex items-center justify-center overflow-auto">
              {/* Placeholder content - scaled for mobile */}
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
                <p className="text-sm text-gray-600">Your live app will appear here</p>
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                  <span>Servers starting...</span>
                </div>
              </div>
            </div>
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
          />
        )}
      </div>

      {/* Floating Action Bar */}
      <ActionBar
        onChatClick={handleChatClick}
        onImagesClick={handleImagesClick}
        onSettingsClick={handleSettingsClick}
        onConsoleClick={handleConsoleClick}
      />

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
        projectPath="~/Documents/BeeSwarm/Projects/ecommerce-dashboard"
        isSetupMode={isProjectSetupMode}
        requiredTechConfigs={newProjectData?.requiredTechConfigs || []}
        onSetupComplete={handleSetupComplete}
        initialTab={settingsInitialTab}
      />

      {/* Terminal Modal */}
      <TerminalModal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
        onStop={() => {
          // Stop Claude generation
          console.log('Stopping Claude...')
        }}
      />
    </div>
  )
}

export default ProjectView
