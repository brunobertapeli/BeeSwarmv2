import { useState, useEffect } from 'react'
import { Settings, ExternalLink } from 'lucide-react'

interface InteractiveXMLHighlightProps {
  text: string
  onXMLClick?: (tag: string, content: string) => void
  onXMLDetected?: (tag: string, content: string) => void // Called when XML tag is found in text
}

interface XMLSegment {
  text: string
  isXML?: boolean
  tag?: string
  content?: string
}

/**
 * InteractiveXMLHighlight Component
 *
 * Detects XML-style tags in text (e.g., <env>content</env>) and makes them clickable.
 * Features:
 * - Beautiful gradient background with shimmer effect
 * - Clear visual indication of clickability
 * - Hover effects with scaling
 * - Icon based on tag type
 */
export function InteractiveXMLHighlight({ text, onXMLClick, onXMLDetected }: InteractiveXMLHighlightProps) {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)

  // Detect XML tags and notify parent
  useEffect(() => {
    if (!onXMLDetected) return

    // Match XML-style tags: <tagname>content</tagname>
    const xmlPattern = /<(\w+)>(.*?)<\/\1>/g
    let match: RegExpExecArray | null

    while ((match = xmlPattern.exec(text)) !== null) {
      const tag = match[1]
      const content = match[2]
      onXMLDetected(tag, content)
    }
  }, [text, onXMLDetected])

  // Parse XML tags from text
  const parseXMLTags = (input: string): XMLSegment[] => {
    const segments: XMLSegment[] = []
    // Match XML-style tags: <tagname>content</tagname>
    const xmlPattern = /<(\w+)>(.*?)<\/\1>/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = xmlPattern.exec(input)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        segments.push({ text: input.substring(lastIndex, match.index) })
      }

      // Add XML segment
      segments.push({
        text: match[0], // Full match including tags
        isXML: true,
        tag: match[1], // Tag name
        content: match[2] // Content between tags
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < input.length) {
      segments.push({ text: input.substring(lastIndex) })
    }

    // If no XML found, return original text as single segment
    if (segments.length === 0) {
      segments.push({ text: input })
    }

    return segments
  }

  const segments = parseXMLTags(text)

  // Get icon based on tag type
  const getIconForTag = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'env':
        return <Settings size={12} className="text-white" />
      case 'editmode':
        return null // No icon for editmode
      default:
        return <ExternalLink size={12} className="text-white" />
    }
  }

  // Get gradient colors based on tag type
  const getGradientForTag = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'env':
        return 'from-blue-500/30 via-purple-500/30 to-pink-500/30'
      case 'editmode':
        return 'from-pink-500/30 via-pink-400/30 to-pink-500/30'
      default:
        return 'from-emerald-500/30 via-cyan-500/30 to-blue-500/30'
    }
  }

  return (
    <span className="inline-block" style={{ display: 'inline' }}>
      {segments.map((segment, idx) => {
        if (segment.isXML && segment.tag && segment.content) {
          const isHovered = hoveredSegment === idx
          const gradient = getGradientForTag(segment.tag)

          return (
            <span
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                if (onXMLClick) {
                  onXMLClick(segment.tag!, segment.content!)
                }
              }}
              onMouseEnter={() => setHoveredSegment(idx)}
              onMouseLeave={() => setHoveredSegment(null)}
              className="inline-flex items-center gap-1.5 mx-0.5 cursor-pointer transition-all duration-200 relative"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'baseline'
              }}
            >
              {/* Animated gradient background */}
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r ${gradient} border border-white/20 backdrop-blur-sm relative overflow-hidden transition-all duration-200`}
                style={{
                  boxShadow: '0 0 10px rgba(139, 92, 246, 0.2)'
                }}
              >
                {/* Running text effect - black gradient sweep (always animating) */}
                <span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-black/50 to-transparent pointer-events-none"
                  style={{
                    animation: 'textSweep 4s ease-in-out infinite',
                    transform: 'translateX(-100%)',
                    mixBlendMode: 'overlay'
                  }}
                />

                {/* Icon */}
                {getIconForTag(segment.tag) && (
                  <span className="relative z-10 flex-shrink-0 transition-all duration-200" style={{
                    filter: isHovered ? 'brightness(1.2)' : 'brightness(1)'
                  }}>
                    {getIconForTag(segment.tag)}
                  </span>
                )}

                {/* Content with running effect */}
                <span className="relative z-10 text-[11px] font-medium text-white transition-all duration-200" style={{
                  textShadow: isHovered ? '0 0 8px rgba(255, 255, 255, 0.5)' : 'none'
                }}>
                  {segment.content}
                </span>

                {/* Arrow indicator or keyboard shortcut hint */}
                {segment.tag.toLowerCase() === 'editmode' ? (
                  <span className="relative z-10 flex-shrink-0 px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold">
                    E
                  </span>
                ) : (
                  <span className="relative z-10 flex-shrink-0">
                    <ExternalLink size={10} className="text-white opacity-80" />
                  </span>
                )}

                {/* Tooltip for editmode on hover */}
                {segment.tag.toLowerCase() === 'editmode' && isHovered && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-pink-500/30 rounded text-[10px] text-white whitespace-nowrap pointer-events-none z-[9999]">
                    Press <kbd className="px-1 py-0.5 bg-pink-500/20 rounded text-pink-300 font-mono">E</kbd> to activate Edit Mode
                    {/* Arrow pointing down */}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 border-r border-b border-pink-500/30 transform rotate-45" />
                  </span>
                )}
              </span>
            </span>
          )
        }

        // Regular text segment
        return <span key={idx}>{segment.text}</span>
      })}

      {/* Keyframes for text sweep animation */}
      <style>{`
        @keyframes textSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </span>
  )
}
