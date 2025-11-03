import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Trash2, Database, Info, X, AlertTriangle } from 'lucide-react'
import type { ClaudeContext } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'

interface ContextBarProps {
  context?: ClaudeContext | null
  onClearContext?: () => void
}

function ContextBar({ context, onClearContext }: ContextBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current)
      }
    }
  }, [])

  const handleShowTooltip = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    setShowTooltip(true)
  }

  const handleHideTooltip = () => {
    // Don't hide if confirmation dialog is open
    if (showConfirmDialog) return

    // Add a small delay to allow moving from bar to tooltip
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(false)
    }, 150)
  }

  const handleClearContext = () => {
    setShowConfirmDialog(true)
  }

  const confirmClearContext = () => {
    onClearContext?.()
    setShowConfirmDialog(false)
    setShowTooltip(false)
  }

  const cancelClearContext = () => {
    setShowConfirmDialog(false)
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`
    }
    return tokens.toString()
  }

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${(cost * 100).toFixed(2)}c`
    return `$${cost.toFixed(3)}`
  }

  // Default baseline tokens (~30% of 200k context window = 61k tokens)
  const defaultBaseline = {
    systemPrompt: 2600,   // System prompt: 2.6k tokens (1.3%)
    systemTools: 13300,   // System tools: 13.3k tokens (6.6%)
    memoryFiles: 45,      // Memory files: 45 tokens (0.0%)
    messages: 8           // Initial messages: 8 tokens (0.0%)
  }

  // Use context baseline if available, otherwise use defaults
  const baseline = context?.baseline || defaultBaseline

  // Calculate usage from context (including baseline system overhead)
  const baselineTokens = baseline.systemPrompt + baseline.systemTools + baseline.memoryFiles + baseline.messages
  const conversationTokens = context ? context.tokens.input + context.tokens.output : 0
  const totalTokens = baselineTokens + conversationTokens
  const contextWindow = context?.contextWindow || 200000
  const percentage = Math.round((totalTokens / contextWindow) * 100)

  const getBarColor = () => {
    if (percentage >= 80) return 'from-red-500 to-red-600'
    if (percentage >= 60) return 'from-yellow-500 to-yellow-600'
    return 'from-primary to-green-600'
  }

  return (
    <div ref={tooltipRef} className="relative flex items-center">
      {/* Compact Context Bar */}
      <div
        className="relative group bg-dark-bg/30 border border-dark-border/30 rounded-lg px-2 py-1.5 hover:border-primary/30 transition-all flex items-center gap-2"
        onMouseEnter={handleShowTooltip}
        onMouseLeave={handleHideTooltip}
      >
        {/* Icon */}
        <Database size={12} className="text-gray-400 flex-shrink-0" />

        {/* Progress Bar Container */}
        <div className="relative w-12 h-1 bg-gray-700/50 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getBarColor()} rounded-full transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="text-[10px] font-medium text-gray-400 tabular-nums">
          {percentage}%
        </span>
      </div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div
          className="absolute bottom-full right-0 mb-2 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[260px] z-[70] animate-fadeIn overflow-hidden"
          onMouseEnter={handleShowTooltip}
          onMouseLeave={handleHideTooltip}
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

            {/* Header with Clear Button */}
            <div className="mb-2 pb-2 border-b border-dark-border flex items-center justify-between gap-3 relative z-10">
              <p className="text-[11px] font-semibold text-gray-300">
                {formatTokens(totalTokens)}/{formatTokens(contextWindow)} ({percentage}%)
              </p>
              <button
                onClick={handleClearContext}
                className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group"
                title="Clear context"
              >
                <Trash2 size={13} className="text-gray-400 group-hover:text-red-400 transition-colors" />
              </button>
            </div>

            {/* Baseline System Usage */}
            <div className="space-y-1.5 mb-2 pb-2 border-b border-dark-border/50 relative z-10">
              <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide mb-1">
                System Baseline
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">System prompt:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(baseline.systemPrompt)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">System tools:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(baseline.systemTools)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Memory files:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(baseline.memoryFiles)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Messages overhead:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(baseline.messages)}
                </span>
              </div>
            </div>

            {/* Conversation Stats */}
            <div className="space-y-1.5 relative z-10">
              <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wide mb-1">
                Conversation
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Input tokens:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(context?.tokens.input || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Output tokens:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(context?.tokens.output || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Cache read:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(context?.tokens.cacheRead || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Cache creation:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {formatTokens(context?.tokens.cacheCreation || 0)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Turns:</span>
                <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                  {context?.turns || 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                <span className="text-[10px] text-gray-400 flex-1">Total cost:</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-300 font-medium tabular-nums">
                    {formatCost(context?.cost || 0)}
                  </span>
                  <div className="group/info relative">
                    <Info size={10} className="text-gray-500 cursor-help" />
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-dark-bg border border-dark-border rounded px-2 py-1 text-[9px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/info:opacity-100 transition-opacity z-[80] shadow-lg">
                      API usage only. Included with Claude Pro/Team plans
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Confirmation Dialog - Use Portal to render at document body */}
      {showConfirmDialog && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
            onClick={cancelClearContext}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl p-6 animate-scaleIn w-full max-w-[420px] overflow-hidden relative">
              {/* Background Image */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />

              {/* Header */}
              <div className="flex items-start gap-3 mb-4 relative z-10">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-white mb-1">
                    Clear Context Window?
                  </h3>
                  <p className="text-[12px] text-gray-400 leading-relaxed">
                    You're about to lose all context from this conversation and start fresh.
                  </p>
                </div>
                <button
                  onClick={cancelClearContext}
                  className="p-1 hover:bg-dark-bg rounded transition-colors"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-dark-bg/50 border border-dark-border/50 rounded-lg p-3 mb-4 relative z-10">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    <span className="text-gray-300 font-medium">Pro tip:</span> Claude automatically compacts your context at ~95% capacity, so you rarely need to clear it manually.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 relative z-10">
                <button
                  onClick={cancelClearContext}
                  className="flex-1 px-4 py-2 bg-dark-bg hover:bg-dark-bg/80 border border-dark-border rounded-lg text-[12px] font-medium text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmClearContext}
                  className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-[12px] font-medium text-red-400 transition-colors"
                >
                  Clear Context
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default ContextBar
