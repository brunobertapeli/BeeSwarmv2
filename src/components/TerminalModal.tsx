import { useState, useEffect, useRef } from 'react'
import { X, Square, Trash2, Minimize2, Maximize2, Terminal as TerminalIcon, Copy, Check } from 'lucide-react'

interface TerminalLine {
  type: 'user' | 'assistant' | 'tool' | 'success' | 'error' | 'info'
  content: string
  timestamp: Date
}

interface TerminalModalProps {
  isOpen: boolean
  onClose: () => void
  onStop?: () => void
}

// Mock terminal history - will be replaced with real data
const MOCK_HISTORY: TerminalLine[] = [
  {
    type: 'info',
    content: '$ BeeSwarm Terminal v1.0.0',
    timestamp: new Date(Date.now() - 600000),
  },
  {
    type: 'info',
    content: '$ Connected to Claude Code SDK',
    timestamp: new Date(Date.now() - 590000),
  },
  {
    type: 'user',
    content: '> User: Add a dark mode toggle to the settings page',
    timestamp: new Date(Date.now() - 580000),
  },
  {
    type: 'assistant',
    content: "I'll help you add a dark mode toggle. Let me first check the current settings page structure.",
    timestamp: new Date(Date.now() - 575000),
  },
  {
    type: 'tool',
    content: '⚙ Reading file: src/pages/Settings.tsx',
    timestamp: new Date(Date.now() - 570000),
  },
  {
    type: 'tool',
    content: '⚙ Reading file: src/context/ThemeContext.tsx',
    timestamp: new Date(Date.now() - 565000),
  },
  {
    type: 'assistant',
    content: "I found the theme context. Now I'll add the toggle component.",
    timestamp: new Date(Date.now() - 560000),
  },
  {
    type: 'tool',
    content: '⚙ Writing changes to src/pages/Settings.tsx',
    timestamp: new Date(Date.now() - 555000),
  },
  {
    type: 'tool',
    content: '⚙ Creating new file: src/components/DarkModeToggle.tsx',
    timestamp: new Date(Date.now() - 550000),
  },
  {
    type: 'success',
    content: '✓ Dark mode toggle has been added to the settings page.',
    timestamp: new Date(Date.now() - 545000),
  },
  {
    type: 'tool',
    content: '⚙ Committed changes: "feat: add dark mode toggle to settings"',
    timestamp: new Date(Date.now() - 540000),
  },
  {
    type: 'success',
    content: '✓ Task completed successfully',
    timestamp: new Date(Date.now() - 535000),
  },
]

function TerminalModal({ isOpen, onClose, onStop }: TerminalModalProps) {
  const [history, setHistory] = useState<TerminalLine[]>(MOCK_HISTORY)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new lines added
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [history])

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
      case 'user':
        return 'text-blue-400'
      case 'assistant':
        return 'text-white'
      case 'tool':
        return 'text-gray-400'
      case 'success':
        return 'text-primary'
      case 'error':
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
              <p className="text-[10px] text-gray-500">Claude Code SDK Output</p>
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
          <div className="h-full overflow-y-auto p-4 space-y-1 terminal-scrollbar">
            {history.map((line, idx) => (
              <div key={idx} className="flex items-start gap-3 group">
                {/* Timestamp */}
                <span className="text-[10px] text-gray-600 font-normal select-none flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatTimestamp(line.timestamp)}
                </span>

                {/* Content */}
                <div className={`text-[13px] leading-relaxed flex-1 ${getLineColor(line.type)}`}>
                  {line.content}
                </div>
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
