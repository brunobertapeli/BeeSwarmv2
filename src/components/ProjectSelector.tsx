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

interface Project {
  id: string
  name: string
  path: string
  lastAccessed: Date
  isFavorite: boolean
  techStack: string[]
  isDeployed?: boolean
  deploymentUrl?: string
}

interface ProjectSelectorProps {
  isOpen: boolean
  currentProjectId: string
  onClose: () => void
  onSelectProject: (projectId: string) => void
  onCreateProject: () => void
}

// Mock projects with random tech stacks
const mockProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Dashboard',
    path: '~/Documents/BeeSwarm/Projects/ecommerce-dashboard',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 30),
    isFavorite: true,
    techStack: ['react', 'materialui', 'node', 'mongodb', 'stripe'],
    isDeployed: true,
    deploymentUrl: 'https://ecommerce-dash.netlify.app',
  },
  {
    id: '2',
    name: 'SaaS Landing Page',
    path: '~/Documents/BeeSwarm/Projects/saas-landing',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 2),
    isFavorite: true,
    techStack: ['react', 'supabase', 'stripe'],
  },
  {
    id: '3',
    name: 'Portfolio Website',
    path: '~/Documents/BeeSwarm/Projects/portfolio',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 24),
    isFavorite: false,
    techStack: ['react', 'materialui', 'node'],
    isDeployed: true,
    deploymentUrl: 'https://myportfolio.netlify.app',
  },
  {
    id: '4',
    name: 'Blog Platform',
    path: '~/Documents/BeeSwarm/Projects/blog-platform',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    isFavorite: false,
    techStack: ['react', 'node', 'mongodb'],
  },
  {
    id: '5',
    name: 'Task Management App',
    path: '~/Documents/BeeSwarm/Projects/task-manager',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    isFavorite: false,
    techStack: ['react', 'supabase'],
  },
  {
    id: '6',
    name: 'Social Media Dashboard',
    path: '~/Documents/BeeSwarm/Projects/social-dashboard',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    isFavorite: false,
    techStack: ['react', 'node', 'mongodb'],
  },
  {
    id: '7',
    name: 'Weather Forecast App',
    path: '~/Documents/BeeSwarm/Projects/weather-app',
    lastAccessed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
    isFavorite: false,
    techStack: ['react', 'node'],
  },
]

function ProjectSelector({
  isOpen,
  currentProjectId,
  onClose,
  onSelectProject,
  onCreateProject,
}: ProjectSelectorProps) {
  const [projects, setProjects] = useState<Project[]>(mockProjects)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setActiveMenu(null)
    }
  }, [isOpen])

  const favoriteProjects = projects.filter((p) => p.isFavorite)
  const recentProjects = projects.filter((p) => !p.isFavorite)

  const formatLastAccessed = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 1000 / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const toggleFavorite = (projectId: string) => {
    setProjects(projects.map(p =>
      p.id === projectId ? { ...p, isFavorite: !p.isFavorite } : p
    ))
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
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border/50">
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
        <div className="overflow-y-auto max-h-[calc(70vh-140px)]">
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
                    onSelect={() => onSelectProject(project.id)}
                    onToggleFavorite={() => toggleFavorite(project.id)}
                    formatLastAccessed={formatLastAccessed}
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
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
                    onSelect={() => onSelectProject(project.id)}
                    onToggleFavorite={() => toggleFavorite(project.id)}
                    formatLastAccessed={formatLastAccessed}
                    activeMenu={activeMenu}
                    setActiveMenu={setActiveMenu}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-border/50 bg-dark-bg/20">
          <button
            onClick={onCreateProject}
            className="w-full px-3 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProjectRowProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onToggleFavorite: () => void
  formatLastAccessed: (date: Date) => string
  activeMenu: string | null
  setActiveMenu: (id: string | null) => void
}

function ProjectRow({
  project,
  isActive,
  onSelect,
  onToggleFavorite,
  formatLastAccessed,
  activeMenu,
  setActiveMenu,
}: ProjectRowProps) {
  return (
    <div
      className={`relative group rounded-lg border transition-all cursor-pointer ${
        isActive
          ? 'border-primary/60 bg-primary/5'
          : 'border-transparent hover:border-dark-border hover:bg-dark-bg/30'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2.5 px-3 py-2">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-medium text-white truncate">{project.name}</h4>
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
              {project.techStack.map((tech) => (
                <TechIcon key={tech} name={tech} label={tech.charAt(0).toUpperCase() + tech.slice(1)} />
              ))}
            </div>
            <span className="text-[11px] text-gray-600">•</span>
            <span className="text-[11px] text-gray-500 flex-shrink-0">
              {formatLastAccessed(project.lastAccessed)}
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
              setActiveMenu(activeMenu === project.id ? null : project.id)
            }}
            className="p-1 hover:bg-dark-card rounded transition-all relative"
          >
            <MoreVertical size={12} className="text-gray-500" />
            {activeMenu === project.id && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden z-50">
                <button className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors">
                  <Settings size={12} />
                  Project Settings
                </button>
                <button className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors">
                  <Edit3 size={12} />
                  Rename
                </button>
                <button className="w-full px-3 py-2 text-left text-[12px] text-white hover:bg-dark-bg/50 flex items-center gap-2 transition-colors">
                  <ExternalLink size={12} />
                  Show in Finder
                </button>
                <div className="border-t border-dark-border" />
                <button className="w-full px-3 py-2 text-left text-[12px] text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectSelector
