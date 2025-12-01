import { useState, useEffect, useRef } from 'react'
import { Settings, ExternalLink, Camera, Image } from 'lucide-react'
import { KeywordHighlight } from './KeywordHighlight'
import { useAppStore } from '../store/appStore'

interface InteractiveXMLHighlightProps {
  text: string
  onXMLClick?: (tag: string, content: string) => void
  onXMLDetected?: (tag: string, content: string) => void // Called when XML tag is found in text
  keywords?: Record<string, string> // Optional keywords for highlighting
  blockId?: string // Block ID for keyword tracking
}

interface XMLSegment {
  text: string
  isXML?: boolean
  tag?: string
  content?: string
  isPrintscreen?: boolean
  route?: string
  fullPage?: boolean
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
export function InteractiveXMLHighlight({ text, onXMLClick, onXMLDetected, keywords, blockId }: InteractiveXMLHighlightProps) {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const printscreenRefs = useRef<Map<number, HTMLSpanElement>>(new Map())
  const { currentProjectId } = useAppStore()

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

  // Convert route to filename (must match backend logic)
  const routeToFilename = (route: string): string => {
    let name = route.replace(/^\/+|\/+$/g, '').replace(/\//g, '-')
    if (!name) name = 'index'
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '-')
    return `${name}.png`
  }

  // Handle opening screenshot
  const handleOpenScreenshot = async (route: string) => {
    if (!currentProjectId) return

    try {
      // Get project path and open the screenshot
      const result = await window.electronAPI?.projects.getById(currentProjectId)
      if (result?.success && result.project?.path) {
        const filename = routeToFilename(route)
        const screenshotPath = `${result.project.path}/.codedeck/${filename}`
        window.electronAPI?.shell?.openPath(screenshotPath)
      }
    } catch (error) {
      console.error('Failed to open screenshot:', error)
    }
  }

  // Handle hover for printscreen tooltip
  const handlePrintscreenHover = (idx: number) => {
    setHoveredSegment(idx)
    const element = printscreenRefs.current.get(idx)
    if (element) {
      const rect = element.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      })
    }
  }

  const handlePrintscreenLeave = () => {
    setHoveredSegment(null)
    setTooltipPosition(null)
  }

  // Parse XML tags from text (including printscreen_tool)
  const parseXMLTags = (input: string): XMLSegment[] => {
    const segments: XMLSegment[] = []

    // Combined pattern to match:
    // 1. <printscreen_tool ...attributes... /> or <printscreen_tool ...></printscreen_tool>
    // 2. Regular XML: <tagname>content</tagname>
    const combinedPattern = /<printscreen_tool\s+([^>]+?)(?:\/>|><\/printscreen_tool>)|<(\w+)>(.*?)<\/\2>/g

    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = combinedPattern.exec(input)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        segments.push({ text: input.substring(lastIndex, match.index) })
      }

      // Check if it's a printscreen_tool match (group 1) or regular XML (groups 2,3)
      if (match[1] !== undefined) {
        // Printscreen tool match - parse attributes
        const attrs = match[1]
        const routeMatch = attrs.match(/route=["']([^"']+)["']/i)
        const fullPageMatch = attrs.match(/fullpage=["']([^"']+)["']/i)

        segments.push({
          text: match[0],
          isPrintscreen: true,
          route: routeMatch ? routeMatch[1] : '/',
          fullPage: fullPageMatch ? fullPageMatch[1].toLowerCase() === 'true' : false
        })
      } else {
        // Regular XML match
        segments.push({
          text: match[0],
          isXML: true,
          tag: match[2],
          content: match[3]
        })
      }

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < input.length) {
      segments.push({ text: input.substring(lastIndex) })
    }

    // If no matches found, return original text as single segment
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
    <>
    <span className="inline-block" style={{ display: 'inline' }}>
      {segments.map((segment, idx) => {
        // Render printscreen_tool segments
        if (segment.isPrintscreen) {
          const isHovered = hoveredSegment === idx

          return (
            <span
              key={idx}
              ref={(el) => {
                if (el) {
                  printscreenRefs.current.set(idx, el)
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
                handleOpenScreenshot(segment.route || '/')
              }}
              onMouseEnter={() => handlePrintscreenHover(idx)}
              onMouseLeave={handlePrintscreenLeave}
              className="inline-flex items-center gap-1.5 mx-0.5 cursor-pointer transition-all duration-200 relative"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                verticalAlign: 'baseline'
              }}
            >
              {/* Screenshot pill with cyan/teal gradient */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-500/30 via-teal-500/30 to-cyan-500/30 border border-cyan-400/30 backdrop-blur-sm relative overflow-hidden transition-all duration-200"
              >
                {/* Shimmer effect */}
                <span
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                  style={{
                    animation: 'textSweep 3s ease-in-out infinite',
                    transform: 'translateX(-100%)'
                  }}
                />

                {/* Camera icon */}
                <Camera size={12} className="relative z-10 text-cyan-300" />

                {/* Text */}
                <span className="relative z-10 text-[11px] font-medium text-cyan-200">
                  Screenshot captured
                </span>

                {/* Route badge */}
                <span className="relative z-10 text-[10px] font-mono text-cyan-400/80 bg-cyan-500/20 px-1.5 py-0.5 rounded">
                  {segment.route}
                </span>

                {/* Image icon for click hint */}
                <Image size={10} className="relative z-10 text-cyan-300 opacity-70" />
              </span>
            </span>
          )
        }

        // Render regular XML segments
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

        // Regular text segment - apply keyword highlighting if keywords provided
        if (keywords && blockId && Object.keys(keywords).length > 0) {
          return (
            <KeywordHighlight
              key={idx}
              text={segment.text}
              keywords={keywords}
              blockId={blockId}
            />
          )
        }
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

    {/* Fixed tooltip for printscreen - renders outside the span to avoid z-index issues */}
    {hoveredSegment !== null && tooltipPosition && segments[hoveredSegment]?.isPrintscreen && (
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
      >
        <div className="bg-gray-900 border border-cyan-500/30 rounded-lg shadow-2xl px-3 py-2">
          <div className="flex items-center gap-2">
            <Camera size={14} className="text-cyan-400 flex-shrink-0" />
            <span className="text-[11px] text-cyan-200 font-medium">
              Click to view screenshot
            </span>
          </div>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-b border-r border-cyan-500/30 transform rotate-45" />
        </div>
      </div>
    )}
    </>
  )
}
