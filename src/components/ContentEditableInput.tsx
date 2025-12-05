import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface ImageReference {
  id: string
  name: string
  path: string
  src: string
  dimensions: string
}

interface TextContent {
  id: string
  content: string
  lineCount: number
  preview: string
}

interface ContentEditableInputProps {
  value: string
  onChange: (value: string) => void
  imageReferences: ImageReference[]
  onRemoveImageReference: (id: string) => void
  textContents: TextContent[]
  onRemoveTextContent: (id: string) => void
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

/**
 * ContentEditableInput
 *
 * A textarea input with image reference pills on the left.
 * Text content from large pastes shows as plain text markers inline.
 */
const ContentEditableInput = forwardRef<ContentEditableInputRef, ContentEditableInputProps>(
  (
    {
      value,
      onChange,
      imageReferences,
      onRemoveImageReference,
      textContents,
      onRemoveTextContent,
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
    const highlightRef = useRef<HTMLDivElement>(null)

    // Sync scroll between textarea and highlight overlay
    const syncScroll = () => {
      if (textareaRef.current && highlightRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
      }
    }

    const handleScroll = () => {
      syncScroll()
    }

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

    // Sync scroll whenever value changes (handles programmatic updates)
    useEffect(() => {
      syncScroll()
    }, [value])

    // Handle text changes and detect broken markers
    const handleChange = (newValue: string) => {
      // Check if any markers were partially deleted/edited
      const markerRegex = /\[pasted (\d+) lines #(\d+)\]/g
      const foundMarkers = new Set<string>()
      let match

      // Find all intact markers in the new value
      while ((match = markerRegex.exec(newValue)) !== null) {
        foundMarkers.add(match[2]) // Store the short ID
      }

      // Check for broken markers and remove only the broken marker portion
      // Match: [pasted followed by only spaces, digits, "lines", or #, then optional ]
      // Stops when hitting other text like letters that aren't "lines"
      let cleanedValue = newValue.replace(/\[pasted(?: (?:\d+|lines|#\d*))*\]?/g, (match) => {
        // If this matches the complete valid pattern, keep it
        if (/^\[pasted \d+ lines #\d+\]$/.test(match)) {
          return match
        }
        // Check if this is just "[pasted" alone - keep it while user is typing
        if (match === '[pasted') {
          return match
        }
        // Otherwise it's broken (incomplete or missing closing bracket), remove it
        return ''
      })

      // If we cleaned anything, update and notify
      if (cleanedValue !== newValue) {
        onChange(cleanedValue)

        // Remove corresponding content from store
        textContents.forEach(content => {
          const shortId = content.id.replace('TEXT_', '').slice(-6)
          if (!foundMarkers.has(shortId)) {
            onRemoveTextContent(content.id)
          }
        })

        // Sync scroll after state update
        requestAnimationFrame(() => syncScroll())
        return
      }

      // Check if any complete markers were removed
      textContents.forEach(content => {
        const shortId = content.id.replace('TEXT_', '').slice(-6)
        if (!foundMarkers.has(shortId)) {
          // This marker was removed, clean up
          onRemoveTextContent(content.id)
        }
      })

      onChange(newValue)

      // Sync scroll after value change (critical for auto-scroll on Enter/typing)
      requestAnimationFrame(() => syncScroll())
    }

    const handleImagePillRemove = (id: string) => {
      onRemoveImageReference(id)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If backspace at start and there are image pills, remove last one
      if (e.key === 'Backspace' && value === '' && imageReferences.length > 0) {
        e.preventDefault()
        onRemoveImageReference(imageReferences[imageReferences.length - 1].id)
      }

      onKeyDown?.(e)

      // Sync scroll after key press (especially Enter) to handle auto-scroll
      requestAnimationFrame(() => syncScroll())
    }

    // Calculate if we need padding for pills
    const hasPills = imageReferences.length > 0

    // Create highlighted text for display behind textarea
    const getHighlightedText = () => {
      if (!value) return null

      const parts = []
      const markerRegex = /\[pasted \d+ lines #\d+\]/g
      let lastIndex = 0
      let match

      while ((match = markerRegex.exec(value)) !== null) {
        // Add text before marker
        if (match.index > lastIndex) {
          parts.push(
            <span key={`text-${lastIndex}`} className="text-white">
              {value.slice(lastIndex, match.index)}
            </span>
          )
        }

        // Add marker with amber color
        parts.push(
          <span key={`marker-${match.index}`} className="text-amber-400">
            {match[0]}
          </span>
        )

        lastIndex = match.index + match[0].length
      }

      // Add remaining text
      if (lastIndex < value.length) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-white">
            {value.slice(lastIndex)}
          </span>
        )
      }

      return parts
    }

    return (
      <div className={`${className} flex items-center`}>
        {/* Image reference pills (purple) */}
        {imageReferences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center pl-3.5 pr-2 py-2.5 pointer-events-auto">
            {imageReferences.map((ref) => (
              <div
                key={ref.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded text-xs text-purple-300 group pointer-events-auto whitespace-nowrap"
              >
                <img
                  src={ref.src}
                  alt={ref.name}
                  className="w-4 h-4 object-cover rounded flex-shrink-0"
                />
                <span className="font-medium max-w-[100px] truncate">{ref.name}</span>
                <button
                  onClick={() => handleImagePillRemove(ref.id)}
                  className="hover:bg-purple-500/20 rounded p-0.5 transition-colors opacity-60 group-hover:opacity-100 flex-shrink-0"
                  disabled={disabled}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea with highlight overlay */}
        <div className="flex-1 relative">
          {/* Placeholder when empty */}
          {!value && (
            <div
              className={`absolute inset-0 pointer-events-none text-gray-500 ${hasPills ? 'pl-2 py-2.5' : 'px-3.5 py-2.5'}`}
              style={{
                lineHeight: '24px',
              }}
            >
              {placeholder}
            </div>
          )}

          {/* Highlight layer - hidden, kept for potential future use */}

          {/* Actual textarea on top */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            onPaste={onPaste}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onScroll={handleScroll}
            disabled={disabled}
            className={`relative bg-transparent border-none outline-none resize-none ${hasPills ? 'pl-2 py-2.5' : 'px-3.5 py-2.5'} w-full text-white`}
            rows={3}
            style={{
              lineHeight: '24px',
              height: '77px',
              overflow: 'auto',
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
