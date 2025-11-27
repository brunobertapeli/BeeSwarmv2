import { MermaidCard } from './MermaidCard'
import { InteractiveXMLHighlight } from './InteractiveXMLHighlight'

interface MessageContentProps {
  text: string
  onXMLClick?: (tag: string, content: string) => void
  onXMLDetected?: (tag: string, content: string) => void
  keywords?: Record<string, string>
  blockId?: string
}

interface ContentSegment {
  type: 'text' | 'mermaid'
  content: string
}

/**
 * MessageContent Component
 *
 * Parses message content and renders:
 * - MermaidCard for <mermaid>...</mermaid> blocks
 * - InteractiveXMLHighlight for other content (handles <env>, <editmode>, etc.)
 */
export function MessageContent({
  text,
  onXMLClick,
  onXMLDetected,
  keywords,
  blockId
}: MessageContentProps) {
  // Parse mermaid blocks from text
  const parseContent = (input: string): ContentSegment[] => {
    const segments: ContentSegment[] = []
    // Match mermaid blocks: <mermaid>content</mermaid>
    const mermaidPattern = /<mermaid>([\s\S]*?)<\/mermaid>/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = mermaidPattern.exec(input)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        const textBefore = input.substring(lastIndex, match.index)
        if (textBefore.trim()) {
          segments.push({ type: 'text', content: textBefore })
        }
      }

      // Add mermaid segment
      segments.push({
        type: 'mermaid',
        content: match[1].trim()
      })

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < input.length) {
      const remaining = input.substring(lastIndex)
      if (remaining.trim()) {
        segments.push({ type: 'text', content: remaining })
      }
    }

    // If no segments found, return original text
    if (segments.length === 0 && input.trim()) {
      segments.push({ type: 'text', content: input })
    }

    return segments
  }

  const segments = parseContent(text)

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === 'mermaid') {
          return <MermaidCard key={idx} content={segment.content} />
        }

        return (
          <InteractiveXMLHighlight
            key={idx}
            text={segment.content}
            onXMLClick={onXMLClick}
            onXMLDetected={onXMLDetected}
            keywords={keywords}
            blockId={blockId}
          />
        )
      })}
    </>
  )
}
