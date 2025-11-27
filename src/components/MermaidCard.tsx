import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface MermaidCardProps {
  content: string
}

/**
 * MermaidCard Component
 *
 * Displays mermaid diagram code in a styled card with copy functionality.
 * Shows the raw mermaid code and provides a button to copy it for use in the Whiteboard Widget.
 */
export function MermaidCard({ content }: MermaidCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy mermaid code:', err)
    }
  }

  return (
    <div className="my-3 rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/10">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        <span className="text-[12px] font-medium text-gray-300">Mermaid Diagram</span>
      </div>

      {/* Code content */}
      <div className="p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
        <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
          {content}
        </pre>
      </div>

      {/* Footer with message and copy button */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-t border-white/10">
        <span className="text-[11px] text-gray-400">
          Copy and paste in <span className="text-primary font-medium">Whiteboard</span> <kbd className="px-1 py-0.5 bg-white/10 rounded text-[10px] text-gray-300 font-mono ml-1">W</kbd> to convert into a visual diagram
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
            copied
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30'
          }`}
        >
          {copied ? (
            <>
              <Check size={12} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}
