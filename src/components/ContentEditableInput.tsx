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

interface SelectedElement {
  id: string
  selector: string
  elementType: string
  preview: string
  filePath: string | null
  lineRange: string | null
  displayLabel: string
}

interface ContentEditableInputProps {
  value: string
  onChange: (value: string) => void
  imageReferences: ImageReference[]
  onRemoveImageReference: (id: string) => void
  textContents: TextContent[]
  onRemoveTextContent: (id: string) => void
  selectedElements?: SelectedElement[]
  onRemoveSelectedElement?: (id: string) => void
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
 * A textarea input with reference pills displayed above (inside the textarea area).
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
      selectedElements = [],
      onRemoveSelectedElement,
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

    const handleSelectedElementRemove = (id: string) => {
      onRemoveSelectedElement?.(id)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If backspace at start and there are pills, remove last one
      if (e.key === 'Backspace' && value === '') {
        if (selectedElements.length > 0 && onRemoveSelectedElement) {
          e.preventDefault()
          onRemoveSelectedElement(selectedElements[selectedElements.length - 1].id)
        } else if (imageReferences.length > 0) {
          e.preventDefault()
          onRemoveImageReference(imageReferences[imageReferences.length - 1].id)
        }
      }

      onKeyDown?.(e)

      // Sync scroll after key press (especially Enter) to handle auto-scroll
      requestAnimationFrame(() => syncScroll())
    }

    // Check if we have any pills to display above
    const hasPills = imageReferences.length > 0 || selectedElements.length > 0

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
      <div className={`${className} relative`}>
        {/* Pills displayed above textarea (absolute positioned inside) */}
        {hasPills && (
          <div className="absolute left-[12px] top-[7px] flex gap-1 z-[5] pointer-events-auto max-w-[calc(100%-50px)] overflow-x-auto overflow-y-hidden scrollbar-hide">
            {/* Image reference pills (purple) */}
            {imageReferences.map((ref) => (
              <div
                key={ref.id}
                className="relative bg-purple-500/20 border border-purple-500/30 rounded-full px-1.5 py-px flex items-center gap-0.5 group hover:bg-purple-500/30 transition-colors flex-shrink-0"
              >
                <img
                  src={ref.src}
                  alt={ref.name}
                  className="w-2.5 h-2.5 rounded-full object-cover flex-shrink-0"
                />
                <span className="text-[9px] text-purple-200 max-w-[100px] truncate">
                  {ref.name}
                </span>
                <button
                  onClick={() => handleImagePillRemove(ref.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                  disabled={disabled}
                >
                  <X size={8} className="text-purple-300 hover:text-red-400" />
                </button>
              </div>
            ))}

            {/* Selected element pills (green) */}
            {selectedElements.map((el) => (
              <div
                key={el.id}
                className="relative bg-green-500/20 border border-green-500/30 rounded-full px-1.5 py-px flex items-center gap-0.5 group hover:bg-green-500/30 transition-colors flex-shrink-0"
                title={el.selector}
              >
                <span className="text-[9px] text-green-200 font-mono max-w-[130px] truncate">
                  {el.displayLabel}
                </span>
                {onRemoveSelectedElement && (
                  <button
                    onClick={() => handleSelectedElementRemove(el.id)}
                    className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    disabled={disabled}
                  >
                    <X size={8} className="text-green-300 hover:text-red-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Placeholder when empty */}
        {!value && !hasPills && (
          <div
            className="absolute inset-0 pointer-events-none text-gray-500 px-3.5 py-2.5"
            style={{
              lineHeight: '24px',
            }}
          >
            {placeholder}
          </div>
        )}

        {/* Placeholder when has pills but no value */}
        {!value && hasPills && (
          <div
            className="absolute left-[12px] top-[30px] pointer-events-none text-gray-500"
            style={{
              lineHeight: '24px',
            }}
          >
            {placeholder}
          </div>
        )}

        {/* Actual textarea */}
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
          className={`relative bg-transparent border-none outline-none resize-none px-3 w-full text-white ${hasPills ? 'pt-[30px] pb-2' : 'py-2.5'}`}
          rows={3}
          style={{
            lineHeight: '24px',
            height: '77px',
            overflow: 'auto',
            caretColor: 'white',
          }}
        />
      </div>
    )
  }
)

ContentEditableInput.displayName = 'ContentEditableInput'

export default ContentEditableInput
