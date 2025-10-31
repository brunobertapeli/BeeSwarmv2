import { useState, useRef, useEffect } from 'react'
import { Trash2, FileText, Database } from 'lucide-react'

interface ContextUsage {
  current: number
  total: number
  percentage: number
  breakdown: {
    systemPrompt: { tokens: number; percentage: number }
    systemTools: { tokens: number; percentage: number }
    mcpTools: { tokens: number; percentage: number }
    messages: { tokens: number; percentage: number }
    freeSpace: { tokens: number; percentage: number }
    autocompactBuffer: { tokens: number; percentage: number }
  }
}

interface ContextBarProps {
  usage?: ContextUsage
  onClearContext?: () => void
  onCompactContext?: () => void
}

// Mock data - will be replaced with real data from backend
const MOCK_USAGE: ContextUsage = {
  current: 109000,
  total: 200000,
  percentage: 54,
  breakdown: {
    systemPrompt: { tokens: 2300, percentage: 1.2 },
    systemTools: { tokens: 13300, percentage: 6.6 },
    mcpTools: { tokens: 1300, percentage: 0.6 },
    messages: { tokens: 46800, percentage: 23.4 },
    freeSpace: { tokens: 91000, percentage: 45.6 },
    autocompactBuffer: { tokens: 45000, percentage: 22.5 },
  },
}

function ContextBar({ usage = MOCK_USAGE, onClearContext, onCompactContext }: ContextBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`
    }
    return tokens.toString()
  }

  const getBarColor = () => {
    if (usage.percentage >= 80) return 'from-red-500 to-red-600'
    if (usage.percentage >= 60) return 'from-yellow-500 to-yellow-600'
    return 'from-primary to-green-600'
  }

  return (
    <div ref={menuRef} className="relative flex items-center">
      {/* Compact Context Bar */}
      <div
        className="relative group cursor-pointer bg-dark-bg/30 border border-dark-border/30 rounded-lg px-2 py-1.5 hover:border-primary/30 transition-all flex items-center gap-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowMenu(!showMenu)}
      >
        {/* Icon */}
        <Database size={12} className="text-gray-400 flex-shrink-0" />

        {/* Progress Bar Container */}
        <div className="relative w-12 h-1 bg-gray-700/50 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getBarColor()} rounded-full transition-all duration-500`}
            style={{ width: `${usage.percentage}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="text-[10px] font-medium text-gray-400 tabular-nums">
          {usage.percentage}%
        </span>
      </div>

      {/* Hover Tooltip */}
      {showTooltip && !showMenu && (
        <div className="absolute bottom-full right-0 mb-2 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[260px] z-[70] animate-fadeIn">
            {/* Header */}
            <div className="mb-2 pb-2 border-b border-dark-border">
              <p className="text-[11px] font-semibold text-gray-300">
                {formatTokens(usage.current)}/{formatTokens(usage.total)} tokens ({usage.percentage}%)
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">System prompt:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.systemPrompt.tokens)} ({usage.breakdown.systemPrompt.percentage}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">System tools:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.systemTools.tokens)} ({usage.breakdown.systemTools.percentage}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">MCP tools:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.mcpTools.tokens)} ({usage.breakdown.mcpTools.percentage}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Messages:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.messages.tokens)} ({usage.breakdown.messages.percentage}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Free space:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.freeSpace.tokens)} ({usage.breakdown.freeSpace.percentage}%)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Autocompact buffer:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(usage.breakdown.autocompactBuffer.tokens)} ({usage.breakdown.autocompactBuffer.percentage}%)
                </span>
              </div>
            </div>
          </div>
        )}

      {/* Click Menu */}
      {showMenu && (
        <div className="absolute bottom-full right-0 mb-2 bg-dark-card border border-dark-border rounded-lg shadow-2xl overflow-hidden min-w-[180px] z-[70] animate-scaleIn">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCompactContext?.()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-dark-bg/50 transition-colors group"
          >
            <FileText size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
            <div className="flex-1">
              <div className="text-[12px] font-medium text-gray-300 group-hover:text-primary transition-colors">
                Compact Context
              </div>
              <div className="text-[10px] text-gray-500">
                Optimize conversation history
              </div>
            </div>
          </button>

          <div className="border-t border-dark-border" />

          <button
            onClick={(e) => {
              e.stopPropagation()
              onClearContext?.()
              setShowMenu(false)
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-red-500/10 transition-colors group"
          >
            <Trash2 size={14} className="text-gray-400 group-hover:text-red-400 transition-colors" />
            <div className="flex-1">
              <div className="text-[12px] font-medium text-gray-300 group-hover:text-red-400 transition-colors">
                Clear Context
              </div>
              <div className="text-[10px] text-gray-500">
                Start fresh conversation
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

export default ContextBar
