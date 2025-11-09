import { useState, useEffect, useRef } from 'react'
import { X, Square, Trash2, Minimize2, Maximize2, Terminal as TerminalIcon, Copy, Check, Send } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

interface TerminalLine {
  timestamp: Date
  source: 'dev-server' | 'shell' | 'npm' | 'git' | 'claude' | 'user' | 'system'
  type: 'stdout' | 'stderr'
  message: string
  raw?: string
}

interface TerminalModalProps {
  isOpen: boolean
  onClose: () => void
  onStop?: () => void
  projectId: string
  projectName: string
}

function TerminalModal({ isOpen, onClose, onStop, projectId, projectName }: TerminalModalProps) {
  const { currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState, thumbnailData } = useLayoutStore()
  const [isMaximized, setIsMaximized] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [lineCount, setLineCount] = useState(0)

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  // Helper functions for formatting
  const formatTimestamp = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  }

  const formatSourceTag = (source: string): string => {
    const tags: Record<string, string> = {
      'dev-server': '[Dev Server]',
      'shell': '[Shell]',
      'npm': '[NPM]',
      'git': '[Git]',
      'claude': '[Claude]',
      'user': '[User]',
      'system': '[System]',
    }
    return tags[source] || `[${source}]`
  }

  const getSourceColor = (source: string): string => {
    const colors: Record<string, string> = {
      'dev-server': '\x1b[36m', // Cyan
      'shell': '\x1b[32m',      // Green
      'npm': '\x1b[33m',        // Yellow
      'git': '\x1b[35m',        // Magenta
      'claude': '\x1b[38;5;130m', // Brownish (Claude brand color)
      'user': '\x1b[38;5;141m',   // Purple
      'system': '\x1b[90m',     // Gray
    }
    return colors[source] || '\x1b[37m' // White
  }

  // Write a line to the terminal with source tag
  const writeLineToTerminal = (line: TerminalLine) => {
    if (!xtermRef.current) {
      return
    }

    const terminal = xtermRef.current

    // Get source color
    const sourceColor = getSourceColor(line.source)
    const sourceTag = formatSourceTag(line.source)

    // Format: [HH:MM:SS] [Source] message
    const timestamp = formatTimestamp(line.timestamp)
    const timeColor = '\x1b[90m' // Gray
    const reset = '\x1b[0m'

    // Calculate prefix length for wrapping
    // [HH:MM:SS] [Source] = approx 25 chars
    const prefix = `${timeColor}[${timestamp}]${reset} ${sourceColor}${sourceTag}${reset} `
    const prefixDisplayLength = `[${timestamp}] ${sourceTag} `.length // Visible length without ANSI codes

    // Terminal width (default to 120 if not available)
    const terminalWidth = terminal.cols || 120
    const maxLineWidth = terminalWidth - 5 // Leave some margin

    // Clean message (remove trailing newlines for processing)
    let message = line.message.replace(/\n+$/, '')

    // Split message into lines if it contains newlines
    const messageLines = message.split('\n')

    messageLines.forEach((msgLine, index) => {
      if (msgLine.length + prefixDisplayLength <= maxLineWidth) {
        // Line fits - write normally
        if (index === 0) {
          terminal.write(prefix + msgLine + '\r\n')
        } else {
          // Continuation line - add prefix for consistency
          terminal.write(prefix + msgLine + '\r\n')
        }
      } else {
        // Line too long - wrap it
        let remaining = msgLine
        let isFirst = index === 0

        while (remaining.length > 0) {
          const availableWidth = maxLineWidth - (isFirst ? prefixDisplayLength : prefixDisplayLength)
          const chunk = remaining.substring(0, availableWidth)
          remaining = remaining.substring(availableWidth)

          if (isFirst) {
            terminal.write(prefix + chunk + '\r\n')
            isFirst = false
          } else {
            // Wrapped continuation - add prefix
            terminal.write(prefix + chunk + '\r\n')
          }
        }
      }
    })

    setLineCount(prev => prev + messageLines.length)
  }

  // Load terminal history from backend
  const loadTerminalHistory = async () => {
    try {
      const result = await window.electronAPI.terminal.getHistory(projectId)

      if (result.success && result.lines) {
        result.lines.forEach((line: TerminalLine) => {
          writeLineToTerminal(line)
        })
      }
    } catch (error) {
      console.error('Failed to load terminal history:', error)
    }
  }

  // Handle freeze frame when terminal opens/closes
  useEffect(() => {
    const activeProjectId = projectId || currentProjectId

    const handleFreezeFrame = async () => {
      if (isOpen && activeProjectId) {
        // Opening terminal - activate freeze frame
        if (layoutState === 'STATUS_EXPANDED' && thumbnailData) {
          // Use existing thumbnail when in STATUS_EXPANDED
          setModalFreezeImage(thumbnailData)
          setModalFreezeActive(true)
        } else {
          // Capture and freeze for other states
          const result = await window.electronAPI?.layout.captureModalFreeze(activeProjectId)
          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(activeProjectId)
          }
        }
      } else {
        // Closing terminal - deactivate freeze frame
        setModalFreezeActive(false)
        if (activeProjectId && layoutState !== 'STATUS_EXPANDED') {
          await window.electronAPI?.preview.show(activeProjectId)
        }
      }
    }

    handleFreezeFrame()
  }, [isOpen, projectId, currentProjectId, layoutState, thumbnailData, setModalFreezeActive, setModalFreezeImage])

  // Initialize xterm.js terminal
  useEffect(() => {
    if (!isOpen) return
    if (!terminalRef.current) {
      return
    }
    if (xtermRef.current) {
      return
    }

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0e14',
        foreground: '#e5e7eb',
        cursor: '#FFD700',
        black: '#0a0e14',
        red: '#ff6b6b',
        green: '#10B981',
        yellow: '#ffd93d',
        blue: '#6495ED',
        magenta: '#f472b6',
        cyan: '#06b6d4',
        white: '#e5e7eb',
        brightBlack: '#6b7280',
        brightRed: '#fca5a5',
        brightGreen: '#34d399',
        brightYellow: '#fde047',
        brightBlue: '#93c5fd',
        brightMagenta: '#f9a8d4',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
      scrollback: 1000,
      convertEol: true,
    })

    // Create fit addon
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    // Open terminal in DOM
    terminal.open(terminalRef.current)
    fitAddon.fit()

    // Store refs
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Write beautiful ASCII art banner in a box
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    const version = 'v1.1'

    terminal.writeln('')
    terminal.writeln('')

    // Top border
    terminal.writeln('\x1b[36m┌─────────────────────────────────────────────────────────────────────────────────────────┐\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')

    // CodeDesk ASCII logo (cyan)
    terminal.writeln('\x1b[36m│\x1b[0m     \x1b[36m█████████               █████          ██████████                     █████\x1b[0m         \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m    \x1b[36m███▒▒▒▒▒███             ▒▒███          ▒▒███▒▒▒▒███                   ▒▒███\x1b[0m          \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m   \x1b[36m███     ▒▒▒   ██████   ███████   ██████  ▒███   ▒▒███  ██████   ██████  ▒███ █████\x1b[0m    \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[36m▒███          ███▒▒███ ███▒▒███  ███▒▒███ ▒███    ▒███ ███▒▒███ ███▒▒███ ▒███▒▒███\x1b[0m     \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[36m▒███         ▒███ ▒███▒███ ▒███ ▒███████  ▒███    ▒███▒███████ ▒███ ▒▒▒  ▒██████▒\x1b[0m      \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[36m▒▒███     ███▒███ ▒███▒███ ▒███ ▒███▒▒▒   ▒███    ███ ▒███▒▒▒  ▒███  ███ ▒███▒▒███\x1b[0m     \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m   \x1b[36m▒▒█████████ ▒▒██████ ▒▒████████▒▒██████  ██████████  ▒▒██████ ▒▒██████  ████ █████\x1b[0m    \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m    \x1b[36m▒▒▒▒▒▒▒▒▒   ▒▒▒▒▒▒   ▒▒▒▒▒▒▒▒  ▒▒▒▒▒▒  ▒▒▒▒▒▒▒▒▒▒    ▒▒▒▒▒▒   ▒▒▒▒▒▒  ▒▒▒▒ ▒▒▒▒▒\x1b[0m     \x1b[36m│\x1b[0m')

    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')

    // Info section
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mProject:\x1b[0m ' + projectName.padEnd(77) + ' \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mVersion:\x1b[0m ' + version.padEnd(77) + ' \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mSession:\x1b[0m ' + timestamp.padEnd(77) + ' \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mSources:\x1b[0m ' + 'Dev Server, Shell, NPM, Git, Claude, User'.padEnd(77) + ' \x1b[36m│\x1b[0m')

    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')

    // Bottom border
    terminal.writeln('\x1b[36m└─────────────────────────────────────────────────────────────────────────────────────────┘\x1b[0m')
    terminal.writeln('')

    // Load history if exists
    loadTerminalHistory()

    // Cleanup
    return () => {
      terminal.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [isOpen, projectId])

  // Listen for new terminal lines
  useEffect(() => {
    if (!isOpen) return

    const handleTerminalLine = (receivedProjectId: string, line: TerminalLine) => {
      if (receivedProjectId !== projectId) return

      writeLineToTerminal(line)
    }

    const handleTerminalCleared = (receivedProjectId: string) => {
      if (receivedProjectId !== projectId) return

      xtermRef.current?.clear()
      setLineCount(0)
    }

    const unsubLine = window.electronAPI.terminal.onLine(handleTerminalLine)
    const unsubCleared = window.electronAPI.terminal.onCleared(handleTerminalCleared)

    return () => {
      unsubLine?.()
      unsubCleared?.()
    }
  }, [isOpen, projectId])

  // Handle window resize
  useEffect(() => {
    if (!isOpen || !fitAddonRef.current) return

    const handleResize = () => {
      setTimeout(() => {
        fitAddonRef.current?.fit()
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Fit on open

    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, isMaximized])

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

  // Handle clear
  const handleClear = async () => {
    xtermRef.current?.clear()
    setLineCount(0)

    // Clear backend buffer
    await window.electronAPI.terminal.clear(projectId)
  }

  // Handle copy
  const handleCopy = () => {
    if (!xtermRef.current) return

    const selection = xtermRef.current.getSelection()
    if (selection) {
      navigator.clipboard.writeText(selection)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Handle command input submit
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!commandInput.trim()) return

    // Write command to terminal (echo)
    if (xtermRef.current) {
      const prompt = '\x1b[32m$\x1b[0m '
      xtermRef.current.writeln(prompt + commandInput)
    }

    // Send to backend
    await window.electronAPI.terminal.writeInput(projectId, commandInput)

    // Clear input
    setCommandInput('')
  }

  // Handle command input key down
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent ESC from closing modal when in input
    if (e.key === 'Escape') {
      e.stopPropagation()
      setCommandInput('')
    }
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
        {/* Background Image */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-bg/50 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TerminalIcon size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Unified Terminal - <span className="text-primary">{projectName}</span>
              </h2>
              <p className="text-[10px] text-gray-500">All Operations - Dev Server, Shell, NPM, Git</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-dark-bg/70 rounded-lg transition-all group relative"
              title="Copy selection"
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
                title="Stop dev server"
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

        {/* Terminal Content (xterm.js) */}
        <div className="flex-1 overflow-hidden bg-[#0a0e14] relative z-10">
          <div ref={terminalRef} className="h-full w-full p-2" />
        </div>

        {/* Command Input */}
        <form onSubmit={handleCommandSubmit} className="border-t border-dark-border bg-dark-bg/30 relative z-10">
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-green-400 text-sm font-mono">$</span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a command and press Enter..."
              className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder:text-gray-600"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!commandInput.trim()}
              className="p-1.5 hover:bg-primary/10 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Run command"
            >
              <Send size={14} className="text-primary" />
            </button>
          </div>
        </form>

        {/* Terminal Footer - Info Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-dark-border bg-dark-bg/30 relative z-10">
          <div className="flex items-center gap-4 text-[10px]">
            <span className="text-gray-500">Lines: <span className="text-white">{lineCount}</span></span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-500">Project: <span className="text-primary">{projectId}</span></span>
          </div>
          <div className="text-[10px] text-gray-500">
            Press <kbd className="px-1.5 py-0.5 bg-dark-bg border border-dark-border rounded text-[9px]">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )
}

export default TerminalModal
