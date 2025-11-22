import { useState, useEffect, useRef } from 'react'
import { X, Trash2, Terminal as TerminalIcon, Copy, Check, Send, Filter, Plus } from 'lucide-react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'
import { ModalPortal } from './ModalPortal'

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
  projectId: string
  projectName: string
  projectPath: string
}

function TerminalModal({ isOpen, onClose, projectId, projectName, projectPath }: TerminalModalProps) {
  const { currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState } = useLayoutStore()
  const [isCopied, setIsCopied] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [lineCount, setLineCount] = useState(0)
  const [filterSource, setFilterSource] = useState<'all' | 'code' | 'git' | 'npm' | 'shell' | 'dev-server'>('all')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  // Tab management
  type TabType = 'unified' | 'terminal'
  interface Tab {
    id: string
    type: TabType
    label: string
  }
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'unified', type: 'unified', label: 'Unified' }])
  const [activeTabId, setActiveTabId] = useState('unified')

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)

  // Store multiple terminal instances (one per terminal tab)
  const terminalInstancesRef = useRef<Map<string, { term: Terminal, fit: FitAddon }>>(new Map())

  // Store container refs for each terminal tab
  const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map())

  // Create new terminal tab
  const createNewTerminalTab = () => {
    const newId = `terminal-${Date.now()}`
    const terminalCount = tabs.filter(t => t.type === 'terminal').length
    const newTab: Tab = {
      id: newId,
      type: 'terminal',
      label: `Terminal ${terminalCount + 1}`
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
  }

  // Close terminal tab
  const closeTab = (tabId: string) => {
    if (tabId === 'unified') return // Can't close unified tab

    // Cleanup terminal instance
    const instance = terminalInstancesRef.current.get(tabId)
    if (instance) {
      instance.term.dispose()
      terminalInstancesRef.current.delete(tabId)
    }

    // Destroy PTY session on backend
    window.electronAPI.terminal.destroyInteractiveSession?.(projectId, tabId)

    // Remove tab
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)

    // Switch to unified if closing active tab
    if (activeTabId === tabId) {
      setActiveTabId('unified')
    }
  }

  // Draw ASCII banner
  const drawBanner = () => {
    if (!xtermRef.current) return

    const terminal = xtermRef.current
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })

    // Wrap path if needed (max 77 chars per line, break on /)
    const wrapPath = (path: string, maxLen: number): string[] => {
      if (path.length <= maxLen) {
        return [path]
      }

      const lines: string[] = []
      let remaining = path

      while (remaining.length > maxLen) {
        // Find the last '/' before maxLen
        let breakPoint = remaining.lastIndexOf('/', maxLen)

        // If no '/' found or it's at position 0, force break at maxLen
        if (breakPoint <= 0) {
          breakPoint = maxLen
        }

        lines.push(remaining.substring(0, breakPoint))
        remaining = remaining.substring(breakPoint)
      }

      // Add remaining part
      if (remaining.length > 0) {
        lines.push(remaining)
      }

      return lines
    }

    const pathLines = wrapPath(projectPath, 77)

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

    // Path with wrapping
    pathLines.forEach((line, index) => {
      if (index === 0) {
        terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mPath:   \x1b[0m ' + line.padEnd(77) + ' \x1b[36m│\x1b[0m')
      } else {
        terminal.writeln('\x1b[36m│\x1b[0m           ' + line.padEnd(77) + ' \x1b[36m│\x1b[0m')
      }
    })

    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mSession:\x1b[0m ' + timestamp.padEnd(77) + ' \x1b[36m│\x1b[0m')
    terminal.writeln('\x1b[36m│\x1b[0m  \x1b[33mSources:\x1b[0m ' + 'Dev Server, Shell, NPM, Git, Claude, User'.padEnd(77) + ' \x1b[36m│\x1b[0m')

    terminal.writeln('\x1b[36m│\x1b[0m                                                                                         \x1b[36m│\x1b[0m')

    // Bottom border
    terminal.writeln('\x1b[36m└─────────────────────────────────────────────────────────────────────────────────────────┘\x1b[0m')
    terminal.writeln('')
  }

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

    // Apply filter
    if (filterSource !== 'all') {
      if (filterSource === 'code' && line.source !== 'user' && line.source !== 'claude') {
        return
      }
      if (filterSource === 'git' && line.source !== 'git') {
        return
      }
      if (filterSource === 'npm' && line.source !== 'npm') {
        return
      }
      if (filterSource === 'shell' && line.source !== 'shell') {
        return
      }
      if (filterSource === 'dev-server' && line.source !== 'dev-server') {
        return
      }
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
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
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
        // Only show browser back if in DEFAULT state
        if (activeProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(activeProjectId)
        }
      }
    }

    handleFreezeFrame()
  }, [isOpen, projectId, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

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

    // Draw initial banner
    drawBanner()

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
  }, [isOpen, projectId, filterSource])

  // Reload terminal when filter changes
  useEffect(() => {
    if (!isOpen || !xtermRef.current) return

    // Clear and redraw with filter
    xtermRef.current.clear()
    drawBanner()
    loadTerminalHistory()
  }, [filterSource])

  // Initialize interactive terminal instances
  useEffect(() => {
    if (!isOpen) return

    const cleanupFunctions: Array<() => void> = []

    tabs.forEach(tab => {
      if (tab.type === 'terminal' && !terminalInstancesRef.current.has(tab.id)) {
        const container = terminalContainersRef.current.get(tab.id)
        if (!container) return

        // Create terminal instance
        const terminal = new Terminal({
          cursorBlink: true,
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

        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        terminal.open(container)
        fitAddon.fit()

        // Store instance
        terminalInstancesRef.current.set(tab.id, { term: terminal, fit: fitAddon })

        // Create PTY session for this terminal
        window.electronAPI.terminal.createInteractiveSession?.(projectId, tab.id)

        // Handle terminal input (user typing)
        terminal.onData((data) => {
          window.electronAPI.terminal.writeInteractiveInput?.(projectId, tab.id, data)
        })

        // Listen for PTY output
        const handleOutput = (receivedProjectId: string, terminalId: string, data: string) => {
          if (receivedProjectId === projectId && terminalId === tab.id) {
            terminal.write(data)
          }
        }

        const unsubscribe = window.electronAPI.terminal.onInteractiveOutput?.(handleOutput)
        if (unsubscribe) {
          cleanupFunctions.push(unsubscribe)
        }
      }
    })

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
    }
  }, [isOpen, tabs, projectId])

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      setTimeout(() => {
        // Resize unified terminal
        fitAddonRef.current?.fit()

        // Resize all interactive terminals
        terminalInstancesRef.current.forEach(({ fit }) => {
          fit.fit()
        })
      }, 100)
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Fit on open

    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

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

  // Handle clear - preserves ASCII header
  const handleClear = async () => {
    xtermRef.current?.clear()
    setLineCount(0)

    // Redraw ASCII banner
    drawBanner()

    // Clear backend buffer
    await window.electronAPI.terminal.clear(projectId)
  }

  // Handle copy - strips timestamp and source tags
  const handleCopy = () => {
    if (!xtermRef.current) return

    const selection = xtermRef.current.getSelection()
    if (selection) {
      // Strip [HH:MM:SS] [Source] prefix from each line
      // Pattern: [XX:XX:XX] [SourceName] actual content
      const cleanedSelection = selection
        .split('\n')
        .map(line => {
          // Match timestamp [HH:MM:SS] and source tag [Source Name]
          // This regex matches: [XX:XX:XX] [any text in brackets]
          const match = line.match(/^\[[\d:]+\]\s+\[[^\]]+\]\s+(.*)$/)
          return match ? match[1] : line
        })
        .join('\n')

      navigator.clipboard.writeText(cleanedSelection)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Handle command input submit
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!commandInput.trim()) return

    // Send to backend (backend will handle echoing through shell output)
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
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* Terminal Modal */}
      <div
        className="relative bg-dark-card border border-dark-border rounded-xl shadow-2xl animate-scaleIn overflow-hidden flex flex-col w-[85vw] max-w-[1400px] h-[75vh]"
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
        <div className="bg-dark-bg/50 relative z-10 border-b border-dark-border">
          {/* Header row with tabs and controls */}
          <div className="flex items-center justify-between px-4 py-2.5">
            {/* Left: Icon + Tabs */}
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TerminalIcon size={14} className="text-primary" />
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1">
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md cursor-pointer transition-all ${
                      activeTabId === tab.id
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-gray-400 hover:text-gray-300 hover:bg-dark-bg/70'
                    }`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <span className="text-xs font-medium">{tab.label}</span>
                    {tab.type === 'terminal' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.id)
                        }}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}

                {/* New Terminal Button */}
                <button
                  onClick={createNewTerminalTab}
                  className="p-1.5 hover:bg-dark-bg/70 rounded-md transition-all group ml-1"
                  title="New terminal"
                >
                  <Plus size={13} className="text-gray-400 group-hover:text-primary transition-colors" />
                </button>
              </div>

              {/* Title/Subtitle - Only show for Unified tab */}
              {activeTabId === 'unified' && (
                <div className="ml-3 border-l border-dark-border/50 pl-3">
                  <h2 className="text-xs font-semibold text-white">
                    Unified Terminal - <span className="text-primary">{projectName}</span>
                  </h2>
                  <p className="text-[10px] text-gray-500">All Operations - Dev Server, Shell, NPM, Git</p>
                </div>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1">
            {/* Filter Dropdown - only show for unified tab */}
            {activeTabId === 'unified' && (
            <>
            <div className="relative">
              <button
                ref={filterButtonRef}
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-2.5 py-1.5 hover:bg-dark-bg/70 rounded-lg transition-all group flex items-center gap-1.5"
                title="Filter by source"
              >
                <Filter size={12} className="text-gray-400 group-hover:text-primary transition-colors" />
                <span className="text-[10px] text-gray-400 group-hover:text-primary transition-colors">
                  {filterSource === 'all' ? 'All' :
                   filterSource === 'code' ? 'Code' :
                   filterSource === 'git' ? 'Git' :
                   filterSource === 'npm' ? 'NPM' :
                   filterSource === 'shell' ? 'Shell' :
                   'Dev Server'}
                </span>
              </button>

              {/* Dropdown Menu - Portal to avoid clipping */}
              {showFilterDropdown && filterButtonRef.current && (
                <ModalPortal>
                  <div
                    className="fixed inset-0 z-[350]"
                    onClick={() => setShowFilterDropdown(false)}
                  >
                    <div
                      className="absolute bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 w-[120px]"
                      style={{
                        top: `${filterButtonRef.current.getBoundingClientRect().bottom + 4}px`,
                        left: `${filterButtonRef.current.getBoundingClientRect().right - 120}px`,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setFilterSource('all'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'all' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => { setFilterSource('code'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'code' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        Code Editing
                      </button>
                      <button
                        onClick={() => { setFilterSource('git'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'git' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        Git
                      </button>
                      <button
                        onClick={() => { setFilterSource('npm'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'npm' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        NPM
                      </button>
                      <button
                        onClick={() => { setFilterSource('shell'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'shell' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        Shell
                      </button>
                      <button
                        onClick={() => { setFilterSource('dev-server'); setShowFilterDropdown(false) }}
                        className={`w-full px-2.5 py-1.5 text-left text-[11px] hover:bg-dark-bg/50 transition-colors ${
                          filterSource === 'dev-server' ? 'text-primary' : 'text-gray-300'
                        }`}
                      >
                        Dev Server
                      </button>
                    </div>
                  </div>
                </ModalPortal>
              )}
            </div>
            </>
            )}

            {/* Copy Button - only show for unified tab */}
            {activeTabId === 'unified' && (
            <>
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
            </>
            )}

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
        </div>

        {/* Terminal Content (xterm.js) */}
        <div className="flex-1 overflow-hidden bg-[#0a0e14] relative z-10 border-t border-dark-border">
          {/* Unified Terminal */}
          <div
            ref={terminalRef}
            className="h-full w-full p-2"
            style={{ display: activeTabId === 'unified' ? 'block' : 'none' }}
          />

          {/* Interactive Terminals */}
          {tabs.filter(t => t.type === 'terminal').map(tab => (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) terminalContainersRef.current.set(tab.id, el)
              }}
              className="h-full w-full"
              style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
            />
          ))}
        </div>

        {/* Command Input - only show for unified tab */}
        {activeTabId === 'unified' && (
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
        )}

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
    </ModalPortal>
  )
}

export default TerminalModal
