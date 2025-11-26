import { useState, useRef, useEffect, useCallback } from 'react'
import { X, ChevronRight, Search, Info } from 'lucide-react'
import { Icon } from '@iconify/react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import { useToast } from '../hooks/useToast'
import bgImage from '../assets/images/bg.jpg'

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

// Icon library mappings with Iconify prefixes
const ICON_LIBRARIES = [
  {
    key: 'lucide',
    iconifyPrefix: 'lucide',
    names: ['lucide', 'lucide-react'],
    displayName: 'Lucide',
    packageName: 'lucide-react',
    importExample: "import { IconName } from 'lucide-react'",
    iconCount: 1650
  },
  {
    key: 'materialui',
    iconifyPrefix: 'ic',
    names: ['@mui/icons-material', 'materialui', 'material-ui'],
    displayName: 'Material UI',
    packageName: '@mui/icons-material',
    importExample: "import IconName from '@mui/icons-material/IconName'",
    iconCount: 10955
  },
  {
    key: 'heroicons',
    iconifyPrefix: 'heroicons',
    names: ['@heroicons/react', 'heroicons'],
    displayName: 'Heroicons',
    packageName: '@heroicons/react',
    importExample: "import { IconName } from '@heroicons/react/24/outline'",
    iconCount: 1288
  },
  {
    key: 'phosphor',
    iconifyPrefix: 'ph',
    names: ['phosphor-react', '@phosphor-icons/react', 'phosphor'],
    displayName: 'Phosphor',
    packageName: '@phosphor-icons/react',
    importExample: "import { IconName } from '@phosphor-icons/react'",
    iconCount: 9072
  },
  {
    key: 'radix',
    iconifyPrefix: 'radix-icons',
    names: ['@radix-ui/react-icons', 'radix'],
    displayName: 'Radix',
    packageName: '@radix-ui/react-icons',
    importExample: "import { IconName } from '@radix-ui/react-icons'",
    iconCount: 332
  },
]

type IconLibrary = typeof ICON_LIBRARIES[number]

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
  const toast = useToast()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

  // Icon picker state
  const [installedLibraries, setInstalledLibraries] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set())
  const [libraryIcons, setLibraryIcons] = useState<Record<string, string[]>>({})
  const [loadingLibrary, setLoadingLibrary] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<Record<string, string[]>>({})

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const MIN_WIDTH = 300
  const MAX_WIDTH = 700
  const MIN_HEIGHT = 250
  const MAX_HEIGHT = 600

  // Get techStack from local project data
  useEffect(() => {
    const fetchIconLibraries = async () => {
      if (!currentProjectId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const projectResult = await window.electronAPI?.projects.getById(currentProjectId)
        if (!projectResult?.success || !projectResult.project) {
          setLoading(false)
          return
        }

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
            found.push(lib.key)
          }
        }

        setInstalledLibraries(found)

        // Auto-expand installed libraries
        setExpandedLibraries(new Set(found))

        // Fetch icons for installed libraries
        for (const libKey of found) {
          const lib = ICON_LIBRARIES.find(l => l.key === libKey)
          if (lib) {
            fetchLibraryIcons(lib.iconifyPrefix)
          }
        }
      } catch (error) {
        console.error('Failed to fetch icon libraries:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIconLibraries()
  }, [currentProjectId])

  // Fetch icons from Iconify API
  const fetchLibraryIcons = useCallback(async (prefix: string) => {
    if (libraryIcons[prefix]) return // Already loaded

    setLoadingLibrary(prefix)
    try {
      const url = `https://api.iconify.design/collection?prefix=${prefix}`
      const response = await fetch(url)
      const data = await response.json()

      // Get icons from uncategorized or flatten categories
      let icons: string[] = []
      if (data.uncategorized) {
        icons = data.uncategorized
      } else if (data.categories) {
        icons = Object.values(data.categories as Record<string, string[]>).flat()
      }

      setLibraryIcons(prev => ({ ...prev, [prefix]: icons.slice(0, 200) }))
    } catch (error) {
      console.error(`Failed to fetch icons for ${prefix}:`, error)
    } finally {
      setLoadingLibrary(null)
    }
  }, [libraryIcons])

  // Search icons via API - searches ALL libraries
  const searchIcons = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({})
      return
    }

    setLoadingLibrary('searching')
    const results: Record<string, string[]> = {}

    // Search in ALL libraries, not just expanded ones
    const searchPromises = ICON_LIBRARIES.map(async (lib) => {
      try {
        const url = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefix=${lib.iconifyPrefix}&limit=50`
        const response = await fetch(url)
        const data = await response.json()

        if (data.icons && data.icons.length > 0) {
          // Icons come as 'prefix:name', extract just the name
          results[lib.iconifyPrefix] = data.icons.map((icon: string) =>
            icon.includes(':') ? icon.split(':')[1] : icon
          )
        }
      } catch (error) {
        console.error(`Search failed for ${lib.iconifyPrefix}:`, error)
      }
    })

    await Promise.all(searchPromises)
    setSearchResults(results)
    setLoadingLibrary(null)
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchIcons(searchQuery)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, searchIcons])

  // Toggle library expansion
  const toggleLibrary = (key: string) => {
    const lib = ICON_LIBRARIES.find(l => l.key === key)
    if (!lib) return

    setExpandedLibraries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
        // Fetch icons if not loaded
        if (!libraryIcons[lib.iconifyPrefix]) {
          fetchLibraryIcons(lib.iconifyPrefix)
        }
      }
      return newSet
    })
  }

  // Convert kebab-case to PascalCase
  const toPascalCase = (str: string) => {
    return str
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
  }

  // Handle icon click - copy to clipboard
  const handleIconClick = (iconName: string, library: IconLibrary) => {
    const componentName = toPascalCase(iconName)
    const code = `<${componentName} />`
    navigator.clipboard.writeText(code)
    toast.success('Copied!', `<${componentName} />`)
  }

  // Handle badge click for not included libraries - copy install message
  const handleNotIncludedBadgeClick = (e: React.MouseEvent, library: IconLibrary) => {
    e.stopPropagation()
    const message = `Please install the ${library.displayName} icon library (${library.packageName}) in my project.`
    navigator.clipboard.writeText(message)
    toast.success('Copied!', `Install request for ${library.displayName}`)
  }

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

        if (resizeDirection.includes('e')) {
          newWidth = resizeStart.width + deltaX
        }
        if (resizeDirection.includes('w')) {
          newWidth = resizeStart.width - deltaX
          newX = resizeStart.posX + deltaX
        }

        if (resizeDirection.includes('s')) {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection.includes('n')) {
          newHeight = resizeStart.height - deltaY
          newY = resizeStart.posY + deltaY
          newY = Math.max(headerHeight, newY)
        }

        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        if (resizeDirection.includes('w')) {
          newX = resizeStart.posX + (resizeStart.width - newWidth)
        }

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

  // Get icons to display for a library (search results or all icons)
  const getDisplayIcons = (prefix: string) => {
    if (searchQuery.trim()) {
      return searchResults[prefix] || []
    }
    return libraryIcons[prefix] || []
  }

  // Check if library should be shown during search (has results)
  const hasSearchResults = (prefix: string) => {
    if (!searchQuery.trim()) return true
    return (searchResults[prefix]?.length || 0) > 0
  }

  // Get display count for library
  const getDisplayCount = (library: typeof ICON_LIBRARIES[number]) => {
    if (searchQuery.trim()) {
      return searchResults[library.iconifyPrefix]?.length || 0
    }
    return library.iconCount
  }

  const isSearching = searchQuery.trim().length > 0

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

      {/* Search bar */}
      <div className="relative px-3 py-2 border-b border-dark-border/30">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search icons..."
            className="w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg pl-8 pr-24 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
            onMouseDown={(e) => e.stopPropagation()}
          />
          <a
            href="https://github.com/iconify"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 opacity-30 hover:opacity-100 transition-opacity whitespace-nowrap"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault()
              window.electronAPI?.shell.openExternal('https://github.com/iconify')
            }}
          >
            Powered by Iconify
          </a>
        </div>
      </div>

      {/* Content area */}
      <div className="relative h-[calc(100%-85px)] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-dark-border/20">
            {/* Show searching indicator */}
            {loadingLibrary === 'searching' && (
              <div className="flex items-center justify-center py-3 gap-2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Searching...</span>
              </div>
            )}
            {/* No results message */}
            {isSearching && loadingLibrary !== 'searching' &&
              [...ICON_LIBRARIES].filter((lib) => hasSearchResults(lib.iconifyPrefix)).length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-gray-500">No icons found for "{searchQuery}"</p>
              </div>
            )}
            {/* Sort libraries: included first, then not included. Filter out those with no search results */}
            {[...ICON_LIBRARIES]
              .filter((lib) => hasSearchResults(lib.iconifyPrefix))
              .sort((a, b) => {
                const aIncluded = installedLibraries.includes(a.key)
                const bIncluded = installedLibraries.includes(b.key)
                if (aIncluded && !bIncluded) return -1
                if (!aIncluded && bIncluded) return 1
                return 0
              }).map((library) => {
              const isIncluded = installedLibraries.includes(library.key)
              const isExpanded = expandedLibraries.has(library.key)
              const icons = getDisplayIcons(library.iconifyPrefix)
              const displayCount = getDisplayCount(library)
              const isLoadingThis = loadingLibrary === library.iconifyPrefix

              return (
                <div key={library.key}>
                  {/* Library header */}
                  <button
                    onClick={() => toggleLibrary(library.key)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-dark-bg/30 transition-colors"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <span className="text-sm font-medium text-gray-200">{library.displayName}</span>
                      <span className="text-xs text-gray-500">
                        ({isSearching ? displayCount : library.iconCount.toLocaleString()})
                      </span>
                    </div>
                    {isIncluded ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1"
                        title="This icon library is included in your project's template. Click any icon to copy its component name."
                      >
                        Included
                        <Info className="w-3 h-3 opacity-50" />
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 cursor-pointer hover:bg-gray-500/30 transition-colors flex items-center gap-1"
                        title="This library is not included in your project. Click here to copy an installation request you can send to Claude."
                        onClick={(e) => handleNotIncludedBadgeClick(e, library)}
                      >
                        Not Included
                        <Info className="w-3 h-3 opacity-50" />
                      </span>
                    )}
                  </button>

                  {/* Icon grid */}
                  {isExpanded && (
                    <div className="px-2 pb-2">
                      {isLoadingThis ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        </div>
                      ) : icons.length > 0 ? (
                        <div className="grid grid-cols-6 gap-1">
                          {icons.map((iconName) => {
                            const fullIconName = `${library.iconifyPrefix}:${iconName}`
                            return (
                              <button
                                key={iconName}
                                onClick={() => handleIconClick(iconName, library)}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="group flex flex-col items-center p-2 rounded-lg hover:bg-dark-bg/50 transition-colors"
                                title={iconName}
                              >
                                <Icon
                                  icon={fullIconName}
                                  className="w-5 h-5 text-gray-300 group-hover:text-white transition-colors"
                                />
                                <span className="text-[9px] text-gray-500 truncate w-full text-center mt-1 group-hover:text-gray-400">
                                  {iconName.length > 10 ? iconName.slice(0, 10) + '...' : iconName}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : searchQuery.trim() ? (
                        <div className="text-center py-4 text-sm text-gray-500">
                          No icons found for "{searchQuery}"
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-gray-500">
                          No icons loaded
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
