import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Bug, Shield, Globe, FileCode, Lightbulb, Search, CheckCircle2, Clock, Loader, Archive, ArrowLeft, Copy, Check } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import ReactMarkdown from 'react-markdown'

interface ResearchAgentStatusSheetProps {
  projectId?: string
  researchAgentRef?: React.RefObject<HTMLDivElement>
  isExpanded?: boolean
  onToggleExpand?: () => void
}

// Agent types with icons
const AGENT_TYPES = [
  { value: 'bug-finder', label: 'Bug Finder', icon: Bug },
  { value: 'code-auditor', label: 'Code Auditor', icon: Shield },
  { value: 'web-searcher', label: 'Web Searcher', icon: Globe },
  { value: 'api-researcher', label: 'API Researcher', icon: FileCode },
  { value: 'feature-planner', label: 'Feature Planner', icon: Lightbulb },
  { value: 'researcher', label: 'Researcher', icon: Search },
]

function ResearchAgentStatusSheet({ projectId, researchAgentRef, isExpanded = false, onToggleExpand }: ResearchAgentStatusSheetProps) {
  const { layoutState, setModalFreezeActive, setModalFreezeImage } = useLayoutStore()
  const [isVisible, setIsVisible] = useState(false)
  const [researchAgentHeight, setResearchAgentHeight] = useState(0)
  const [agents, setAgents] = useState<any[]>([])
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [isCapturingFreeze, setIsCapturingFreeze] = useState(false)
  const statusSheetRef = useRef<HTMLDivElement>(null)

  const handleToggleExpand = async () => {
    // If collapsing, just toggle immediately
    if (isExpanded) {
      if (onToggleExpand) {
        onToggleExpand()
      }
      return
    }

    // If expanding, show loading and capture freeze FIRST
    setIsCapturingFreeze(true)

    if (projectId && layoutState === 'DEFAULT') {
      try {
        const result = await window.electronAPI?.layout.captureModalFreeze(projectId)
        if (result?.success && result.freezeImage) {
          setModalFreezeImage(result.freezeImage)
          setModalFreezeActive(true)
          await window.electronAPI?.preview.hide(projectId)
        }
      } catch (error) {
        console.error('Failed to capture freeze on expand:', error)
      }
    }

    // Now toggle (freeze is ready)
    setIsCapturingFreeze(false)
    if (onToggleExpand) {
      onToggleExpand()
    }
  }

  const handleStopAgent = async (agentId: string) => {
    try {
      await window.electronAPI?.researchAgent.stop(agentId)
    } catch (error) {
      console.error('Error stopping agent:', error)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await window.electronAPI?.researchAgent.delete(agentId)
      // Remove from list
      setAgents(prev => prev.filter(a => a.id !== agentId))
    } catch (error) {
      console.error('Error deleting agent:', error)
    }
  }

  // Helper to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  // Real agent data
  const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'starting').map(a => ({
    ...a,
    startTime: formatTimeAgo(a.startTime)
  }))
  const finishedAgents = agents.filter(a => a.status === 'finished').map(a => ({
    ...a,
    completedTime: a.endTime ? formatTimeAgo(a.endTime) : 'Unknown',
    briefDescription: a.briefDescription || 'Analysis complete'
  }))
  const hasHistory = activeAgents.length > 0 || finishedAgents.length > 0

  // Handle agent click to view details
  const handleAgentClick = (agent: any) => {
    setSelectedAgent(agent)
  }

  // Handle back to list
  const handleBackToList = () => {
    setSelectedAgent(null)
    setCopiedAll(false)
    setCopiedIndex(null)
  }

  // Copy to clipboard
  const handleCopy = async (text: string, isAll = false, index: number | null = null) => {
    try {
      await navigator.clipboard.writeText(text)
      if (isAll) {
        setCopiedAll(true)
        setTimeout(() => setCopiedAll(false), 2000)
      } else if (index !== null) {
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Format action/finding for copying
  const formatActionForCopy = (action: any, agentType: string) => {
    let text = ''

    if (agentType === 'bug-finder' || agentType === 'code-auditor') {
      if (action.severity) text += `Severity: ${action.severity}\n`
      if (action.type) text += `Type: ${action.type}\n`
      if (action.vulnerability) text += `Vulnerability: ${action.vulnerability}\n`
      if (action.file) text += `File: ${action.file}${action.line ? `:${action.line}` : ''}\n`
      if (action.description) text += `\nDescription:\n${action.description}\n`
      if (action.impact) text += `\nImpact:\n${action.impact}\n`
      if (action.recommendation) text += `\nRecommendation:\n${action.recommendation}\n`
    } else if (agentType === 'api-researcher') {
      if (action.name) text += `${action.name}\n`
      if (action.url) text += `${action.url}\n`
      if (action.description) text += `\n${action.description}\n`
      if (action.pros) text += `\nPros:\n${action.pros.map((p: string) => `- ${p}`).join('\n')}\n`
      if (action.cons) text += `\nCons:\n${action.cons.map((c: string) => `- ${c}`).join('\n')}\n`
      if (action.recommendation) text += `\nRecommendation: ${action.recommendation}\n`
    } else if (agentType === 'feature-planner') {
      if (action.order) text += `Step ${action.order}: `
      if (action.title) text += `${action.title}\n`
      if (action.description) text += `\n${action.description}\n`
      if (action.files) text += `\nFiles: ${action.files.join(', ')}\n`
      if (action.complexity) text += `Complexity: ${action.complexity}\n`
    }

    return text
  }

  // Copy all actions/findings
  const handleCopyAll = () => {
    if (!selectedAgent) return

    let allText = `${selectedAgent.task}\n\n`

    if (selectedAgent.briefDescription) {
      allText += `Summary: ${selectedAgent.briefDescription}\n\n`
    }

    if (selectedAgent.findings) {
      // For web-searcher and researcher
      allText += selectedAgent.findings
    } else if (selectedAgent.actions && Array.isArray(selectedAgent.actions)) {
      // For bug-finder, code-auditor, api-researcher, feature-planner
      selectedAgent.actions.forEach((action: any, index: number) => {
        allText += `\n--- ${index + 1} ---\n`
        allText += formatActionForCopy(action, selectedAgent.agentType)
      })
    }

    handleCopy(allText, true)
  }

  // Load agents for this project
  useEffect(() => {
    if (!projectId) return

    const loadAgents = async () => {
      const result = await window.electronAPI?.researchAgent.getList(projectId)
      if (result?.success && result.agents) {
        setAgents(result.agents)
      }
    }

    loadAgents()
  }, [projectId])

  // Listen for agent updates
  useEffect(() => {
    if (!projectId) return

    const unsubStatus = window.electronAPI?.researchAgent.onStatusChanged((agentId, agId, status, agent) => {
      if (agId === projectId) {
        // Update agent in list
        setAgents(prev => {
          const index = prev.findIndex(a => a.id === agentId)
          if (index >= 0) {
            const updated = [...prev]
            updated[index] = agent
            return updated
          } else {
            // New agent, add to list
            return [...prev, agent]
          }
        })
      }
    })

    const unsubCompleted = window.electronAPI?.researchAgent.onCompleted((agentId, agId) => {
      if (agId === projectId) {
        // Reload agents to get final state
        window.electronAPI?.researchAgent.getList(projectId).then((result) => {
          if (result?.success && result.agents) {
            setAgents(result.agents)
          }
        })
      }
    })

    return () => {
      unsubStatus?.()
      unsubCompleted?.()
    }
  }, [projectId])

  // Track research agent height for positioning
  useEffect(() => {
    if (!researchAgentRef?.current) return

    const updateHeight = () => {
      const height = researchAgentRef.current?.offsetHeight || 0
      setResearchAgentHeight(height)
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(researchAgentRef.current)

    return () => observer.disconnect()
  }, [researchAgentRef])

  // Show after a brief delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  // Handle preview freeze when expanding/collapsing
  useEffect(() => {
    const handlePreviewVisibility = async () => {
      if (!projectId) {
        return
      }

      // DEFAULT state: Control preview visibility based on expanded state
      if (layoutState === 'DEFAULT') {
        if (!isExpanded) {
          // StatusSheet collapsed in DEFAULT → deactivate freeze, show preview
          setModalFreezeActive(false)
          await window.electronAPI?.preview.show(projectId)
        }
        // Note: Freeze capture when expanding is now handled in handleToggleExpand() for better performance
      }
    }

    handlePreviewVisibility()
  }, [layoutState, isExpanded, projectId, setModalFreezeActive])


  // Auto-collapse when clicking outside
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is inside StatusSheet
      const clickedInsideSheet = statusSheetRef.current?.contains(target)

      // Check if click is inside ResearchAgent
      const clickedInsideAgent = researchAgentRef?.current?.contains(target)

      // If clicked outside both, collapse
      if (!clickedInsideSheet && !clickedInsideAgent) {
        handleToggleExpand()
      }
    }

    // Add listener with slight delay to avoid collapsing on the expand click itself
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, researchAgentRef, handleToggleExpand])

  // Calculate bottom position based on research agent height
  const baseOffset = -21 // Gap between research agent and status sheet
  const bottomPosition = isVisible
    ? (researchAgentHeight > 0 ? researchAgentHeight + baseOffset : 95)
    : (researchAgentHeight > 0 ? researchAgentHeight - 14 : 75)

  // For now, always show (in production, check if has research history)
  const shouldRender = true

  return (
    <>
      {shouldRender && (
        <div
          className={`absolute z-[99] pointer-events-none ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            left: '5px',
            right: '5px',
            bottom: `${bottomPosition + 5}px`,
            transition: 'opacity 300ms ease-out'
          }}
        >
          <div
            ref={statusSheetRef}
            className="bg-dark-card border border-dark-border shadow-2xl w-full overflow-hidden pb-4 relative pointer-events-auto"
            style={{
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Collapsed State - Single Clickable Row */}
            {!isExpanded && (
              <div
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors relative z-10 ${isCapturingFreeze ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={handleToggleExpand}
              >
                <span className="text-xs text-gray-400 flex-1">AI Agents</span>
                <ChevronUp size={14} className="text-gray-400" />
              </div>
            )}

            {/* Expanded State */}
            {isExpanded && (
              <div className="relative z-10">
                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-dark-border/50"
                  onClick={selectedAgent ? handleBackToList : handleToggleExpand}
                >
                  {selectedAgent && (
                    <ArrowLeft size={14} className="text-gray-400" />
                  )}
                  <span className="text-xs text-gray-200 font-medium flex-1">
                    {selectedAgent ? 'Agent Details' : 'AI Agent Activity'}
                  </span>
                  {!selectedAgent && (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="px-4 py-3 max-h-[500px] overflow-y-auto scrollbar-thin">
                  {/* Detail View */}
                  {selectedAgent ? (
                    <div className="space-y-4">
                      {/* Agent Header */}
                      <div className="flex items-start gap-3 pb-3 border-b border-dark-border/30">
                        <div className="flex-shrink-0 mt-0.5">
                          {(() => {
                            const agentType = AGENT_TYPES.find(a => a.value === selectedAgent.agentType)
                            const IconComponent = agentType?.icon || Search
                            return (
                              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <IconComponent size={18} className="text-green-500/70" />
                              </div>
                            )
                          })()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-200 font-medium mb-1">{selectedAgent.task}</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-gray-600">{AGENT_TYPES.find(a => a.value === selectedAgent.agentType)?.label}</span>
                            <span className="text-gray-600">•</span>
                            <span className="text-gray-600">{selectedAgent.endTime ? formatTimeAgo(selectedAgent.endTime) : 'Unknown'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Brief Description */}
                      {selectedAgent.briefDescription && (
                        <div>
                          <div className="text-xs text-gray-400 mb-2 font-medium">Summary</div>
                          <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20">
                            <p className="text-xs text-green-400/90">{selectedAgent.briefDescription}</p>
                          </div>
                        </div>
                      )}

                      {/* Full Result/Summary */}
                      {(selectedAgent.summary || selectedAgent.result) && (
                        <div>
                          <div className="text-xs text-gray-400 mb-2 font-medium">Detailed Analysis</div>
                          <div className="px-3 py-2.5 rounded-lg bg-dark-bg/30 border border-dark-border/30">
                            <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                              {selectedAgent.summary || selectedAgent.result}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Findings (web-searcher, researcher) */}
                      {(selectedAgent.agentType === 'web-searcher' || selectedAgent.agentType === 'researcher') && selectedAgent.findings && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-400 font-medium">Findings</div>
                            <button
                              onClick={handleCopyAll}
                              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-bg/50 transition-colors group"
                              title="Copy All"
                            >
                              {copiedAll ? (
                                <>
                                  <Check size={12} className="text-green-400" />
                                  <span className="text-[10px] text-green-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} className="text-gray-500 group-hover:text-gray-300" />
                                  <span className="text-[10px] text-gray-500 group-hover:text-gray-300">Copy All</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="px-3 py-2.5 rounded-lg bg-dark-bg/30 border border-dark-border/30 prose prose-invert prose-sm max-w-none">
                            <div className="text-[11px] text-gray-300">
                              <ReactMarkdown
                                components={{
                                  a: ({node, ...props}) => <a {...props} className="text-primary hover:text-primary/80 underline" target="_blank" rel="noopener noreferrer" />,
                                  h2: ({node, ...props}) => <h2 {...props} className="text-sm font-semibold text-gray-200 mt-4 mb-2" />,
                                  h3: ({node, ...props}) => <h3 {...props} className="text-xs font-semibold text-gray-300 mt-3 mb-1" />,
                                  ul: ({node, ...props}) => <ul {...props} className="list-disc pl-4 space-y-1" />,
                                  ol: ({node, ...props}) => <ol {...props} className="list-decimal pl-4 space-y-1" />,
                                  code: ({node, ...props}) => <code {...props} className="bg-dark-bg/50 px-1 py-0.5 rounded text-[10px] font-mono" />,
                                  p: ({node, ...props}) => <p {...props} className="mb-2" />,
                                  li: ({node, ...props}) => <li {...props} className="text-gray-300" />,
                                }}
                              >
                                {selectedAgent.findings}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions (bug-finder, code-auditor, api-researcher, feature-planner) */}
                      {(selectedAgent.agentType === 'bug-finder' ||
                        selectedAgent.agentType === 'code-auditor' ||
                        selectedAgent.agentType === 'api-researcher' ||
                        selectedAgent.agentType === 'feature-planner') &&
                       selectedAgent.actions && Array.isArray(selectedAgent.actions) && selectedAgent.actions.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-400 font-medium">
                              {selectedAgent.agentType === 'bug-finder' ? 'Bugs Found' :
                               selectedAgent.agentType === 'code-auditor' ? 'Vulnerabilities Found' :
                               selectedAgent.agentType === 'api-researcher' ? 'API Options' :
                               'Implementation Steps'} ({selectedAgent.actions.length})
                            </div>
                            <button
                              onClick={handleCopyAll}
                              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-dark-bg/50 transition-colors group"
                              title="Copy All"
                            >
                              {copiedAll ? (
                                <>
                                  <Check size={12} className="text-green-400" />
                                  <span className="text-[10px] text-green-400">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} className="text-gray-500 group-hover:text-gray-300" />
                                  <span className="text-[10px] text-gray-500 group-hover:text-gray-300">Copy All</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="space-y-2">
                            {selectedAgent.actions.map((action: any, index: number) => (
                              <div
                                key={index}
                                className="group/card relative px-3 py-2.5 rounded-lg bg-dark-bg/30 border border-dark-border/30"
                              >
                                {/* Copy button for individual card */}
                                <button
                                  onClick={() => handleCopy(formatActionForCopy(action, selectedAgent.agentType), false, index)}
                                  className="absolute top-2 right-2 p-1 rounded hover:bg-dark-bg/50 transition-colors opacity-0 group-hover/card:opacity-100"
                                  title="Copy"
                                >
                                  {copiedIndex === index ? (
                                    <Check size={11} className="text-green-400" />
                                  ) : (
                                    <Copy size={11} className="text-gray-500 hover:text-gray-300" />
                                  )}
                                </button>
                                {/* Severity badge (bug-finder, code-auditor) */}
                                {action.severity && (
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                                      action.severity === 'high' || action.severity === 'critical'
                                        ? 'bg-red-500/10 text-red-400'
                                        : action.severity === 'medium'
                                        ? 'bg-yellow-500/10 text-yellow-400'
                                        : 'bg-blue-500/10 text-blue-400'
                                    }`}>
                                      {action.severity}
                                    </span>
                                    {action.type && (
                                      <span className="text-[9px] text-gray-500">{action.type}</span>
                                    )}
                                  </div>
                                )}

                                {/* File path (bug-finder, code-auditor) */}
                                {action.file && (
                                  <div className="text-[10px] text-gray-400 mb-1 font-mono">
                                    {action.file}{action.line ? `:${action.line}` : ''}
                                  </div>
                                )}

                                {/* Vulnerability name (code-auditor) */}
                                {action.vulnerability && (
                                  <p className="text-[11px] text-red-400 font-medium mb-1">{action.vulnerability}</p>
                                )}

                                {/* Description */}
                                {action.description && (
                                  <p className="text-[11px] text-gray-300 mb-2">{action.description}</p>
                                )}

                                {/* Impact (code-auditor) */}
                                {action.impact && (
                                  <div className="mt-2 pt-2 border-t border-dark-border/30">
                                    <p className="text-[10px] text-gray-500 mb-1 font-medium">Impact:</p>
                                    <p className="text-[10px] text-gray-400">{action.impact}</p>
                                  </div>
                                )}

                                {/* Recommendation */}
                                {action.recommendation && (
                                  <div className="mt-2 pt-2 border-t border-dark-border/30">
                                    <p className="text-[10px] text-gray-500 mb-1 font-medium">Recommendation:</p>
                                    <p className="text-[10px] text-gray-400">{action.recommendation}</p>
                                  </div>
                                )}

                                {/* API specific fields (api-researcher) */}
                                {action.name && (
                                  <p className="text-[11px] text-gray-200 font-medium mb-1">{action.name}</p>
                                )}
                                {action.url && (
                                  <a href={action.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:text-primary/80 underline block mb-1">
                                    {action.url}
                                  </a>
                                )}

                                {/* Feature planner specific fields */}
                                {action.title && (
                                  <p className="text-[11px] text-gray-200 font-medium mb-1">{action.order ? `${action.order}. ` : ''}{action.title}</p>
                                )}
                                {action.complexity && (
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                                    action.complexity === 'high'
                                      ? 'bg-red-500/10 text-red-400'
                                      : action.complexity === 'medium'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-green-500/10 text-green-400'
                                  }`}>
                                    {action.complexity} complexity
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !hasHistory ? (
                    <div className="text-center py-12">
                      <p className="text-xs text-gray-500">No agents running yet</p>
                      <p className="text-[10px] text-gray-600 mt-1">Send a message to start an agent</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Working Agents Section */}
                      {activeAgents.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dark-border/30">
                            <Loader size={12} className="text-primary animate-spin" />
                            <span className="text-xs font-medium text-gray-300">Working ({activeAgents.length})</span>
                          </div>
                          <div className="space-y-2">
                            {activeAgents.map((agent) => {
                              const agentType = AGENT_TYPES.find(a => a.value === agent.agentType)
                              const IconComponent = agentType?.icon || Search

                              return (
                                <div
                                  key={agent.id}
                                  className="group p-3 rounded-lg bg-dark-bg/30 border border-dark-border/30 hover:border-primary/30 hover:bg-dark-bg/40 transition-all"
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Agent Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <IconComponent size={16} className="text-primary" />
                                      </div>
                                    </div>

                                    {/* Agent Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-xs text-gray-200 font-medium leading-relaxed">{agent.task}</p>
                                        <button
                                          onClick={() => handleStopAgent(agent.id)}
                                          className="flex-shrink-0 p-1 hover:bg-dark-bg/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                          title="Stop agent"
                                        >
                                          <Archive size={11} className="text-gray-500 hover:text-gray-300" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px]">
                                        <span className="text-gray-500">{agentType?.label}</span>
                                        <span className="text-gray-600">•</span>
                                        <span className="text-gray-600">{agent.startTime}</span>
                                      </div>
                                      {/* Current Activity */}
                                      {agent.currentActivity && (
                                        <div className="mt-2 px-2 py-1 rounded bg-primary/5 border border-primary/20">
                                          <p className="text-[10px] text-primary/90">{agent.currentActivity}</p>
                                        </div>
                                      )}
                                      {!agent.currentActivity && (
                                        <div className="mt-2 px-2 py-1 rounded bg-dark-bg/30">
                                          <p className="text-[10px] text-gray-500">Analyzing...</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Finished Agents Section */}
                      {finishedAgents.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-dark-border/30">
                            <CheckCircle2 size={12} className="text-green-500" />
                            <span className="text-xs font-medium text-gray-300">Finished ({finishedAgents.length})</span>
                          </div>
                          <div className="space-y-2">
                            {finishedAgents.map((agent) => {
                              const agentType = AGENT_TYPES.find(a => a.value === agent.agentType)
                              const IconComponent = agentType?.icon || Search

                              return (
                                <div
                                  key={agent.id}
                                  className="group p-3 rounded-lg bg-dark-bg/20 border border-dark-border/20 hover:bg-dark-bg/30 hover:border-green-500/20 transition-all cursor-pointer"
                                  onClick={() => handleAgentClick(agent)}
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Agent Icon */}
                                    <div className="flex-shrink-0 mt-0.5">
                                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <IconComponent size={16} className="text-green-500/70" />
                                      </div>
                                    </div>

                                    {/* Agent Info */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-xs text-gray-300 leading-relaxed">{agent.task}</p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteAgent(agent.id)
                                          }}
                                          className="flex-shrink-0 p-1 hover:bg-dark-bg/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                          title="Archive"
                                        >
                                          <Archive size={11} className="text-gray-600 hover:text-gray-400" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] mb-2">
                                        <span className="text-gray-600">{agentType?.label}</span>
                                        <span className="text-gray-600">•</span>
                                        <span className="text-gray-600">{agent.completedTime}</span>
                                      </div>
                                      {/* Brief Description */}
                                      {agent.briefDescription && (
                                        <div className="mt-2 px-2 py-1.5 rounded bg-green-500/5 border border-green-500/20">
                                          <p className="text-[10px] text-green-400/90">{agent.briefDescription}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ResearchAgentStatusSheet
