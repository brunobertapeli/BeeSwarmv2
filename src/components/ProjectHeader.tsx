import UserProfile from './UserProfile'

interface ProjectHeaderProps {
  projectName: string
  onOpenProjectSelector: () => void
}

function ProjectHeader({ projectName, onOpenProjectSelector }: ProjectHeaderProps) {
  return (
    <div className="fixed top-0 left-0 bottom-0 w-[76px] z-[100] border-r border-dark-border/30 border-t border-dark-border/30 bg-dark-bg/95 backdrop-blur-sm flex flex-col" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Bottom Section - User Profile */}
      <div className="mt-auto pb-4 flex items-center justify-center" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <UserProfile />
      </div>
    </div>
  )
}

export default ProjectHeader
