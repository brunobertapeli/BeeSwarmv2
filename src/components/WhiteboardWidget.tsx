import { useState, useRef, useEffect } from 'react'
import { X, PenTool } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null

function WhiteboardWidget() {
  const {
    whiteboardWidgetPosition,
    setWhiteboardWidgetPosition,
    whiteboardWidgetSize,
    setWhiteboardWidgetSize,
    setWhiteboardWidgetEnabled,
    whiteboardWidgetZIndex,
    bringWidgetToFront
  } = useLayoutStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)

  const MIN_WIDTH = 400
  const MAX_WIDTH = 1600
  const MIN_HEIGHT = 300
  const MAX_HEIGHT = 1000

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
            <PenTool className="w-4 h-4 text-purple-400" />
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

      {/* Content area - empty placeholder */}
      <div className="relative flex flex-col items-center justify-center h-[calc(100%-37px)] text-gray-500">
        <PenTool className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Whiteboard coming soon...</p>
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

export default WhiteboardWidget
