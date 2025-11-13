import { useState, useRef, useEffect } from 'react'
import { X, Palette, Type } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'

interface StickyNoteWidgetProps {
  note: {
    id: string
    position: { x: number; y: number }
    content: string
    color: 'yellow' | 'orange' | 'pink' | 'blue' | 'green'
    stickyText: boolean
    zIndex: number
  }
}

// Color definitions matching the old implementation
const COLORS = {
  yellow: { bg: '#f9e79f', text: '#2c2400', hoverBg: '#f7d96b' },
  orange: { bg: '#f8c9b4', text: '#402306', hoverBg: '#f5b28e' },
  pink: { bg: '#f4b6c2', text: '#30121b', hoverBg: '#ef8fa4' },
  blue: { bg: '#a0c8f8', text: '#0e1c2a', hoverBg: '#86b7f6' },
  green: { bg: '#bce4be', text: '#1d2b12', hoverBg: '#9bd69d' }
}

const STICKY_FONT = "'Kalam', cursive"
const REGULAR_FONT = 'inherit'

// Fixed size for sticky note (no resizing)
const NOTE_SIZE = 180 // px

function StickyNoteWidget({ note }: StickyNoteWidgetProps) {
  const { updateStickyNote, removeStickyNote, bringNoteToFront } = useLayoutStore()
  const [isDragging, setIsDragging] = useState(false)
  const [localContent, setLocalContent] = useState(note.content)

  const noteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mouseStartPos = useRef({ x: 0, y: 0 })
  const noteStartPos = useRef({ x: 0, y: 0 })
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastPosition = useRef(note.position)

  const selectedColor = COLORS[note.color]

  // Update local content when note prop changes
  useEffect(() => {
    setLocalContent(note.content)
  }, [note.content])

  // Handle mouse down on header (start drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from header, not from buttons
    const target = e.target as HTMLElement
    if (target.closest('button')) return

    // Bring to front when interacting
    bringNoteToFront(note.id)

    setIsDragging(true)
    mouseStartPos.current = { x: e.clientX, y: e.clientY }
    noteStartPos.current = { ...note.position }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.classList.add('select-none') // Prevent text selection
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!noteRef.current) return

    const dx = e.clientX - mouseStartPos.current.x
    const dy = e.clientY - mouseStartPos.current.y

    // Convert percentage position to pixels for boundary calculation
    const containerWidth = window.innerWidth
    const containerHeight = window.innerHeight
    const currentPixelX = noteStartPos.current.x * containerWidth
    const currentPixelY = noteStartPos.current.y * containerHeight

    // Calculate new pixel position
    const newPixelX = currentPixelX + dx
    const newPixelY = currentPixelY + dy

    // Apply boundaries (same as KanbanWidget)
    const padding = 3
    const headerHeight = 40 + padding // Top header bar height + padding (43px)
    const bottomReservedArea = 187 // Action bar + Research Agent
    const minX = padding
    const maxX = containerWidth - NOTE_SIZE - padding
    const minY = headerHeight
    const maxY = containerHeight - NOTE_SIZE - bottomReservedArea - padding

    const clampedPixelX = Math.max(minX, Math.min(newPixelX, maxX))
    const clampedPixelY = Math.max(minY, Math.min(newPixelY, maxY))

    // Convert back to percentage (0-1)
    const clampedX = clampedPixelX / containerWidth
    const clampedY = clampedPixelY / containerHeight

    lastPosition.current = { x: clampedX, y: clampedY }

    // Update position directly in store for smooth dragging
    updateStickyNote(note.id, { position: { x: clampedX, y: clampedY } })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
    document.body.classList.remove('select-none')

    // Final position save
    updateStickyNote(note.id, { position: lastPosition.current })
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setLocalContent(newContent)

    // Debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      updateStickyNote(note.id, { content: newContent })
    }, 500)
  }

  const handleColorCycle = () => {
    const colors: Array<'yellow' | 'orange' | 'pink' | 'blue' | 'green'> = ['yellow', 'orange', 'pink', 'blue', 'green']
    const currentIndex = colors.indexOf(note.color)
    const nextColor = colors[(currentIndex + 1) % colors.length]
    updateStickyNote(note.id, { color: nextColor })
  }

  const handleStyleToggle = () => {
    updateStickyNote(note.id, { stickyText: !note.stickyText })
  }

  const handleDelete = () => {
    removeStickyNote(note.id)
  }

  return (
    <div
      ref={noteRef}
      className="fixed"
      onClick={() => bringNoteToFront(note.id)}
      style={{
        left: `${note.position.x * 100}%`,
        top: `${note.position.y * 100}%`,
        width: `${NOTE_SIZE}px`,
        height: `${NOTE_SIZE}px`,
        zIndex: note.zIndex,
        backgroundColor: selectedColor.bg,
        color: selectedColor.text,
        borderRadius: '16px',
        boxShadow: isDragging
          ? '0 10px 30px rgba(0, 0, 0, 0.3)'
          : '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease-in-out',
        cursor: isDragging ? 'grabbing' : 'default',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: '32px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          cursor: 'grab'
        }}
      >
        <div style={{ width: '24px' }} />
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleStyleToggle}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: 0.7,
              transition: 'opacity 0.2s, background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title="Toggle text style"
          >
            <Type size={14} color={selectedColor.text} />
          </button>
          <button
            onClick={handleColorCycle}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: 0.7,
              transition: 'opacity 0.2s, background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title="Change color"
          >
            <Palette size={14} color={selectedColor.text} />
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              opacity: 0.7,
              transition: 'opacity 0.2s, background 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            title="Delete note"
          >
            <X size={14} color={selectedColor.text} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div
        style={{ flex: 1, padding: '8px', overflow: 'hidden' }}
        onClick={() => bringNoteToFront(note.id)}
      >
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleContentChange}
          onClick={() => bringNoteToFront(note.id)}
          onMouseDown={(e) => {
            e.stopPropagation() // Prevent dragging when interacting with textarea
            bringNoteToFront(note.id)
          }}
          placeholder="Type your note here..."
          style={{
            width: '100%',
            height: '100%',
            resize: 'none',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: selectedColor.text,
            fontFamily: note.stickyText ? STICKY_FONT : REGULAR_FONT,
            fontSize: note.stickyText ? '16px' : '12px',
            padding: note.stickyText ? '12px' : '8px',
            textAlign: note.stickyText ? 'center' : 'left',
            display: note.stickyText ? 'flex' : 'block',
            alignItems: note.stickyText ? 'center' : 'initial',
            justifyContent: note.stickyText ? 'center' : 'initial',
            overflow: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        />
      </div>
    </div>
  )
}

export default StickyNoteWidget
