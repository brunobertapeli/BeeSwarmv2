import { useState, useRef, useEffect } from 'react'
import { X, Plus, Trash2, AlignLeft } from 'lucide-react'
import { useLayoutStore, Priority } from '../store/layoutStore'

interface KanbanCard {
  id: string
  title: string
  content: string
  priority: Priority
}

const priorityColors: Record<Priority, string> = {
  'Low': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'High': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Important': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'Critical': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Off track': 'bg-red-500/20 text-red-400 border-red-500/30'
}

const priorities: Priority[] = ['Low', 'Medium', 'High', 'Important', 'Critical', 'Off track']

type ResizeDirection = 's' | 'n' | null

function KanbanWidget() {
  const { kanbanPosition, setKanbanPosition, kanbanSize, setKanbanSize, setKanbanEnabled, kanbanColumns, setKanbanColumns, kanbanZIndex, bringWidgetToFront } = useLayoutStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [editingCard, setEditingCard] = useState<{ columnId: string; cardId: string } | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showCardModal, setShowCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState<{ columnId: string; card: KanbanCard } | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalContent, setModalContent] = useState('')
  const [draggingCard, setDraggingCard] = useState<{ columnId: string; cardId: string } | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ columnId: string; cardId: string | null; position: 'before' | 'after' } | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const MIN_HEIGHT = 400
  const MAX_HEIGHT = 800

  // Use columns from layoutStore with fallback
  const columns = Array.isArray(kanbanColumns) ? kanbanColumns : [
    { id: 'todo', title: 'To Do', cards: [] },
    { id: 'progress', title: 'In Progress', cards: [] },
    { id: 'done', title: 'Done', cards: [] }
  ]

  const cyclePriority = (columnId: string, cardId: string) => {
    setKanbanColumns((cols = []) =>
      cols.map(col => {
        if (col.id !== columnId) return col
        return {
          ...col,
          cards: col.cards.map(card => {
            if (card.id !== cardId) return card
            const currentIndex = priorities.indexOf(card.priority as Priority)
            const nextIndex = (currentIndex + 1) % priorities.length
            return { ...card, priority: priorities[nextIndex] }
          })
        }
      })
    )
  }

  const addCard = (columnId: string) => {
    const newCard: KanbanCard = {
      id: Date.now().toString(),
      title: 'New task',
      content: '',
      priority: 'Medium'
    }

    setKanbanColumns((cols = []) =>
      cols.map(col => {
        if (col.id !== columnId) return col
        return {
          ...col,
          cards: [...col.cards, newCard]
        }
      })
    )

    // Immediately enter edit mode for the new card
    setEditingCard({ columnId, cardId: newCard.id })
    setEditingText(newCard.title)
  }

  const openCardModal = (columnId: string, card: KanbanCard) => {
    setSelectedCard({ columnId, card })
    setModalTitle(card.title)
    setModalContent(card.content)
    setShowCardModal(true)
  }

  const saveCardModal = () => {
    if (!selectedCard) return

    setKanbanColumns((cols = []) =>
      cols.map(col => {
        if (col.id !== selectedCard.columnId) return col
        return {
          ...col,
          cards: col.cards.map(card => {
            if (card.id !== selectedCard.card.id) return card
            return { ...card, title: modalTitle, content: modalContent }
          })
        }
      })
    )

    setShowCardModal(false)
    setSelectedCard(null)
  }

  const closeCardModal = () => {
    setShowCardModal(false)
    setSelectedCard(null)
  }

  const deleteCard = (columnId: string, cardId: string) => {
    setKanbanColumns((cols = []) =>
      cols.map(col => {
        if (col.id !== columnId) return col
        return {
          ...col,
          cards: col.cards.filter(card => card.id !== cardId)
        }
      })
    )
  }

  const saveEdit = () => {
    if (!editingCard) return

    const trimmedText = editingText.trim()
    if (!trimmedText) {
      // If empty, delete the card
      deleteCard(editingCard.columnId, editingCard.cardId)
    } else {
      // Update the card title
      setKanbanColumns((cols = []) =>
        cols.map(col => {
          if (col.id !== editingCard.columnId) return col
          return {
            ...col,
            cards: col.cards.map(card => {
              if (card.id !== editingCard.cardId) return card
              return { ...card, title: trimmedText }
            })
          }
        })
      )
    }

    setEditingCard(null)
    setEditingText('')
  }

  const cancelEdit = () => {
    setEditingCard(null)
    setEditingText('')
  }

  // Drag and drop handlers
  const handleCardDragStart = (e: React.DragEvent, columnId: string, cardId: string) => {
    setDraggingCard({ columnId, cardId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCardDragEnd = () => {
    setDraggingCard(null)
    setDragOverColumn(null)
    setDropTarget(null)
  }

  const handleColumnDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnId)
  }

  const handleColumnDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverColumn(null)
      setDropTarget(null)
    }
  }

  const handleCardDragOver = (e: React.DragEvent, columnId: string, cardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggingCard || draggingCard.cardId === cardId) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'

    setDropTarget({ columnId, cardId, position })
    setDragOverColumn(columnId)
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()

    if (!draggingCard) {
      setDragOverColumn(null)
      setDropTarget(null)
      return
    }

    const { columnId: sourceColumnId, cardId } = draggingCard

    // Find the card being moved from current columns
    const currentColumns = Array.isArray(kanbanColumns) ? kanbanColumns : columns
    const sourceCol = currentColumns.find(col => col.id === sourceColumnId)
    const cardToMove = sourceCol?.cards.find(card => card.id === cardId)

    if (!cardToMove) {
      setDraggingCard(null)
      setDragOverColumn(null)
      setDropTarget(null)
      return
    }

    setKanbanColumns((cols = []) => {
      return cols.map(col => {
        // Handle source column - remove the card
        if (col.id === sourceColumnId && col.id !== targetColumnId) {
          return {
            ...col,
            cards: col.cards.filter(card => card.id !== cardId)
          }
        }

        // Handle target column - add card at correct position
        if (col.id === targetColumnId) {
          // Remove the card first if it's in the same column
          const cardsWithoutDragged = col.cards.filter(card => card.id !== cardId)

          // Determine insert position
          let insertIndex = cardsWithoutDragged.length // Default: end of list

          if (dropTarget && dropTarget.columnId === targetColumnId && dropTarget.cardId) {
            const targetCardIndex = cardsWithoutDragged.findIndex(c => c.id === dropTarget.cardId)
            if (targetCardIndex !== -1) {
              insertIndex = dropTarget.position === 'before' ? targetCardIndex : targetCardIndex + 1
            }
          }

          // Insert card at position
          const newCards = [...cardsWithoutDragged]
          newCards.splice(insertIndex, 0, cardToMove)

          return {
            ...col,
            cards: newCards
          }
        }

        return col
      })
    })

    setDraggingCard(null)
    setDragOverColumn(null)
    setDropTarget(null)
  }

  // Focus input when editing starts
  useEffect(() => {
    if (editingCard && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingCard])

  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: kanbanSize.width,
      height: kanbanSize.height
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only allow dragging from the header
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - kanbanPosition.x,
      y: e.clientY - kanbanPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        // Keep widget within viewport bounds with 5px padding on all sides
        const padding = 5
        const headerHeight = 40 + padding // Top header bar height + padding
        const bottomReservedArea = 200 + 2 // Action bar + Research Agent + 2px padding from separator
        const minX = padding
        const maxX = window.innerWidth - 900 - padding
        const minY = headerHeight
        const maxY = window.innerHeight - kanbanSize.height - bottomReservedArea - padding

        setKanbanPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      } else if (isResizing && resizeDirection) {
        const deltaY = e.clientY - resizeStart.y

        let newHeight = resizeStart.height
        let newY = kanbanPosition.y
        const padding = 5
        const headerHeight = 40 + padding // Top header bar height + padding

        // Handle vertical resize directions only
        if (resizeDirection === 's') {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection === 'n') {
          newHeight = resizeStart.height - deltaY
          newY = kanbanPosition.y + deltaY
          // Don't allow resizing above the header
          newY = Math.max(headerHeight, newY)
        }

        // Apply height constraints
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        // Adjust position if resizing from north and we hit constraints
        if (resizeDirection === 'n') {
          newY = Math.max(headerHeight, kanbanPosition.y + (resizeStart.height - newHeight))
        }

        setKanbanSize({ width: 900, height: newHeight })
        if (resizeDirection === 'n') {
          setKanbanPosition({ x: kanbanPosition.x, y: newY })
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
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, kanbanPosition, kanbanSize, setKanbanPosition, setKanbanSize, MIN_HEIGHT, MAX_HEIGHT])

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${kanbanPosition.x}px`,
        top: `${kanbanPosition.y}px`,
        width: '900px',
        height: `${kanbanSize.height}px`,
        zIndex: kanbanZIndex
      }}
      onMouseDown={(e) => {
        bringWidgetToFront('kanban');
        handleMouseDown(e);
      }}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 cursor-move select-none"
        style={{ minHeight: '37px', paddingTop: '6px', paddingBottom: '6px' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-gray-200">Kanban Board</h3>

            {/* Column Summary with Priority Breakdown */}
            <div className="flex items-center gap-1">
              {(() => {
                // Priority config with short labels
                const priorityConfig: Record<Priority, { color: string; short: string }> = {
                  'Critical': { color: 'text-pink-400', short: 'C' },
                  'Off track': { color: 'text-red-400', short: 'O' },
                  'Important': { color: 'text-purple-400', short: 'I' },
                  'High': { color: 'text-orange-400', short: 'H' },
                  'Medium': { color: 'text-yellow-400', short: 'M' },
                  'Low': { color: 'text-blue-400', short: 'L' }
                }

                return columns.map((column) => {
                  // Calculate priority counts for this column
                  const priorityCounts: Record<Priority, number> = {
                    'Low': 0,
                    'Medium': 0,
                    'High': 0,
                    'Important': 0,
                    'Critical': 0,
                    'Off track': 0
                  }

                  column.cards.forEach(card => {
                    priorityCounts[card.priority as Priority]++
                  })

                  // Build priority breakdown string
                  const priorityBreakdown = Object.entries(priorityConfig)
                    .map(([priority, config]) => {
                      const count = priorityCounts[priority as Priority]
                      if (count === 0) return null
                      return (
                        <span key={priority} className={`${config.color} font-medium`}>
                          {config.short}:{count}
                        </span>
                      )
                    })
                    .filter(Boolean)

                  return (
                    <div
                      key={column.id}
                      className="flex items-center gap-1.5 bg-dark-bg/50 rounded-lg px-2 py-0.5"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-400">{column.title}:</span>
                        <span className="text-[11px] font-bold text-primary">{column.cards.length}</span>
                      </div>
                      {priorityBreakdown.length > 0 && (
                        <>
                          <div className="h-2.5 w-px bg-dark-border/50" />
                          <div className="flex items-center gap-1 text-[10px]">
                            {priorityBreakdown}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          <button
            onClick={() => setKanbanEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="relative flex gap-4 p-4 overflow-x-hidden overflow-y-auto scrollbar-thin" style={{ height: `calc(${kanbanSize.height}px - 56px)` }}>
        {columns.map(column => (
          <div
            key={column.id}
            className={`flex-shrink-0 w-[280px] bg-dark-bg/30 rounded-xl border p-3 transition-all ${
              dragOverColumn === column.id
                ? 'border-primary/50 bg-primary/5'
                : 'border-dark-border/30'
            }`}
            onDragOver={(e) => handleColumnDragOver(e, column.id)}
            onDragLeave={handleColumnDragLeave}
            onDrop={(e) => handleColumnDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-gray-300">{column.title}</h4>
                <span className="text-[10px] text-gray-500 bg-dark-bg/50 px-1.5 py-0.5 rounded">
                  {column.cards.length}
                </span>
              </div>
              <button
                onClick={() => addCard(column.id)}
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 hover:bg-dark-bg/50 rounded transition-colors"
              >
                <Plus size={12} className="text-gray-500 hover:text-gray-300" />
              </button>
            </div>

            {/* Cards */}
            <div className="space-y-2 overflow-y-auto pr-1 scrollbar-thin" style={{ maxHeight: `calc(${kanbanSize.height}px - 140px)` }}>
              {column.cards.map(card => {
                const isEditing = editingCard?.columnId === column.id && editingCard?.cardId === card.id
                const isDropBefore = dropTarget?.columnId === column.id && dropTarget?.cardId === card.id && dropTarget?.position === 'before'
                const isDropAfter = dropTarget?.columnId === column.id && dropTarget?.cardId === card.id && dropTarget?.position === 'after'

                return (
                  <div key={card.id} className="relative">
                    {/* Drop indicator - before */}
                    {isDropBefore && (
                      <div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
                    )}
                    <div
                      draggable={!isEditing}
                      onDragStart={(e) => handleCardDragStart(e, column.id, card.id)}
                      onDragEnd={handleCardDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, column.id, card.id)}
                      onClick={() => !isEditing && openCardModal(column.id, card)}
                      className={`bg-dark-card/80 border rounded-lg p-3 transition-all group ${
                        draggingCard?.cardId === card.id
                          ? 'opacity-50 cursor-grabbing'
                          : 'cursor-grab hover:border-primary/30 cursor-pointer'
                      } ${
                        isEditing ? 'border-primary/50' : 'border-dark-border/50'
                      }`}
                    >
                    {isEditing ? (
                      <textarea
                        ref={editInputRef}
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            saveEdit()
                          }
                          if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full text-xs text-gray-300 mb-2 leading-relaxed bg-dark-bg/50 border border-primary/30 rounded px-2 py-1 outline-none resize-none"
                        style={{ minHeight: '60px' }}
                      />
                    ) : (
                      <div className="mb-2">
                        <p className="text-xs text-gray-300 leading-relaxed hover:text-white transition-colors line-clamp-3 break-words">
                          {card.title}
                        </p>
                        {/* Content indicator */}
                        {card.content && card.content.trim() !== '' && (
                          <div className="flex items-center gap-1 mt-1.5">
                            <AlignLeft size={10} className="text-gray-500" />
                            <span className="text-[9px] text-gray-500">Has description</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          cyclePriority(column.id, card.id)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-all hover:scale-105 ${priorityColors[card.priority]}`}
                      >
                        {card.priority}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteCard(column.id, card.id)
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                      >
                        <Trash2 size={12} className="text-gray-500 hover:text-red-400" />
                      </button>
                    </div>
                    </div>
                    {/* Drop indicator - after */}
                    {isDropAfter && (
                      <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full z-10" />
                    )}
                  </div>
                )
              })}

              {/* Add New Card Button */}
              <button
                onClick={() => addCard(column.id)}
                className="w-full py-2 text-[11px] text-gray-500 hover:text-gray-300 hover:bg-dark-bg/30 rounded-lg border border-dashed border-gray-700/50 hover:border-gray-600/50 transition-all flex items-center justify-center gap-1"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Plus size={12} />
                <span>Add New</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Resize Handles - Vertical only */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 's')}
        className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'n')}
        className="absolute top-0 left-0 w-full h-2 cursor-ns-resize z-10"
      />

      {/* Card Detail Modal */}
      {showCardModal && selectedCard && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={closeCardModal}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[201] bg-dark-card border border-dark-border rounded-xl shadow-2xl w-[500px] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Card Details</h3>
              <button
                onClick={closeCardModal}
                className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-400 hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Title</label>
                <textarea
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  className="w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-primary/50 transition-colors resize-none scrollbar-thin"
                  placeholder="Enter card title..."
                  rows={3}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Description</label>
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  className="w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-primary/50 transition-colors resize-none scrollbar-thin"
                  placeholder="Add description..."
                  rows={6}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeCardModal}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCardModal}
                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-xs text-primary font-medium transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default KanbanWidget
