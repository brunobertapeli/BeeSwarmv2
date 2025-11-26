import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import bgImage from '../assets/images/bg.jpg'
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

function WhiteboardWidget() {
  const {
    whiteboardWidgetPosition,
    setWhiteboardWidgetPosition,
    whiteboardWidgetSize,
    setWhiteboardWidgetSize,
    setWhiteboardWidgetEnabled,
    whiteboardWidgetZIndex,
    bringWidgetToFront,
    whiteboardData,
    setWhiteboardData,
    loadWhiteboardData
  } = useLayoutStore()

  const { currentProjectId } = useAppStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })
  const [isLoaded, setIsLoaded] = useState(false)

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastElementsCountRef = useRef<number>(0)

  const MIN_WIDTH = 400
  const MAX_WIDTH = 1600
  const MIN_HEIGHT = 300
  const MAX_HEIGHT = 1000

  // Load whiteboard data when project changes
  useEffect(() => {
    if (currentProjectId) {
      setIsLoaded(false)
      loadWhiteboardData(currentProjectId).then(() => {
        setIsLoaded(true)
      })
    }
  }, [currentProjectId, loadWhiteboardData])

  // Handle Excalidraw changes - debounced to prevent infinite loops
  const handleChange = (elements: readonly any[], appState: any, files: any) => {
    // Skip if not loaded yet
    if (!isLoaded) return

    // Only save when elements actually change (not on every appState change)
    const nonDeletedElements = elements.filter((el: any) => !el.isDeleted)
    if (nonDeletedElements.length === 0 && lastElementsCountRef.current === 0) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounce saves to prevent rapid updates
    saveTimeoutRef.current = setTimeout(() => {
      lastElementsCountRef.current = nonDeletedElements.length

      // Filter appState to only keep necessary properties
      const filteredAppState = {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemStrokeColor: appState.currentItemStrokeColor,
        currentItemBackgroundColor: appState.currentItemBackgroundColor,
        currentItemFillStyle: appState.currentItemFillStyle,
        currentItemStrokeWidth: appState.currentItemStrokeWidth,
        currentItemRoughness: appState.currentItemRoughness,
        currentItemOpacity: appState.currentItemOpacity,
        currentItemFontFamily: appState.currentItemFontFamily,
        currentItemFontSize: appState.currentItemFontSize,
        currentItemTextAlign: appState.currentItemTextAlign,
        currentItemStartArrowhead: appState.currentItemStartArrowhead,
        currentItemEndArrowhead: appState.currentItemEndArrowhead,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
        gridSize: appState.gridSize
      }
      setWhiteboardData({ elements: [...nonDeletedElements], appState: filteredAppState, files })
    }, 300)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: whiteboardWidgetSize.width,
      height: whiteboardWidgetSize.height,
      posX: whiteboardWidgetPosition.x,
      posY: whiteboardWidgetPosition.y
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the header
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - whiteboardWidgetPosition.x,
      y: e.clientY - whiteboardWidgetPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Keep widget within viewport bounds with 5px padding on all sides
        const padding = 5
        const headerHeight = 40 + padding
        const bottomReservedArea = 200 + 2
        const minX = padding
        const maxX = window.innerWidth - whiteboardWidgetSize.width - padding
        const minY = headerHeight
        const maxY = window.innerHeight - whiteboardWidgetSize.height - bottomReservedArea - padding

        setWhiteboardWidgetPosition({
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

        setWhiteboardWidgetSize({ width: newWidth, height: newHeight })
        if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
          setWhiteboardWidgetPosition({ x: newX, y: newY })
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
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, whiteboardWidgetPosition, whiteboardWidgetSize, setWhiteboardWidgetPosition, setWhiteboardWidgetSize])

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${whiteboardWidgetPosition.x}px`,
        top: `${whiteboardWidgetPosition.y}px`,
        width: `${whiteboardWidgetSize.width}px`,
        height: `${whiteboardWidgetSize.height}px`,
        zIndex: whiteboardWidgetZIndex
      }}
      onMouseDown={(e) => { bringWidgetToFront('whiteboard'); handleMouseDown(e); }}
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
            <h3 className="text-sm font-semibold text-gray-200">Whiteboard</h3>
          </div>

          <button
            onClick={() => setWhiteboardWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Excalidraw content area */}
      <div
        className="relative excalidraw-wrapper"
        style={{ height: 'calc(100% - 37px)' }}
      >
        {isLoaded && (
          <Excalidraw
            theme="dark"
            initialData={whiteboardData || undefined}
            onChange={handleChange}
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveToActiveFile: false,
                toggleTheme: false
              }
            }}
            handleKeyboardGlobally={false}
          >
            <MainMenu>
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
            </MainMenu>
            <WelcomeScreen>
              <WelcomeScreen.Hints.ToolbarHint />
            </WelcomeScreen>
          </Excalidraw>
        )}

        {/* Powered by Excalidraw - bottom right */}
        <div
          className="absolute bottom-2 right-3 text-xs text-white/30 hover:text-white/60 transition-colors z-10"
          style={{ pointerEvents: 'auto' }}
        >
          Powered by{' '}
          <button
            onClick={() => window.electronAPI?.shell.openExternal('https://github.com/excalidraw/excalidraw')}
            className="underline cursor-pointer hover:text-purple-400 transition-colors"
          >
            Excalidraw
          </button>
        </div>
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

      {/* Custom styles for Excalidraw dark theme to match app */}
      <style>{`
        .excalidraw-wrapper .excalidraw {
          --color-primary: #a855f7;
          --color-primary-darker: #9333ea;
          --color-primary-darkest: #7e22ce;
          --color-primary-light: #c084fc;
        }
        .excalidraw-wrapper .excalidraw.theme--dark {
          --color-primary: #a855f7;
          --color-primary-darker: #9333ea;
          --color-primary-darkest: #7e22ce;
          --color-primary-light: #c084fc;
        }
        /* Hide the help button and dialog completely */
        .excalidraw-wrapper .excalidraw .HelpDialog,
        .excalidraw-wrapper .excalidraw .help-icon,
        .excalidraw-wrapper .excalidraw [class*="HelpButton"],
        .excalidraw-wrapper .excalidraw button[aria-label="Help"] {
          display: none !important;
        }
      `}</style>
    </div>
  )
}

export default WhiteboardWidget
