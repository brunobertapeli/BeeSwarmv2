import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Loader2, RotateCcw, User, Bot, Square, Rocket, Globe, ExternalLink, CheckCircle2, Check, ArrowDownCircle, ArrowUpCircle, DollarSign, Info, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

// Import workflow icons
import UserIcon from '../assets/images/user.svg'
import AnthropicIcon from '../assets/images/anthropic.svg'
import GitIcon from '../assets/images/git.svg'
import DeployIcon from '../assets/images/deploy.svg'
import bgImage from '../assets/images/bg.jpg'
import successSound from '../assets/sounds/success.wav'

interface ConversationMessage {
  type: 'user' | 'assistant' | 'tool'
  content: string
  timestamp?: Date
  toolName?: string // For highlighting tool names
}

interface DeploymentStage {
  label: string
  isComplete: boolean
}

interface CompletionStats {
  timeSeconds: number
  inputTokens: number
  outputTokens: number
  cost: number
}

interface Action {
  type: 'git_commit' | 'build' | 'dev_server' | 'checkpoint_restore'
  status: 'in_progress' | 'success' | 'error'
  message?: string
  data?: any
  timestamp: number
}

interface ConversationBlock {
  id: string
  type: 'conversation' | 'deployment'
  projectId?: string
  userPrompt?: string
  messages?: ConversationMessage[]
  isComplete: boolean
  commitHash?: string
  filesChanged?: number
  completionStats?: CompletionStats
  summary?: string
  actions?: Action[]
  completionMessage?: string // Final message to show after everything
  // Deployment-specific fields
  deploymentStages?: DeploymentStage[]
  deploymentUrl?: string
}

interface StatusSheetProps {
  projectId?: string
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onStopClick?: () => void
}

function StatusSheet({ projectId, onMouseEnter, onMouseLeave, onStopClick }: StatusSheetProps) {
  const { deploymentStatus } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [allBlocks, setAllBlocks] = useState<ConversationBlock[]>([])
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set())
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [expandedUserPrompts, setExpandedUserPrompts] = useState<Set<string>>(new Set())
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreBlocks, setHasMoreBlocks] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Random loading phrases - use block ID for consistent selection
  const getLoadingPhrase = (blockId: string) => {
    const phrases = [
      'Warming up the engines...',
      'Booting up the code engines...',
      'Charging the circuits...',
      'Activating the neural cores...',
      'Charging the neural network...',
      'Spinning up the AI nodes...',
      'Linking the thought patterns...',
      'Calibrating the reasoning unit...',
      'Optimizing the neural flow...',
    ]
    // Use blockId to get consistent phrase for same block
    const hash = blockId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return phrases[hash % phrases.length]
  }

  // Estimate number of lines in user prompt
  const estimatePromptLines = (text: string): number => {
    if (!text) return 1
    const charsPerLine = 50 // Approximate characters per line
    const explicitLines = text.split('\n').length
    const estimatedLines = Math.ceil(text.length / charsPerLine)
    return Math.max(explicitLines, estimatedLines)
  }

  // Get font size class based on line count
  const getPromptFontSize = (lineCount: number): string => {
    if (lineCount >= 8) return 'text-xs' // Smaller for 8+ lines
    if (lineCount >= 2) return 'text-[13px]' // Medium for 2-3 lines
    return 'text-sm' // Default for 1 line
  }

  // Transform database block to UI block
  const transformBlock = (block: any): ConversationBlock => {
    const messages: ConversationMessage[] = []

    // Add user message
    messages.push({
      type: 'user',
      content: block.userPrompt,
      timestamp: new Date(block.createdAt),
    })

    // Parse and add Claude messages
    if (block.claudeMessages) {
      try {
        const claudeMessages = JSON.parse(block.claudeMessages) as string[]
        claudeMessages.forEach(msg => {
          messages.push({
            type: 'assistant',
            content: msg,
          })
        })
      } catch (e) {
        console.error('Failed to parse Claude messages:', e)
      }
    }

    // If no Claude messages yet, show random loading message
    if (messages.filter(m => m.type === 'assistant').length === 0 && !block.isComplete) {
      messages.push({
        type: 'assistant',
        content: getLoadingPhrase(block.id),
      })
    }

    // Parse and add tool executions
    if (block.toolExecutions) {
      try {
        const toolData = JSON.parse(block.toolExecutions)

        if (block.isComplete) {
          // Completed: toolData might be grouped object or array - handle both
          if (Array.isArray(toolData)) {
            // Group the array
            const grouped: Record<string, number> = {}
            toolData.forEach((tool: any) => {
              grouped[tool.toolName] = (grouped[tool.toolName] || 0) + 1
            })
            const toolMessages = Object.entries(grouped).map(([toolName, count]) =>
              `${count}x ${toolName}`
            ).join(', ')
            // Only add tool message if there's actual content
            if (toolMessages) {
              messages.push({
                type: 'tool',
                content: toolMessages,
              })
            }
          } else {
            // Already grouped
            const toolMessages = Object.entries(toolData).map(([toolName, count]) =>
              `${count}x ${toolName}`
            ).join(', ')
            // Only add tool message if there's actual content
            if (toolMessages) {
              messages.push({
                type: 'tool',
                content: toolMessages,
              })
            }
          }
        } else {
          // In progress: show verbose tool executions
          if (Array.isArray(toolData)) {
            toolData.forEach((tool: any) => {
              let toolMsg = `Claude using tool ${tool.toolName}`
              if (tool.filePath) {
                // Extract just the filename from path
                const fileName = tool.filePath.split('/').pop() || tool.filePath
                toolMsg += ` @ ${fileName}`
              } else if (tool.command) {
                toolMsg += ` @ ${tool.command}`
              }
              messages.push({
                type: 'tool',
                content: toolMsg,
                toolName: tool.toolName, // Store tool name for highlighting
              })
            })
          }
        }
      } catch (e) {
        console.error('Failed to parse tool executions:', e)
      }
    }

    // Parse completion stats
    let completionStats: CompletionStats | undefined
    if (block.completionStats) {
      try {
        completionStats = JSON.parse(block.completionStats)
      } catch (e) {
        console.error('Failed to parse completion stats:', e)
      }
    }

    // Parse actions
    let actions: Action[] | undefined
    if (block.actions) {
      try {
        actions = JSON.parse(block.actions)
      } catch (e) {
        console.error('Failed to parse actions:', e)
      }
    }

    return {
      id: block.id,
      type: 'conversation' as const,
      projectId: block.projectId,
      userPrompt: block.userPrompt,
      messages,
      isComplete: block.isComplete,
      commitHash: block.commitHash || undefined,
      filesChanged: block.filesChanged || undefined,
      completionStats,
      summary: block.summary || undefined,
      actions,
    }
  }

  // Helper to check if a message is long (should be collapsible)
  const isLongMessage = (content: string): boolean => {
    const lines = content.split('\n')
    return lines.length > 2 || content.length > 150
  }

  // Helper to get truncated message
  const getTruncatedMessage = (content: string): string => {
    const lines = content.split('\n')
    if (lines.length > 2) {
      return lines.slice(0, 2).join('\n') + '...'
    }
    if (content.length > 150) {
      return content.slice(0, 150) + '...'
    }
    return content
  }

  // Load more blocks (for infinite scroll)
  const loadMoreBlocks = async () => {
    if (!projectId || !window.electronAPI?.chat || isLoadingMore || !hasMoreBlocks) return

    setIsLoadingMore(true)
    const nextOffset = currentOffset + 20

    try {
      const result = await window.electronAPI.chat.getHistory(projectId, 20, nextOffset)

      if (result.success && result.blocks) {
        const olderBlocks = result.blocks
          .map((block: any) => transformBlock(block))
          .reverse() // Reverse to show oldest first

        if (olderBlocks.length < 20) {
          setHasMoreBlocks(false)
        }

        if (olderBlocks.length > 0) {
          // Save current scroll height before adding blocks
          const scrollContainer = scrollContainerRef.current
          const oldScrollHeight = scrollContainer?.scrollHeight || 0

          // Prepend older blocks
          setAllBlocks(prev => [...olderBlocks, ...prev])
          setCurrentOffset(nextOffset)

          // Maintain scroll position after adding blocks
          setTimeout(() => {
            if (scrollContainer) {
              const newScrollHeight = scrollContainer.scrollHeight
              const heightDiff = newScrollHeight - oldScrollHeight
              scrollContainer.scrollTop = scrollContainer.scrollTop + heightDiff
            }
          }, 0)
        }
      }
    } catch (error) {
      console.error('Failed to load more blocks:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Handle restore to checkpoint
  const handleRestoreCheckpoint = async (block: ConversationBlock) => {
    if (!projectId || !window.electronAPI?.git || !block.commitHash) return

    // Safety check: Validate commit hash
    if (block.commitHash === 'unknown' || block.commitHash.length < 7) {
      console.error(`❌ Invalid commit hash: ${block.commitHash}`)
      alert('Cannot restore: Invalid commit hash')
      return
    }

    // Safety check: Ensure block belongs to current project
    if (block.projectId !== projectId) {
      console.error(`❌ Cannot restore checkpoint from different project. Block project: ${block.projectId}, Current project: ${projectId}`)
      alert('Cannot restore checkpoint from a different project')
      return
    }

    try {
      console.log(`🔄 Restoring to checkpoint ${block.commitHash}...`)
      const result = await window.electronAPI.git.restoreCheckpoint(projectId, block.commitHash)

      if (result.success) {
        console.log(`✅ Successfully restored to checkpoint ${block.commitHash}`)
      } else {
        console.error(`❌ Failed to restore checkpoint: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Error restoring checkpoint:', error)
    }
  }

  // Load initial chat history from database
  useEffect(() => {
    if (!projectId || !window.electronAPI?.chat) return

    // Reset state
    setAllBlocks([])
    setCurrentOffset(0)
    setHasMoreBlocks(true)

    // Load history
    window.electronAPI.chat.getHistory(projectId, 20, 0).then((result) => {
      if (result.success && result.blocks) {
        const conversationBlocks = result.blocks
          .map((block: any) => transformBlock(block))
          .reverse() // Reverse to show oldest first

        setAllBlocks(conversationBlocks)
        setCurrentOffset(0)

        // Check if there are more blocks
        if (conversationBlocks.length < 20) {
          setHasMoreBlocks(false)
        }
      }
    })
  }, [projectId])

  // Listen for real-time chat updates
  useEffect(() => {
    if (!projectId || !window.electronAPI?.chat) return

    const unsubCreated = window.electronAPI.chat.onBlockCreated((id, block) => {
      if (id !== projectId) return

      // Add new block to UI
      const newBlock = transformBlock(block)
      setAllBlocks(prev => [...prev, newBlock])
    })

    const unsubUpdated = window.electronAPI.chat.onBlockUpdated((id, block) => {
      if (id !== projectId) return

      // Update existing block
      setAllBlocks(prev => prev.map(b =>
        b.id === block.id ? transformBlock(block) : b
      ))
    })

    const unsubCompleted = window.electronAPI.chat.onBlockCompleted((id, block) => {
      if (id !== projectId) return

      // Update block with complete data
      setAllBlocks(prev => prev.map(b =>
        b.id === block.id ? transformBlock(block) : b
      ))

      // Check if block was interrupted
      let wasInterrupted = false
      try {
        if (block.claudeMessages) {
          const messages = JSON.parse(block.claudeMessages)
          wasInterrupted = messages.some((m: string) => m.includes('⚠️ Stopped by user'))
        }
      } catch (e) {
        console.error('Failed to parse claude messages:', e)
      }

      // Play success sound and flash icon if not interrupted
      if (!wasInterrupted) {
        // Play success sound
        const audio = new Audio(successSound)
        audio.volume = 0.5
        audio.play().catch(err => console.error('Failed to play sound:', err))

        // Flash app icon if window not focused
        if (window.electronAPI?.app?.flashWindow) {
          window.electronAPI.app.flashWindow()
        }
      }
    })

    return () => {
      unsubCreated()
      unsubUpdated()
      unsubCompleted()
    }
  }, [projectId])

  // Add deployment block when deployment starts
  useEffect(() => {
    if (deploymentStatus !== 'idle' && deploymentStatus !== 'live') {
      // Check if deployment block already exists
      const hasDeploymentBlock = allBlocks.some((b) => b.type === 'deployment' && !b.isComplete)

      if (!hasDeploymentBlock) {
        // Create new deployment block
        const deploymentBlock: ConversationBlock = {
          id: `deploy-${Date.now()}`,
          type: 'deployment',
          isComplete: false,
          deploymentStages: [
            { label: 'Creating instance', isComplete: deploymentStatus !== 'creating' },
            { label: 'Building app', isComplete: false },
            { label: 'Setting up keys', isComplete: false },
            { label: 'Finalizing', isComplete: false },
          ],
        }
        setAllBlocks([...allBlocks, deploymentBlock])
      } else {
        // Update existing deployment block
        setAllBlocks(allBlocks.map((block) => {
          if (block.type === 'deployment' && !block.isComplete) {
            const stages = block.deploymentStages?.map((stage, idx) => {
              if (deploymentStatus === 'creating') return { ...stage, isComplete: idx < 0 }
              if (deploymentStatus === 'building') return { ...stage, isComplete: idx < 1 }
              if (deploymentStatus === 'setting-keys') return { ...stage, isComplete: idx < 2 }
              if (deploymentStatus === 'finalizing') return { ...stage, isComplete: idx < 3 }
              return stage
            })
            return { ...block, deploymentStages: stages }
          }
          return block
        }))
      }
    } else if (deploymentStatus === 'live') {
      // Mark deployment as complete
      setAllBlocks(allBlocks.map((block) => {
        if (block.type === 'deployment' && !block.isComplete) {
          return {
            ...block,
            isComplete: true,
            deploymentUrl: 'https://your-app.netlify.app',
            deploymentStages: block.deploymentStages?.map((s) => ({ ...s, isComplete: true })),
          }
        }
        return block
      }))
    }
  }, [deploymentStatus])

  // Auto-scroll to bottom when blocks change or when expanded
  useEffect(() => {
    if (isExpanded && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [allBlocks, isExpanded])

  // Infinite scroll - detect when user scrolls near top
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || !isExpanded) return

    const handleScroll = () => {
      const { scrollTop } = scrollContainer
      const threshold = 100 // Load more when within 100px of top

      if (scrollTop <= threshold && hasMoreBlocks && !isLoadingMore) {
        loadMoreBlocks()
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [isExpanded, hasMoreBlocks, isLoadingMore, currentOffset])

  // Check if there's any conversation history
  const hasHistory = allBlocks.length > 0

  // Delayed slide in animation - appears after action bar
  useEffect(() => {
    if (hasHistory) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 600) // 600ms delay - appears after action bar animation (500ms)
      return () => clearTimeout(timer)
    }
  }, [hasHistory])

  // Don't render if no history
  if (!hasHistory) {
    return null
  }

  const currentBlock = allBlocks[allBlocks.length - 1]
  const latestMessage = currentBlock.type === 'conversation' && currentBlock.messages
    ? currentBlock.messages[currentBlock.messages.length - 1]
    : null
  const isWorking = !currentBlock.isComplete

  // Get display text for collapsed state
  const getCollapsedText = () => {
    if (currentBlock.type === 'deployment') {
      if (currentBlock.isComplete) {
        return 'Deployment complete!'
      }
      const currentStage = currentBlock.deploymentStages?.find((s) => !s.isComplete)
      return currentStage ? currentStage.label : 'Deploying...'
    }

    // Check for in-progress actions
    if (currentBlock.actions && currentBlock.actions.length > 0) {
      const inProgressAction = currentBlock.actions.find(a => a.status === 'in_progress')
      if (inProgressAction) {
        if (inProgressAction.type === 'git_commit') {
          return 'Committing and pushing changes to GitHub...'
        }
        if (inProgressAction.type === 'build') {
          return 'Building...'
        }
        if (inProgressAction.type === 'dev_server') {
          return 'Starting dev server...'
        }
      }

      // Show last completed action
      const lastAction = currentBlock.actions[currentBlock.actions.length - 1]
      if (lastAction.status === 'success') {
        if (lastAction.type === 'git_commit') {
          return 'Committed successfully'
        }
        if (lastAction.type === 'build') {
          return 'Build succeed'
        }
        if (lastAction.type === 'dev_server') {
          return '🚀 Dev Server running. You can test your project!'
        }
      }
    }

    return latestMessage?.content || ''
  }

  return (
    <div
      className={`fixed left-1/2 transform -translate-x-1/2 z-[99] transition-all duration-500 ease-out pointer-events-none ${
        isVisible ? 'bottom-[110px] opacity-100' : 'bottom-[90px] opacity-0'
      }`}
    >
      <div className="bg-dark-card border border-dark-border rounded-t-2xl shadow-2xl w-[680px] overflow-hidden transition-all duration-300 pb-4 relative pointer-events-auto"
        style={{
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
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

        {/* Collapsed State - Single Clickable Row */}
        {!isExpanded && (
          <div
            className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors relative z-10"
            onClick={() => setIsExpanded(true)}
          >
            {currentBlock.type === 'deployment' ? (
              <>
                {isWorking ? (
                  <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                ) : (
                  <Globe size={14} className="text-primary flex-shrink-0" />
                )}
                <span className="text-xs text-gray-200 flex-1 line-clamp-1">{getCollapsedText()}</span>
              </>
            ) : (
              <>
                {isWorking && <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />}
                <span className="text-xs text-gray-200 flex-1 line-clamp-1">{getCollapsedText()}</span>

                {/* Stop button - only show when working on conversation */}
                {isWorking && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation() // Prevent expanding when clicking stop
                      onStopClick?.()
                    }}
                    className="p-1.5 hover:bg-red-500/10 rounded transition-colors group"
                    title="Stop generation"
                  >
                    <Square size={12} className="text-gray-400 group-hover:text-red-400 transition-colors fill-current" />
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Expanded State - Conversation Blocks */}
        {isExpanded && (
          <div className="px-4 pb-3 relative z-10">
            {/* Collapsible header */}
            <div
              className="flex items-center justify-between mb-3 py-2.5 cursor-pointer hover:bg-white/5 -mx-4 px-4 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <span className="text-xs font-medium text-gray-300">Workflow Activity</span>
              <button className="p-1">
                <ChevronDown size={14} className="text-gray-300" />
              </button>
            </div>

            {/* Workflow Timeline */}
            <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-scroll pr-4 custom-scrollbar">
              {/* Loading spinner at top for infinite scroll */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="text-primary animate-spin" />
                  <span className="ml-2 text-xs text-gray-400">Loading older messages...</span>
                </div>
              )}

              {allBlocks.map((block, blockIndex) => {
                const isLastBlock = blockIndex === allBlocks.length - 1
                const showStopButton = isLastBlock && !block.isComplete

                // Render deployment block (keep existing for now)
                if (block.type === 'deployment') {
                  return (
                    <div key={block.id} className="bg-primary/5 rounded-lg p-3 border border-primary/20 relative">
                      {/* Header */}
                      <div className="flex items-start gap-2 mb-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                          {block.isComplete ? (
                            <Globe size={12} className="text-primary" />
                          ) : (
                            <Rocket size={12} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-medium text-primary">
                            {block.isComplete ? 'Deployment Complete' : 'Deploying to Netlify'}
                          </span>
                        </div>
                      </div>

                      {/* Deployment Stages */}
                      <div className="space-y-2 ml-7">
                        {block.deploymentStages?.map((stage, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {stage.isComplete ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                            ) : (
                              <Loader2 size={10} className="text-primary animate-spin flex-shrink-0" />
                            )}
                            <span className={`text-[11px] leading-relaxed ${
                              stage.isComplete ? 'text-gray-400 line-through' : 'text-primary font-medium'
                            }`}>
                              {stage.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Deployment URL - show when complete */}
                      {block.isComplete && block.deploymentUrl && (
                        <div className="mt-3 pt-3 border-t border-primary/20">
                          <a
                            href={block.deploymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-[11px] text-primary hover:text-primary-dark transition-colors group"
                          >
                            <Globe size={11} />
                            <span className="font-medium">{block.deploymentUrl}</span>
                            <ExternalLink size={9} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                          </a>
                        </div>
                      )}
                    </div>
                  )
                }

                // Render conversation block with timeline workflow
                const hasGitAction = block.actions?.some(a => a.type === 'git_commit')
                const hasDeployAction = block.actions?.some(a => a.type === 'dev_server')
                const hasRestoreAction = block.actions?.some(a => a.type === 'checkpoint_restore')
                const gitAction = block.actions?.find(a => a.type === 'git_commit')
                const deployAction = block.actions?.find(a => a.type === 'dev_server')
                const restoreAction = block.actions?.find(a => a.type === 'checkpoint_restore')
                const isRestoreBlock = hasRestoreAction || block.userPrompt?.startsWith('Restore to checkpoint')
                const wasInterrupted = block.messages?.some(m => m.content.includes('⚠️ Stopped by user'))

                return (
                  <div key={block.id} className="mb-6">
                    {/* Workflow Block Container */}
                    <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4 relative">
                      {/* Checkpoint or Stop button (top right) - only for non-restore blocks */}
                      {!isRestoreBlock && (
                        <>
                          {block.isComplete && block.commitHash && block.commitHash !== 'unknown' ? (
                            <button
                              onClick={() => handleRestoreCheckpoint(block)}
                              className="absolute top-3 right-3 p-1.5 hover:bg-white/10 rounded-lg transition-colors group z-10"
                              title="Restore to this checkpoint"
                            >
                              <RotateCcw size={12} className="text-gray-400 group-hover:text-primary transition-colors" />
                            </button>
                          ) : showStopButton ? (
                            <button
                              onClick={onStopClick}
                              className="absolute top-3 right-3 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group z-10"
                              title="Stop generation"
                            >
                              <Square size={12} className="text-gray-400 group-hover:text-red-400 transition-colors fill-current" />
                            </button>
                          ) : null}
                        </>
                      )}

                      {/* RESTORE BLOCK - Timeline design matching other blocks */}
                      {isRestoreBlock ? (
                        <div className="relative pr-8">
                          {/* Continuous dotted line */}
                          <div className="absolute left-[12px] top-0 bottom-0 w-[2px] border-l-2 border-dashed border-white/10 z-0" />

                          {/* Git Restore Step */}
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* Git Icon */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <img src={GitIcon} alt="Git" className="w-6 h-6 opacity-90" />
                              </div>

                              {/* Title + Status */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    {restoreAction?.status === 'in_progress'
                                      ? 'Restoring checkpoint...'
                                      : restoreAction?.status === 'success'
                                      ? `Restored to checkpoint #${restoreAction?.data?.commitHash || ''}`
                                      : 'Restore failed'
                                    }
                                  </span>
                                  {restoreAction?.status === 'success' && (
                                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <Check size={10} className="text-green-400" />
                                    </div>
                                  )}
                                  {restoreAction?.status === 'success' && (
                                    <span className="text-[10px] text-gray-500">
                                      0.1s
                                    </span>
                                  )}
                                  {restoreAction?.status === 'in_progress' && (
                                    <Loader2 size={12} className="text-primary animate-spin" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Dev Server Step */}
                          {hasDeployAction && deployAction && (
                            <div className="relative">
                              {/* Step header */}
                              <div className="flex items-center gap-3 mb-3">
                                {/* Deploy Icon */}
                                <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                  <img src={DeployIcon} alt="Deploy" className="w-6 h-6 opacity-90" />
                                </div>

                                {/* Title + Status */}
                                <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-200">
                                      {deployAction.status === 'in_progress'
                                        ? 'Starting dev server...'
                                        : deployAction.status === 'success'
                                        ? 'Dev server running'
                                        : 'Failed to start dev server'
                                      }
                                    </span>
                                    {deployAction.status === 'success' && (
                                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <Check size={10} className="text-green-400" />
                                      </div>
                                    )}
                                    {deployAction.status === 'success' && deployAction.data?.restartTime && (
                                      <span className="text-[10px] text-gray-500">
                                        {deployAction.data.restartTime}s
                                      </span>
                                    )}
                                    {deployAction.status === 'in_progress' && (
                                      <Loader2 size={12} className="text-primary animate-spin" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Deploy step content (always visible) */}
                              {deployAction.status === 'success' && deployAction.data?.url && (
                                <div className="ml-10">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="text-gray-400">Server:</span>
                                    <a
                                      href={deployAction.data.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group"
                                    >
                                      <span>{deployAction.data.url}</span>
                                      <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Timeline Workflow */
                        <div className="relative pr-8">
                        {/* Continuous dotted line from top to bottom - behind icons */}
                        <div className="absolute left-[12px] top-0 bottom-0 w-[2px] border-l-2 border-dashed border-white/10 z-0" />

                        {/* STEP 0: USER (User Prompt) */}
                        <div className="relative pb-4">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Icon - Adjust left/right positioning here */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <img src={UserIcon} alt="User" className="w-6 h-6 opacity-90" />
                            </div>

                            {/* Title */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              {(() => {
                                const prompt = block.userPrompt || 'User request'
                                const lineCount = estimatePromptLines(prompt)
                                const fontSize = getPromptFontSize(lineCount)
                                const needsExpansion = lineCount > 10
                                const isExpanded = expandedUserPrompts.has(block.id)
                                const maxLines = 3

                                return (
                                  <div>
                                    <div className={`${fontSize} font-medium text-gray-200 ${needsExpansion && !isExpanded ? 'line-clamp-3' : ''}`}>
                                      {prompt}
                                    </div>
                                    {needsExpansion && (
                                      <button
                                        onClick={() => {
                                          const newSet = new Set(expandedUserPrompts)
                                          if (newSet.has(block.id)) {
                                            newSet.delete(block.id)
                                          } else {
                                            newSet.add(block.id)
                                          }
                                          setExpandedUserPrompts(newSet)
                                        }}
                                        className="mt-1 text-[10px] text-primary hover:text-primary-light transition-colors"
                                      >
                                        {isExpanded ? 'Show less' : 'Show more'}
                                      </button>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* STEP 1: ANTHROPIC (Code Editing) */}
                        <div className="relative pb-4">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Icon - Adjust left/right positioning here */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6 opacity-90" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-200">
                                  Code editing
                                </span>
                                {block.isComplete && (
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                )}
                                {block.isComplete && block.completionStats && (
                                  <span className="text-[10px] text-gray-500">
                                    {block.completionStats.timeSeconds}s
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Anthropic step content (always visible) */}
                          <div className="ml-10 space-y-3">

                            {/* Messages */}
                            <div className="space-y-1.5">
                              {block.messages?.filter(m => !m.content.includes('⚠️ Stopped by user')).map((message, idx) => {
                                const messageId = `${block.id}-msg-${idx}`
                                const isLong = isLongMessage(message.content)
                                const isMessageExpanded = expandedMessages.has(messageId)

                                return (
                                  <div key={idx}>
                                    <div className="flex items-start gap-2">
                                      {message.type === 'assistant' && (
                                        <>
                                          <Bot size={11} className="text-primary flex-shrink-0 opacity-60" style={{ marginTop: '8px' }} />
                                          <div className="flex-1">
                                            <span className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                              {isLong && !isMessageExpanded
                                                ? getTruncatedMessage(message.content)
                                                : message.content
                                              }
                                            </span>
                                            {isLong && (
                                              <button
                                                onClick={() => {
                                                  const newSet = new Set(expandedMessages)
                                                  if (newSet.has(messageId)) {
                                                    newSet.delete(messageId)
                                                  } else {
                                                    newSet.add(messageId)
                                                  }
                                                  setExpandedMessages(newSet)
                                                }}
                                                className="ml-1 text-[10px] text-primary hover:text-primary-light transition-colors"
                                              >
                                                {isMessageExpanded ? 'Show less' : 'Show more'}
                                              </button>
                                            )}
                                          </div>
                                        </>
                                      )}
                                      {message.type === 'tool' && (
                                        <>
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500/50 flex-shrink-0 mt-1.5" />
                                          <span className="text-[11px] text-gray-400 leading-relaxed">
                                            {message.toolName ? (
                                              // Highlight the tool name
                                              <>
                                                Claude using tool{' '}
                                                <span className="text-primary font-medium">{message.toolName}</span>
                                                {message.content.includes('@') && (
                                                  <> @ {message.content.split('@')[1].trim()}</>
                                                )}
                                              </>
                                            ) : (
                                              // Grouped tools (completed)
                                              <span className="font-mono">{message.content}</span>
                                            )}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Completion Stats */}
                            {block.completionStats && (
                              <div className="mt-2 pt-2 border-t border-white/10">
                                <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                  <span className="text-gray-400">
                                    {block.completionStats.timeSeconds}s
                                  </span>
                                  <span className="text-gray-600">|</span>
                                  <span className="text-gray-400 flex items-center gap-1">
                                    <span>Tokens:</span>
                                    <ArrowUpCircle size={10} className="text-blue-400" />
                                    <span>{block.completionStats.inputTokens}</span>
                                    <span className="text-gray-600">→</span>
                                    <ArrowDownCircle size={10} className="text-green-400" />
                                    <span>{block.completionStats.outputTokens}</span>
                                  </span>
                                  <span className="text-gray-600">|</span>
                                  <span className="text-gray-400 flex items-center gap-1">
                                    <DollarSign size={10} />
                                    {block.completionStats.cost.toFixed(4)}
                                    <div className="group/info relative flex items-center">
                                      <Info size={10} className="text-gray-500 cursor-help" />
                                      <div className="absolute right-0 bottom-full mb-2 bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-[9px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/info:opacity-100 transition-opacity z-[150] shadow-xl">
                                        Billed to API users only.<br />
                                        Included in Max plans.
                                      </div>
                                    </div>
                                  </span>
                                </div>

                                {/* Collapsible Summary */}
                                {block.summary && (
                                  <div className="mt-2">
                                    <button
                                      onClick={() => {
                                        const newSet = new Set(expandedSummaries)
                                        if (newSet.has(block.id)) {
                                          newSet.delete(block.id)
                                        } else {
                                          newSet.add(block.id)
                                        }
                                        setExpandedSummaries(newSet)
                                      }}
                                      className="flex items-center gap-1.5 text-[10px] text-primary hover:text-primary-light transition-colors"
                                    >
                                      {expandedSummaries.has(block.id) ? (
                                        <ChevronUp size={10} />
                                      ) : (
                                        <ChevronDown size={10} />
                                      )}
                                      <span className="font-medium">Summary</span>
                                    </button>

                                    {expandedSummaries.has(block.id) && (
                                      <div className="mt-2 pl-4 text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {block.summary}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        </div>

                      {/* STEP 2: GIT (GitHub Commit) */}
                      {hasGitAction && gitAction && (
                        <div className="relative pb-4">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Icon - Adjust left/right positioning here */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <img src={GitIcon} alt="Git" className="w-6 h-6 opacity-90" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-200">
                                  {gitAction.status === 'in_progress'
                                    ? 'Committing and pushing to GitHub...'
                                    : gitAction.status === 'success'
                                    ? 'Committed successfully'
                                    : 'Commit failed'
                                  }
                                </span>
                                {gitAction.status === 'success' && (
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                )}
                                {gitAction.status === 'success' && (
                                  <span className="text-[10px] text-gray-500">
                                    0.1s
                                  </span>
                                )}
                                {gitAction.status === 'in_progress' && (
                                  <Loader2 size={12} className="text-primary animate-spin" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Git step content (always visible) */}
                          {gitAction.status === 'success' && gitAction.data && (
                            <div className="ml-10 space-y-2">
                              {gitAction.data.commitHash && (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="text-gray-400">Commit:</span>
                                  <span className="font-mono bg-white/5 px-2 py-0.5 rounded text-gray-300">
                                    {gitAction.data.commitHash}
                                  </span>
                                </div>
                              )}
                              {gitAction.data.filesChanged !== undefined && (
                                <div className="flex items-center gap-2 text-[11px]">
                                  <span className="text-gray-400">Files changed:</span>
                                  <span className="text-gray-300">
                                    {gitAction.data.filesChanged} file{gitAction.data.filesChanged !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* STEP 3: DEPLOY (Dev Server) */}
                      {hasDeployAction && deployAction && (
                        <div className="relative">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Icon - Adjust left/right positioning here */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <img src={DeployIcon} alt="Deploy" className="w-6 h-6 opacity-90" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-200">
                                  {deployAction.status === 'in_progress'
                                    ? 'Starting dev server...'
                                    : deployAction.status === 'success'
                                    ? 'Dev server running'
                                    : 'Failed to start dev server'
                                  }
                                </span>
                                {deployAction.status === 'success' && (
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                )}
                                {deployAction.status === 'success' && deployAction.data?.restartTime && (
                                  <span className="text-[10px] text-gray-500">
                                    {deployAction.data.restartTime}s
                                  </span>
                                )}
                                {deployAction.status === 'in_progress' && (
                                  <Loader2 size={12} className="text-primary animate-spin" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Deploy step content (always visible) */}
                          {deployAction.status === 'success' && deployAction.data?.url && (
                            <div className="ml-10">
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="text-gray-400">Server:</span>
                                <a
                                  href={deployAction.data.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group"
                                >
                                  <span>{deployAction.data.url}</span>
                                  <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* STEP: INTERRUPTED (Stopped by user) */}
                      {wasInterrupted && (
                        <div className="relative">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* X Icon */}
                            <div className="flex-shrink-0 bg-red-500/10 rounded-full p-1 relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <X size={14} className="text-red-400" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-200">
                                  Stopped by user
                                </span>
                                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                                  <Check size={10} className="text-red-400" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                        </div>
                      )}

                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Custom styles */}
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </div>
  )
}

export default StatusSheet
