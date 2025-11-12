import { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Folder,
  Clock,
  Star,
  MoreVertical,
  Trash2,
  Edit3,
  ExternalLink,
  Settings,
  Globe
} from 'lucide-react'
import TechIcon from './TechIcon'
import { Project, Template } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'

interface ProjectSelectorProps {
  isOpen: boolean
  currentProjectId: string
  onClose: () => void
  onSelectProject: (projectId: string) => void
  onCreateProject: () => void
  onProjectUpdated?: () => void
}

// Extended project type with UI-specific fields
interface ProjectWithMeta extends Project {
  isFavorite?: boolean
  techStack?: string[]
  isDeployed?: boolean
  deploymentUrl?: string
}

function ProjectSelector({
  isOpen,
  currentProjectId,
  onClose,
  onSelectProject,
  onCreateProject,
  onProjectUpdated,
}: ProjectSelectorProps) {
  const { isAuthenticated, currentProjectId: appCurrentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState } = useLayoutStore()
  const toast = useToast()
  const [projects, setProjects] = useState<ProjectWithMeta[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null)
  const [deletingProject, setDeletingProject] = useState<ProjectWithMeta | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleMenuOpen = (projectId: string, buttonRect: DOMRect) => {
    setMenuPosition({
      top: buttonRect.bottom + 4,
      right: window.innerWidth - buttonRect.right
    })
    setActiveMenu(projectId)
  }

  const handleMenuClose = () => {
    setActiveMenu(null)
    setMenuPosition(null)
  }

  // Handle freeze frame when project selector opens/closes
  useEffect(() => {
    const activeProjectId = currentProjectId || appCurrentProjectId

    const handleFreezeFrame = async () => {
      if (isOpen && activeProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(activeProjectId)
          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(activeProjectId)
          }
        }
      } else {
        // Closing project selector - deactivate freeze frame
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (activeProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(activeProjectId)
        }
      }
    }

    handleFreezeFrame()
  }, [isOpen, currentProjectId, appCurrentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  // Fetch projects and templates from database
  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return

      try {
        setLoading(true)
        setError(null)

        // Fetch projects and templates in parallel
        const [projectsResult, templatesResult] = await Promise.all([
          window.electronAPI?.projects.getAll(),
          window.electronAPI?.templates.fetch()
        ])

        if (projectsResult?.success && projectsResult.projects) {
          // Map template tech stacks to projects
          const projectsWithTech = projectsResult.projects.map(project => {
            const template = templatesResult?.templates?.find(t => t.id === project.templateId)
            return {
              ...project,
              techStack: template?.techStack || [],
              isDeployed: false, // TODO: Check deployment status
              deploymentUrl: undefined
            }
          })
          setProjects(projectsWithTech)
          setTemplates(templatesResult?.templates || [])
        } else {
          setError(projectsResult?.error || 'Failed to fetch projects')
        }
      } catch (err) {
        console.error('Error fetching projects:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isOpen, isAuthenticated])

  useEffect(() => {
    if (!isOpen) {
      setActiveMenu(null)
    }
  }, [isOpen])

  const favoriteProjects = projects.filter((p) => p.isFavorite)
  const recentProjects = projects.filter((p) => !p.isFavorite)

  const formatLastAccessed = (timestamp: number | null) => {
    if (!timestamp) return 'Never'

    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const toggleFavorite = async (projectId: string) => {
    try {
      const result = await window.electronAPI?.projects.toggleFavorite(projectId)
      if (result?.success) {
        // Update local state with the new favorite status
        setProjects(projects.map(p =>
          p.id === projectId ? { ...p, isFavorite: result.isFavorite || false } : p
        ))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const handleDeleteStart = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    setDeletingProject(project)
    setDeleteConfirmName('')
    setActiveMenu(null)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return

    setIsDeleting(true)

    // Optimistically remove from UI
    const projectToDelete = deletingProject
    const previousProjects = projects

    setProjects(projects.filter(p => p.id !== deletingProject.id))
    setDeletingProject(null)
    setDeleteConfirmName('')

    try {
      const result = await window.electronAPI?.projects.delete(projectToDelete.id)

      if (result?.success) {
        toast.success('Project deleted', `"${projectToDelete.name}" has been deleted successfully`)

        // Notify parent to refresh
        onProjectUpdated?.()

        // Close modal after successful deletion
        onClose()
      } else {
        // Revert optimistic update on error
        setProjects(previousProjects)
        toast.error('Delete failed', result?.error || 'Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      // Revert optimistic update on error
      setProjects(previousProjects)
      toast.error('Error', error instanceof Error ? error.message : 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleRename = async (projectId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const result = await window.electronAPI?.projects.rename(projectId, newName.trim())
      if (result?.success && result.project) {
        // Update local state
        setProjects(projects.map(p =>
          p.id === projectId ? { ...p, name: result.project!.name, path: result.project!.path } : p
        ))

        // Notify parent to refresh
        onProjectUpdated?.()
      } else if (result && 'reason' in result && result.reason === 'claude_active') {
        // RACE-2 FIX: Show error when trying to rename while Claude is working
        toast.warning(
          'Cannot rename project',
          'Claude is currently working on this project. Please wait for Claude to complete or stop the session first.'
        )
      } else if (result?.error) {
        toast.error('Rename failed', result.error)
      }
    } catch (error) {
      console.error('Error renaming project:', error)
      toast.error('Error', error instanceof Error ? error.message : 'Failed to rename project')
    }
  }

  const handleShowInFinder = async (projectId: string) => {
    try {
      await window.electronAPI?.projects.showInFinder(projectId)
      setActiveMenu(null)
    } catch (error) {
      console.error('Error showing in Finder:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[520px] max-h-[70vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50 relative z-10">
          <div>
            <h2 className="text-sm font-semibold text-white">Projects</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-140px)] overflow-x-visible relative z-10">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-blue border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-gray-400">Loading projects...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-xs text-red-400 mb-2">Failed to load projects</p>
              <p className="text-[10px] text-gray-500 text-center">{error}</p>
            </div>
          )}

          {/* Empty State - No Projects */}
          {!loading && !error && projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <p className="text-xs text-gray-500">No projects in database</p>
            </div>
          )}

          {/* Projects List */}
          {!loading && !error && projects.length > 0 && (
            <>
              {/* Favorites Section */}
              {favoriteProjects.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={12} className="text-yellow-500 fill-yellow-500" />
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Favorites
                </h3>
              </div>
              <div className="space-y-1">
                {favoriteProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    isActive={project.id === currentProjectId}
                    isEditing={editingProjectId === project.id}
                    onSelect={() => onSelectProject(project.id)}
                    onToggleFavorite={() => toggleFavorite(project.id)}
                    formatLastAccessed={formatLastAccessed}
                    activeMenu={activeMenu}
                    onMenuOpen={handleMenuOpen}
                    onMenuClose={handleMenuClose}
                    onDelete={handleDeleteStart}
                    onRename={handleRename}
                    onShowInFinder={handleShowInFinder}
                    onStartRename={() => setEditingProjectId(project.id)}
                    onCancelRename={() => setEditingProjectId(null)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Separator between Favorites and Your Projects */}
          {favoriteProjects.length > 0 && recentProjects.length > 0 && (
            <div className="px-4">
              <div className="border-t border-dark-border/50"></div>
            </div>
          )}

          {/* All Projects Section */}
          {recentProjects.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Folder size={12} className="text-gray-500" />
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Your Projects
                </h3>
              </div>
              <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                {recentProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    isActive={project.id === currentProjectId}
                    isEditing={editingProjectId === project.id}
                    onSelect={() => onSelectProject(project.id)}
                    onToggleFavorite={() => toggleFavorite(project.id)}
                    formatLastAccessed={formatLastAccessed}
                    activeMenu={activeMenu}
                    onMenuOpen={handleMenuOpen}
                    onMenuClose={handleMenuClose}
                    onDelete={handleDeleteStart}
                    onRename={handleRename}
                    onShowInFinder={handleShowInFinder}
                    onStartRename={() => setEditingProjectId(project.id)}
                    onCancelRename={() => setEditingProjectId(null)}
                  />
                ))}
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-border/50 bg-dark-bg/20 relative z-10">
          <button
            onClick={onCreateProject}
            className="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>

      {/* Project Row Menu - rendered with fixed positioning */}
      {activeMenu && (
        <ProjectRowMenu
          project={projects.find(p => p.id === activeMenu)!}
          isOpen={true}
          position={menuPosition}
          onClose={handleMenuClose}
          onStartRename={() => {
            setEditingProjectId(activeMenu)
          }}
          onShowInFinder={() => {
            handleShowInFinder(activeMenu)
          }}
          onDelete={() => {
            handleDeleteStart(activeMenu)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingProject && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setDeletingProject(null)
              setDeleteConfirmName('')
            }}
          />
          <div className="relative w-[420px] bg-dark-card border border-dark-border rounded-xl shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Project</h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently delete <span className="text-white font-medium">"{deletingProject.name}"</span> and remove the project folder from your computer. This action cannot be undone.
            </p>
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-2 block">
                Type <span className="text-white font-medium">{deletingProject.name}</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirmName === deletingProject.name) {
                    handleDeleteConfirm()
                  }
                  if (e.key === 'Escape') {
                    setDeletingProject(null)
                    setDeleteConfirmName('')
                  }
                }}
                className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm focus:outline-none focus:border-red-500 transition-colors"
                placeholder={deletingProject.name}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setDeletingProject(null)
                  setDeleteConfirmName('')
                }}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-dark-bg hover:bg-dark-bg/70 text-gray-300 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmName !== deletingProject.name || isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
    </div>
  )
}

interface ProjectRowProps {
  project: ProjectWithMeta
  isActive: boolean
  isEditing: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  formatLastAccessed: (timestamp: number | null) => string
  activeMenu: string | null
  onMenuOpen: (projectId: string, buttonRect: DOMRect) => void
  onMenuClose: () => void
  onDelete: (projectId: string) => void
  onRename: (projectId: string, newName: string) => void
  onShowInFinder: (projectId: string) => void
  onStartRename: (projectId: string) => void
  onCancelRename: () => void
}

function ProjectRow({
  project,
  isActive,
  isEditing,
  onSelect,
  onToggleFavorite,
  formatLastAccessed,
  activeMenu,
  onMenuOpen,
  onMenuClose,
  onDelete,
  onRename,
  onShowInFinder,
  onStartRename,
  onCancelRename,
}: ProjectRowProps) {
  const [editValue, setEditValue] = useState(project.name)

  return (
    <div
      className={`relative group rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'border-primary/60 bg-primary/5'
          : 'border-transparent hover:border-dark-border hover:bg-dark-bg/30'
      }`}
      onClick={!isEditing ? onSelect : undefined}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    if (editValue.trim() && editValue !== project.name) {
                      onRename(project.id, editValue.trim())
                    }
                    onCancelRename()
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setEditValue(project.name)
                    onCancelRename()
                  }
                }}
                onBlur={() => {
                  if (editValue.trim() && editValue !== project.name) {
                    onRename(project.id, editValue.trim())
                  } else {
                    setEditValue(project.name)
                  }
                  onCancelRename()
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] font-medium text-white bg-dark-bg border border-primary rounded px-2 py-0.5 focus:outline-none"
                autoFocus
              />
            ) : (
              <h4 className="text-[13px] font-medium text-white truncate">{project.name}</h4>
            )}
            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
            )}
            {/* Deployment Badge */}
            {project.isDeployed && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 border border-primary/30 rounded text-[10px] text-primary font-medium flex-shrink-0">
                <Globe size={9} />
                <span>Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {/* Tech Stack Icons */}
            <div className="flex items-center gap-1.5">
              {project.techStack && project.techStack.length > 0 ? (
                project.techStack.map((tech) => (
                  <TechIcon key={tech} name={tech} />
                ))
              ) : (
                <span className="text-[10px] text-gray-400">No tech stack</span>
              )}
            </div>
            <span className="text-[11px] text-gray-400">•</span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">
              {formatLastAccessed(project.lastOpenedAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleFavorite()
            }}
            className="p-1 hover:bg-dark-card rounded transition-all"
          >
            <Star
              size={12}
              className={`transition-all ${
                project.isFavorite
                  ? 'text-yellow-500 fill-yellow-500'
                  : 'text-gray-500'
              }`}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (activeMenu === project.id) {
                onMenuClose()
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                onMenuOpen(project.id, rect)
              }
            }}
            className="p-1 hover:bg-dark-card rounded transition-all"
          >
            <MoreVertical size={12} className="text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Dropdown menu rendered as a portal outside the scrollable container
function ProjectRowMenu({
  project,
  isOpen,
  position,
  onClose,
  onStartRename,
  onShowInFinder,
  onDelete,
}: {
  project: ProjectWithMeta
  isOpen: boolean
  position: { top: number; right: number } | null
  onClose: () => void
  onStartRename: () => void
  onShowInFinder: () => void
  onDelete: () => void
}) {
  if (!isOpen || !position) return null

  return (
    <>
      {/* Invisible overlay to close menu */}
      <div
        className="fixed inset-0 z-[150]"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
      />
      {/* Menu */}
      <div
        className="fixed w-44 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden z-[200]"
        style={{ top: position.top, right: position.right }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Open project settings
            onClose()
          }}
          className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
        >
          <Settings size={12} />
          Project Settings
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onStartRename()
            onClose()
          }}
          className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
        >
          <Edit3 size={12} />
          Rename
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowInFinder()
            onClose()
          }}
          className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors"
        >
          <ExternalLink size={12} />
          Show in Finder
        </button>
        <div className="border-t border-dark-border" />
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
            onClose()
          }}
          className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </>
  )
}

export default ProjectSelector
