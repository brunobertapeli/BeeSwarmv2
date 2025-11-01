import { useState, useEffect, useRef } from 'react'
import { X, Square, Trash2, Minimize2, Maximize2, Terminal as TerminalIcon, Copy, Check } from 'lucide-react'
import { ProcessOutput } from '../types/electron'
import Convert from 'ansi-to-html'

interface TerminalLine {
  type: 'stdout' | 'stderr' | 'info'
  content: string
  raw: string
  timestamp: Date
}

interface TerminalModalProps {
  isOpen: boolean
  onClose: () => void
  onStop?: () => void
  output?: ProcessOutput[]
}

const ansiConverter = new Convert({
  fg: '#fff',
  bg: '#0a0e14',
  newline: false,
  escapeXML: true,
  stream: false,
  colors: {
    0: '#0a0e14',
    1: '#ff6b6b',
    2: '#10B981',
    3: '#ffd93d',
    4: '#6495ED',
    5: '#f472b6',
    6: '#06b6d4',
    7: '#e5e7eb',
  }
})

function TerminalModal({ isOpen, onClose, onStop, output = [] }: TerminalModalProps) {
  const [history, setHistory] = useState<TerminalLine[]>([])
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const terminalContentRef = useRef<HTMLDivElement>(null)

  // Convert ProcessOutput to TerminalLine format
  useEffect(() => {
    const lines: TerminalLine[] = output.map(item => ({
      type: item.type,
      content: item.message,
      raw: item.raw,
      timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)
    }))

    // Add initial message if no output yet
    if (lines.length === 0) {
      lines.push({
        type: 'info',
        content: '$ Waiting for dev server output...',
        raw: '$ Waiting for dev server output...',
        timestamp: new Date()
      })
    }

    setHistory(lines)
  }, [output])

  // Auto-scroll to bottom when new lines added (only if user hasn't scrolled up)
  useEffect(() => {
    if (shouldAutoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [history, shouldAutoScroll])

  // Detect if user scrolled up manually
  useEffect(() => {
    const handleScroll = () => {
      if (!terminalContentRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = terminalContentRef.current
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

      setShouldAutoScroll(isNearBottom)
    }

    const contentRef = terminalContentRef.current
    contentRef?.addEventListener('scroll', handleScroll)
    return () => contentRef?.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleClear = () => {
    setHistory([
      {
        type: 'info',
        content: '$ Terminal cleared',
        raw: '$ Terminal cleared',
        timestamp: new Date(),
      },
    ])
  }

  const handleCopy = () => {
    const text = history.map((line) => line.content).join('\n')
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'stdout':
        return 'text-gray-200'
      case 'stderr':
        return 'text-red-400'
      case 'info':
        return 'text-gray-500'
      default:
        return 'text-gray-300'
    }
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Terminal Modal */}
      <div
        className={`relative bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col transition-all duration-300 ${
          isMaximized
            ? 'w-[95vw] h-[90vh]'
            : 'w-[900px] h-[600px]'
        }`}
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-bg/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TerminalIcon size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Terminal</h2>
              <p className="text-[10px] text-gray-500">Dev Server Output</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-dark-bg/70 rounded-lg transition-all group relative"
              title="Copy all output"
            >
              {isCopied ? (
                <Check size={14} className="text-primary" />
              ) : (
                <Copy size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
              )}
            </button>

            {/* Clear Button */}
            <button
              onClick={handleClear}
              className="p-2 hover:bg-dark-bg/70 rounded-lg transition-all group"
              title="Clear terminal"
            >
              <Trash2 size={14} className="text-gray-400 group-hover:text-yellow-400 transition-colors" />
            </button>

            {/* Stop Button */}
            {onStop && (
              <button
                onClick={onStop}
                className="p-2 hover:bg-red-500/10 rounded-lg transition-all group"
                title="Stop execution"
              >
                <Square size={14} className="text-gray-400 group-hover:text-red-400 transition-colors fill-current" />
              </button>
            )}

            {/* Maximize/Minimize */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-2 hover:bg-dark-bg/70 rounded-lg transition-all group"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
              ) : (
                <Maximize2 size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-bg/70 rounded-lg transition-all group"
              title="Close terminal"
            >
              <X size={14} className="text-gray-400 group-hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div className="flex-1 overflow-hidden bg-[#0a0e14] font-mono">
          <div
            ref={terminalContentRef}
            className="h-full overflow-y-auto p-4 space-y-1 terminal-scrollbar"
          >
            {history.map((line, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 font-normal select-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatTimestamp(line.timestamp)}
                </span>

                {/* Content with ANSI colors */}
                <div
                  className={`text-[13px] leading-relaxed flex-1 ${getLineColor(line.type)}`}
                  dangerouslySetInnerHTML={{
                    __html: ansiConverter.toHtml(line.raw)
                  }}
                />
              </div>
            ))}

            {/* Auto-scroll anchor */}
            <div ref={terminalEndRef} />

            {/* Cursor */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-primary text-sm">$</span>
              <div className="w-2 h-4 bg-primary animate-pulse" />
            </div>
          </div>
        </div>

        {/* Terminal Footer - Info Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-dark-border bg-dark-bg/30">
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-gray-500">Lines: <span className="text-white">{history.length}</span></span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-500">Status: <span className="text-primary">Connected</span></span>
          </div>
          <div className="text-[10px] text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[9px]">Esc</kbd> to close
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .terminal-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .terminal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .terminal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  )
}

export default TerminalModal
