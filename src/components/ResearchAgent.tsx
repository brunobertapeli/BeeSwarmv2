import { useState, useEffect, useRef, forwardRef } from 'react'
import { ChevronDown, ChevronUp, Send, Bug, Shield, Globe, FileCode, Lightbulb, Search, Loader2 } from 'lucide-react'
import ContentEditableInput, { type ContentEditableInputRef, type Pill } from './ContentEditableInput'

interface ResearchAgentProps {
  projectId?: string
  onStatusClick?: () => void
}

// Agent types with placeholders
const AGENT_TYPES = [
  {
    value: 'bug-finder',
    label: 'Bug Finder',
    icon: Bug,
    placeholder: 'Find bugs in your codebase...'
  },
  {
    value: 'code-auditor',
    label: 'Code Auditor',
    icon: Shield,
    placeholder: 'Audit code for security vulnerabilities...'
  },
  {
    value: 'web-searcher',
    label: 'Web Searcher',
    icon: Globe,
    placeholder: 'Search the web for documentation and resources...'
  },
  {
    value: 'api-researcher',
    label: 'API Researcher',
    icon: FileCode,
    placeholder: 'Research and compare APIs for your project...'
  },
  {
    value: 'feature-planner',
    label: 'Feature Planner',
    icon: Lightbulb,
    placeholder: 'Plan implementation steps for a new feature...'
  },
  {
    value: 'researcher',
    label: 'Researcher',
    icon: Search,
    placeholder: 'Research any topic or question...'
  },
]

// Helper to get display name from model ID
const getModelDisplayName = (modelId: string): string => {
  if (modelId.includes('sonnet')) return 'Sonnet 4.5'
  if (modelId.includes('opus')) return 'Opus 4.1'
  if (modelId.includes('haiku')) return 'Haiku 4.5'
  return modelId
}

const ResearchAgent = forwardRef<HTMLDivElement, ResearchAgentProps>(({ projectId, onStatusClick }, ref) => {
  const [isVisible, setIsVisible] = useState(false)
  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-5-20251101')
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [selectedAgentType, setSelectedAgentType] = useState('bug-finder')
  const [showAgentTypeDropdown, setShowAgentTypeDropdown] = useState(false)
  const [message, setMessage] = useState('')
  const [agents, setAgents] = useState<any[]>([])
  const [attachments, setAttachments] = useState<Array<{id: string, type: 'image' | 'file', name: string, preview?: string}>>([])
  const [isWorking, setIsWorking] = useState(false)
  const textareaRef = useRef<ContentEditableInputRef>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const agentTypeDropdownRef = useRef<HTMLDivElement>(null)

  // Real agent data
  const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'starting')
  const finishedAgents = agents.filter(a => a.status === 'finished')
  const workingCount = activeAgents.length
  const finishedCount = finishedAgents.length

  useEffect(() => {
    // Slide up animation on mount
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Load available models on mount
  useEffect(() => {
    window.electronAPI?.claude.getModels().then((result) => {
      if (result.success && result.models) {
        setAvailableModels(result.models)
      }
    })
  }, [])

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
      if (agentTypeDropdownRef.current && !agentTypeDropdownRef.current.contains(event.target as Node)) {
        setShowAgentTypeDropdown(false)
      }
    }

    if (showModelDropdown || showAgentTypeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown, showAgentTypeDropdown])

  const handleSend = async () => {
    if (!message.trim() || !projectId || isWorking) return

    setIsWorking(true)

    try {
      // Start research agent
      const result = await window.electronAPI?.researchAgent.start(
        projectId,
        selectedAgentType as any,
        message.trim(),
        selectedModel
        // TODO: Add attachments support
      )

      if (result?.success) {
        // Clear message and attachments
        setMessage('')
        setAttachments([])

        // Reload agents list
        const listResult = await window.electronAPI?.researchAgent.getList(projectId)
        if (listResult?.success && listResult.agents) {
          setAgents(listResult.agents)
        }
      } else {
        console.error('Failed to start research agent:', result?.error)
      }
    } catch (error) {
      console.error('Error starting research agent:', error)
    } finally {
      setIsWorking(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Build unified pills array from attachments
  const buildPills = (): Pill[] => {
    return attachments.map((att) => ({
      id: `attachment-${att.id}`,
      type: att.type === 'image' ? 'attachment-image' : 'attachment-file',
      label: att.name,
      preview: att.preview,
      tooltip: att.name,
    }))
  }

  // Handle pill removal
  const handleRemovePill = (id: string) => {
    if (id.startsWith('attachment-')) {
      const attId = id.replace('attachment-', '')
      setAttachments(attachments.filter(a => a.id !== attId))
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items

    // Check for images
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = items[i].getAsFile()
        if (blob) {
          const reader = new FileReader()
          reader.onload = (event) => {
            const preview = event.target?.result as string
            setAttachments([...attachments, {
              id: Math.random().toString(36),
              type: 'image',
              name: blob.name || 'pasted-image.png',
              preview
            }])
          }
          reader.readAsDataURL(blob)
        }
        return
      }
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

    for (const file of files) {
      if (validImageTypes.includes(file.type)) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const preview = event.target?.result as string
          setAttachments(prev => [...prev, {
            id: Math.random().toString(36),
            type: 'image',
            name: file.name,
            preview
          }])
        }
        reader.readAsDataURL(file)
      }
    }
  }

  return (
    <>
      {/* Research Agent */}
      <div
        ref={ref}
        className={`absolute z-[100] transition-all duration-500 ease-out ${
          isVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-32 opacity-0'
        }`}
        style={{ left: '5px', right: '5px', bottom: '5px', height: '150px' }}
      >
        <div className="bg-dark-card border border-dark-border/80 shadow-2xl overflow-visible w-full h-full relative flex flex-col rounded-bl-[10px]">
          {/* Top Row - Textarea with Send Icon Inside */}
          <div className="pt-2.5 pb-2 flex-1 min-h-0">
            <div className="relative flex items-start h-full mx-3">
              <ContentEditableInput
                ref={textareaRef}
                value={message}
                onChange={(value) => setMessage(value)}
                pills={buildPills()}
                onRemovePill={handleRemovePill}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                placeholder={AGENT_TYPES.find(t => t.value === selectedAgentType)?.placeholder || 'Ask AI agent...'}
                disabled={false}
                className="flex-1 h-full border rounded-xl pr-11 text-sm outline-none transition-all overflow-hidden bg-dark-bg/50 text-white placeholder-gray-500 border-dark-border/50 focus:border-primary/30"
              />
              {isWorking ? (
                <div className="absolute right-3 bottom-2.5">
                  <div className="relative w-[18px] h-[18px] overflow-hidden">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <Loader2 size={18} className="text-primary animate-spin relative z-10" />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || isWorking}
                  className={`absolute right-3 bottom-2.5 ${
                    message.trim() && !isWorking
                      ? 'text-primary hover:text-primary-dark cursor-pointer'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row - Model, Agent Type Dropdowns and Status Tracker */}
          <div className="flex items-center justify-between gap-1.5 px-3 pb-2.5 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {/* Model Dropdown */}
              <div className="relative" ref={modelDropdownRef}>
                <button
                  onClick={() => setShowModelDropdown(!showModelDropdown)}
                  className="bg-dark-bg/30 border border-dark-border/30 rounded-lg pl-2.5 pr-7 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer relative flex items-center gap-1.5"
                >
                  <span>
                    {availableModels.length > 0
                      ? availableModels.find(m => m.value === selectedModel)?.displayName || getModelDisplayName(selectedModel)
                      : getModelDisplayName(selectedModel)}
                  </span>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {showModelDropdown && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[200]" onClick={() => setShowModelDropdown(false)} />

                    {/* Menu */}
                    <div className="absolute bottom-full left-0 mb-1 w-40 bg-dark-card border border-dark-border rounded-lg shadow-xl z-[201] overflow-hidden">
                      <div className="p-1">
                        {(availableModels.length > 0 ? availableModels : [
                          { value: 'claude-opus-4-5-20251101', displayName: 'Sonnet 4.5' },
                          { value: 'claude-opus-4-5-20251101', displayName: 'Opus 4.5' },
                          { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5' }
                        ]).map((model) => (
                          <button
                            key={model.value}
                            onClick={() => {
                              setSelectedModel(model.value)
                              setShowModelDropdown(false)
                            }}
                            className={`w-full px-2.5 py-1.5 rounded text-left text-[11px] transition-colors ${
                              selectedModel === model.value
                                ? 'bg-primary/20 text-primary'
                                : 'text-gray-300 hover:bg-dark-bg/50'
                            }`}
                          >
                            {model.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Agent Type Dropdown */}
              <div className="relative" ref={agentTypeDropdownRef}>
                <button
                  onClick={() => setShowAgentTypeDropdown(!showAgentTypeDropdown)}
                  className="bg-dark-bg/30 border border-dark-border/30 rounded-lg pl-2.5 pr-7 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer relative flex items-center gap-1.5"
                >
                  <span>
                    {AGENT_TYPES.find(a => a.value === selectedAgentType)?.label || 'Select Agent'}
                  </span>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500" />
                </button>

                {/* Dropdown Menu */}
                {showAgentTypeDropdown && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-[200]" onClick={() => setShowAgentTypeDropdown(false)} />

                    {/* Menu */}
                    <div className="absolute bottom-full left-0 mb-1 w-44 bg-dark-card border border-dark-border rounded-lg shadow-xl z-[201] overflow-hidden">
                      <div className="p-1 overflow-y-auto scrollbar-thin" style={{ height: '132px' }}>
                        {AGENT_TYPES.map((agent) => {
                          const IconComponent = agent.icon
                          return (
                            <button
                              key={agent.value}
                              onClick={() => {
                                setSelectedAgentType(agent.value)
                                setShowAgentTypeDropdown(false)
                              }}
                              className={`w-full px-2.5 py-1.5 rounded text-left text-[11px] transition-colors flex items-center gap-2 ${
                                selectedAgentType === agent.value
                                  ? 'bg-primary/20 text-primary'
                                  : 'text-gray-300 hover:bg-dark-bg/50'
                              }`}
                            >
                              <IconComponent size={14} />
                              <span>{agent.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Agent Status Tracker */}
            <button
              onClick={onStatusClick}
              className="bg-dark-bg/30 border border-dark-border/30 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="flex items-center gap-1">
                <span className="text-primary font-medium">{workingCount}</span>
                <span>working</span>
                <span className="text-gray-500">/</span>
                <span className="text-green-500 font-medium">{finishedCount}</span>
                <span>finished</span>
              </span>
              <ChevronUp size={12} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
})

ResearchAgent.displayName = 'ResearchAgent'

export default ResearchAgent
