import { useState, useRef, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'

interface KeywordHighlightProps {
  text: string
  keywords: Record<string, string>
  blockId: string
}

/**
 * KeywordHighlight Component
 *
 * Highlights tech keywords in text and shows tooltips with simple explanations.
 * Only highlights the FIRST occurrence of each keyword per block to avoid flooding.
 */
export function KeywordHighlight({ text, keywords, blockId }: KeywordHighlightProps) {
  const [hoveredKeyword, setHoveredKeyword] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const keywordRefs = useRef<Map<string, HTMLSpanElement>>(new Map())

  // Track which keywords have already been highlighted in this block
  const highlightedKeywords = new Set<string>()

  // Split text into segments with keywords highlighted
  const segments: Array<{ text: string; keyword?: string; description?: string }> = []

  // Create regex pattern from all keywords (case-insensitive, word boundaries)
  const keywordsList = Object.keys(keywords)
  if (keywordsList.length === 0) {
    return <span>{text}</span>
  }

  // Escape special regex characters and create pattern
  const escapedKeywords = keywordsList.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`\\b(${escapedKeywords.join('|')})\\b`, 'gi')

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const keyword = match[0].toLowerCase()

    // Add text before match
    if (match.index > lastIndex) {
      segments.push({ text: text.substring(lastIndex, match.index) })
    }

    // Only highlight if this is the FIRST occurrence of this keyword in this block
    if (!highlightedKeywords.has(keyword)) {
      highlightedKeywords.add(keyword)
      segments.push({
        text: match[0],
        keyword: keyword,
        description: keywords[keyword]
      })
    } else {
      // Already highlighted once, just add plain text
      segments.push({ text: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex) })
  }

  const handleMouseEnter = (keyword: string) => {
    setHoveredKeyword(keyword)

    // Calculate tooltip position
    const element = keywordRefs.current.get(keyword)
    if (element) {
      const rect = element.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 8, // 8px above the element
        left: rect.left + rect.width / 2 // Center horizontally
      })
    }
  }

  const handleMouseLeave = () => {
    setHoveredKeyword(null)
    setTooltipPosition(null)
  }

  return (
    <>
      <span>
        {segments.map((segment, idx) => {
          if (segment.keyword && segment.description) {
            return (
              <span
                key={idx}
                ref={(el) => {
                  if (el && segment.keyword) {
                    keywordRefs.current.set(segment.keyword, el)
                  }
                }}
                className="keyword-highlight"
                onMouseEnter={() => handleMouseEnter(segment.keyword!)}
                onMouseLeave={handleMouseLeave}
                style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  borderRadius: '2px',
                  padding: '0 2px',
                  cursor: 'help',
                  display: 'inline-block'
                }}
              >
                {segment.text}
              </span>
            )
          }
          return <span key={idx}>{segment.text}</span>
        })}
      </span>

      {/* Portal tooltip with fixed positioning - appears above everything */}
      {hoveredKeyword && tooltipPosition && (() => {
        const description = keywords[hoveredKeyword]
        return (
          <div
            style={{
              position: 'fixed',
              top: tooltipPosition.top,
              left: tooltipPosition.left,
              transform: 'translate(-50%, -100%)',
              zIndex: 99999,
              pointerEvents: 'none',
              width: 'max-content',
              maxWidth: '280px'
            }}
            className="keyword-tooltip"
          >
            <div className="bg-gray-900 border border-purple-500/30 rounded-lg shadow-2xl p-3">
              <div className="flex items-start gap-2">
                <HelpCircle size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] font-medium text-purple-300 mb-1">
                    {hoveredKeyword}
                  </div>
                  <div className="text-[10px] text-gray-400 leading-relaxed">
                    {description}
                  </div>
                </div>
              </div>
              {/* Arrow pointing down */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-b border-r border-purple-500/30 transform rotate-45" />
            </div>
          </div>
        )
      })()}
    </>
  )
}
