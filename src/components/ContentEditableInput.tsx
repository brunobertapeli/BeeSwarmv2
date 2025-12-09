import { forwardRef, useImperativeHandle, useRef } from 'react'
import { X, Image, FileText, Code } from 'lucide-react'

// Unified pill interface - all pill types use this
export interface Pill {
  id: string
  type: 'image-ref' | 'selected-element' | 'attachment-image' | 'attachment-file' | 'text-content'
  label: string
  preview?: string // For images: src, for text: truncated content
  tooltip?: string // Shown on hover
}

interface ContentEditableInputProps {
  value: string
  onChange: (value: string) => void
  pills: Pill[]
  onRemovePill: (id: string) => void
  placeholder?: string
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFocus?: () => void
  onBlur?: () => void
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLTextAreaElement>) => void
  onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void
  className?: string
}

export interface ContentEditableInputRef {
  focus: () => void
  clear: () => void
  textarea: HTMLTextAreaElement | null
}

// Get pill styling based on type
const getPillStyle = (type: Pill['type']) => {
  switch (type) {
    case 'image-ref':
      return {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/30',
        hoverBg: 'hover:bg-purple-500/30',
        text: 'text-purple-200',
        closeText: 'text-purple-300',
      }
    case 'selected-element':
      return {
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
        hoverBg: 'hover:bg-green-500/30',
        text: 'text-green-200',
        closeText: 'text-green-300',
      }
    case 'attachment-image':
    case 'attachment-file':
      return {
        bg: 'bg-dark-bg/90',
        border: 'border-dark-border/50',
        hoverBg: 'hover:bg-dark-bg',
        text: 'text-gray-300',
        closeText: 'text-gray-400',
      }
    case 'text-content':
      return {
        bg: 'bg-amber-500/20',
        border: 'border-amber-500/30',
        hoverBg: 'hover:bg-amber-500/30',
        text: 'text-amber-200',
        closeText: 'text-amber-300',
      }
    default:
      return {
        bg: 'bg-gray-500/20',
        border: 'border-gray-500/30',
        hoverBg: 'hover:bg-gray-500/30',
        text: 'text-gray-200',
        closeText: 'text-gray-300',
      }
  }
}

// Get icon for pill type
const PillIcon = ({ type, preview }: { type: Pill['type']; preview?: string }) => {
  switch (type) {
    case 'image-ref':
    case 'attachment-image':
      return preview ? (
        <img
          src={preview}
          alt=""
          className="w-3 h-3 rounded-sm object-cover flex-shrink-0"
        />
      ) : (
        <Image size={10} className="flex-shrink-0 opacity-70" />
      )
    case 'attachment-file':
      return <FileText size={10} className="flex-shrink-0 opacity-70" />
    case 'selected-element':
      return <Code size={10} className="flex-shrink-0 opacity-70" />
    case 'text-content':
      return <FileText size={10} className="flex-shrink-0 opacity-70" />
    default:
      return null
  }
}

/**
 * ContentEditableInput
 *
 * A unified textarea input with pills displayed above.
 * All pill types (attachments, image refs, selected elements, text content)
 * are handled through a single unified interface.
 */
const ContentEditableInput = forwardRef<ContentEditableInputRef, ContentEditableInputProps>(
  (
    {
      value,
      onChange,
      pills,
      onRemovePill,
      placeholder = 'Type a message...',
      disabled = false,
      onKeyDown,
      onFocus,
      onBlur,
      onPaste,
      onDragOver,
      onDrop,
      className = '',
    },
    ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Expose methods and element to parent via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        textareaRef.current?.focus()
      },
      clear: () => {
        if (textareaRef.current) {
          textareaRef.current.value = ''
          onChange('')
        }
      },
      get textarea() {
        return textareaRef.current
      },
    }))

    const handlePillRemove = (id: string) => {
      onRemovePill(id)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If backspace at start and there are pills, remove last one
      if (e.key === 'Backspace' && value === '' && pills.length > 0) {
        e.preventDefault()
        onRemovePill(pills[pills.length - 1].id)
        return
      }

      onKeyDown?.(e)
    }

    const hasPills = pills.length > 0

    return (
      <div className={`${className} relative flex flex-col h-full`}>
        {/* Pills row - fixed height, horizontal scroll */}
        {hasPills && (
          <div className="flex-shrink-0 px-3 pt-2 pb-1">
            <div className="flex gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-hide">
              {pills.map((pill) => {
                const style = getPillStyle(pill.type)
                return (
                  <div
                    key={pill.id}
                    className={`${style.bg} ${style.border} ${style.hoverBg} border rounded-full px-2 py-0.5 flex items-center gap-1 group transition-colors flex-shrink-0 cursor-default`}
                    title={pill.tooltip}
                  >
                    <PillIcon type={pill.type} preview={pill.preview} />
                    <span className={`text-[10px] ${style.text} max-w-[100px] truncate ${pill.type === 'selected-element' ? 'font-mono' : ''}`}>
                      {pill.label}
                    </span>
                    <button
                      onClick={() => handlePillRemove(pill.id)}
                      className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                      disabled={disabled}
                    >
                      <X size={10} className={`${style.closeText} hover:text-red-400`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Textarea container - fills remaining space */}
        <div className="flex-1 min-h-0 relative px-3 pb-2">
          {/* Placeholder */}
          {!value && (
            <div
              className="absolute left-3 top-[10px] pointer-events-none text-gray-500 pr-12"
              style={{ lineHeight: '24px' }}
            >
              {placeholder}
            </div>
          )}

          {/* Actual textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            onPaste={onPaste}
            onDragOver={onDragOver}
            onDrop={onDrop}
            disabled={disabled}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-white pt-[10px]"
            style={{
              lineHeight: '24px',
              caretColor: 'white',
            }}
          />
        </div>
      </div>
    )
  }
)

ContentEditableInput.displayName = 'ContentEditableInput'

export default ContentEditableInput
