import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import UserProfile from './UserProfile'

interface ProjectHeaderProps {
  projectName: string
  onOpenProjectSelector: () => void
}

function ProjectHeader({ projectName, onOpenProjectSelector }: ProjectHeaderProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] border-b border-dark-border/30 bg-dark-bg/95 backdrop-blur-sm" style={{ WebkitAppRegion: 'drag' } as any}>
      <div className="flex items-center justify-between h-12 pl-20 pr-4">
        {/* Back Arrow and Project Name */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          {/* Back Arrow Button */}
          <button
            className="p-1.5 rounded-md transition-all duration-200 cursor-pointer hover:bg-gray-700/50"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onOpenProjectSelector}
          >
            <ArrowLeft
              size={16}
              className={`transition-colors duration-200 ${
                isHovered ? 'text-white' : 'text-gray-400'
              }`}
            />
          </button>

          {/* Project Name */}
          <span className="text-sm font-medium text-gray-300">
            {projectName}
          </span>
        </div>

        {/* User Profile - Right Side */}
        <div style={{ WebkitAppRegion: 'no-drag' } as any}>
          <UserProfile />
        </div>
      </div>
    </div>
  )
}

export default ProjectHeader
