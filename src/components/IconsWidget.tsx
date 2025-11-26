import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import bgImage from '../assets/images/bg.jpg'

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

// Icon library mappings
const ICON_LIBRARIES = [
  { key: 'lucide', names: ['lucide', 'lucide-react'], displayName: 'Lucide' },
  { key: 'materialui', names: ['@mui/icons-material', 'materialui', 'material-ui'], displayName: 'Material UI' },
  { key: 'heroicons', names: ['@heroicons/react', 'heroicons'], displayName: 'Heroicons' },
  { key: 'phosphor', names: ['phosphor-react', '@phosphor-icons/react', 'phosphor'], displayName: 'Phosphor' },
  { key: 'radix', names: ['@radix-ui/react-icons', 'radix'], displayName: 'Radix' },
]

function IconsWidget() {
  const {
    iconsWidgetPosition,
    setIconsWidgetPosition,
    iconsWidgetSize,
    setIconsWidgetSize,
    setIconsWidgetEnabled,
    iconsWidgetZIndex,
    bringWidgetToFront,
  } = useLayoutStore()

  const { currentProjectId } = useAppStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })
  const [installedIcons, setInstalledIcons] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const MIN_WIDTH = 200
  const MAX_WIDTH = 600
  const MIN_HEIGHT = 150
  const MAX_HEIGHT = 500

  // Get techStack from local project data
  useEffect(() => {
    const fetchIconLibraries = async () => {
      if (!currentProjectId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        // Get project from local database (includes techStack saved at creation time)
        const projectResult = await window.electronAPI?.projects.getById(currentProjectId)
        if (!projectResult?.success || !projectResult.project) {
          setLoading(false)
          return
        }

        // Parse techStack from local project data (saved as JSON string)
        let techStack: string[] = []
        if (projectResult.project.techStack) {
          try {
            techStack = JSON.parse(projectResult.project.techStack)
          } catch {
            techStack = []
          }
        }

        // Find installed icon libraries
        const found: string[] = []
        for (const lib of ICON_LIBRARIES) {
          const isInstalled = techStack.some((tech: string) =>
            lib.names.some(name => tech.toLowerCase().includes(name.toLowerCase()))
          )
          if (isInstalled) {
            found.push(lib.displayName)
          }
        }

        setInstalledIcons(found)
      } catch (error) {
        console.error('Failed to fetch icon libraries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIconLibraries()
  }, [currentProjectId])

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: iconsWidgetSize.width,
      height: iconsWidgetSize.height,
      posX: iconsWidgetPosition.x,
      posY: iconsWidgetPosition.y
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the header
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - iconsWidgetPosition.x,
      y: e.clientY - iconsWidgetPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Keep widget within viewport bounds
        const padding = 5
        const headerHeight = 40 + padding
        const bottomReservedArea = 200 + 2
        const minX = padding
        const maxX = window.innerWidth - iconsWidgetSize.width - padding
        const minY = headerHeight
        const maxY = window.innerHeight - iconsWidgetSize.height - bottomReservedArea - padding

        setIconsWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const padding = 5
        const headerHeight = 40 + padding

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = resizeStart.posX
        let newY = resizeStart.posY

        // Handle horizontal resizing
        if (resizeDirection.includes('e')) {
          newWidth = resizeStart.width + deltaX
        }
        if (resizeDirection.includes('w')) {
          newWidth = resizeStart.width - deltaX
          newX = resizeStart.posX + deltaX
        }

        // Handle vertical resizing
        if (resizeDirection.includes('s')) {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection.includes('n')) {
          newHeight = resizeStart.height - deltaY
          newY = resizeStart.posY + deltaY
          newY = Math.max(headerHeight, newY)
        }

        // Apply constraints
        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        // Adjust position if resizing from west and we hit constraints
        if (resizeDirection.includes('w')) {
          newX = resizeStart.posX + (resizeStart.width - newWidth)
        }

        // Adjust position if resizing from north and we hit constraints
        if (resizeDirection.includes('n')) {
          newY = Math.max(headerHeight, resizeStart.posY + (resizeStart.height - newHeight))
        }

        setIconsWidgetSize({ width: newWidth, height: newHeight })
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
          setIconsWidgetPosition({ x: newX, y: newY })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, iconsWidgetPosition, iconsWidgetSize, setIconsWidgetPosition, setIconsWidgetSize])

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: `${iconsWidgetPosition.x}px`,
        top: `${iconsWidgetPosition.y}px`,
        width: `${iconsWidgetSize.width}px`,
        height: `${iconsWidgetSize.height}px`,
        zIndex: iconsWidgetZIndex
      }}
      onMouseDown={(e) => { bringWidgetToFront('icons'); handleMouseDown(e); }}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 cursor-move select-none"
        style={{ minHeight: '37px', paddingTop: '6px', paddingBottom: '6px' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-200">Icons</h3>
          </div>

          <button
            onClick={() => setIconsWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="relative p-4 h-[calc(100%-37px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : installedIcons.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Your template has <span className="text-purple-400 font-semibold">{installedIcons.length}</span> icon {installedIcons.length === 1 ? 'library' : 'libraries'} installed:
            </p>
            <ul className="space-y-2">
              {installedIcons.map((icon) => (
                <li key={icon} className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  {icon}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-sm text-gray-500">No icon libraries detected in your template's tech stack.</p>
          </div>
        )}
      </div>

      {/* Resize handles - Edges */}
      <div
        className="absolute top-0 left-2 right-2 h-2 cursor-n-resize z-20"
        onMouseDown={(e) => handleResizeStart(e, 'n')}
      />
      <div
        className="absolute bottom-0 left-2 right-2 h-2 cursor-s-resize z-20"
        onMouseDown={(e) => handleResizeStart(e, 's')}
      />
      <div
        className="absolute left-0 top-2 bottom-2 w-2 cursor-w-resize z-20"
        onMouseDown={(e) => handleResizeStart(e, 'w')}
      />
      <div
        className="absolute right-0 top-2 bottom-2 w-2 cursor-e-resize z-20"
        onMouseDown={(e) => handleResizeStart(e, 'e')}
      />

      {/* Resize handles - Corners */}
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-30"
        onMouseDown={(e) => handleResizeStart(e, 'nw')}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-30"
        onMouseDown={(e) => handleResizeStart(e, 'ne')}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-30"
        onMouseDown={(e) => handleResizeStart(e, 'sw')}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-30"
        onMouseDown={(e) => handleResizeStart(e, 'se')}
      />
    </div>
  )
}

export default IconsWidget
