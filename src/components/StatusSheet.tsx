import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronUp, Loader2, RotateCcw, User, Bot, Square, Rocket, Globe, ExternalLink, CheckCircle2, Check, ArrowDownCircle, ArrowUpCircle, DollarSign, Info, X, Brain, Clock, Server, MessageCircle, ClipboardCheck } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { KeywordHighlight } from './KeywordHighlight'

// Import workflow icons
import AnthropicIcon from '../assets/images/anthropic.svg'
import GitIcon from '../assets/images/git.svg'
import bgImage from '../assets/images/bg.jpg'
import successSound from '../assets/sounds/success.wav'

interface ConversationMessage {
  type: 'user' | 'assistant' | 'tool' | 'thinking'
  content: string
  timestamp?: Date
  toolName?: string // For highlighting tool names
  toolId?: string // Unique ID for tool execution
  toolDuration?: number // Duration in seconds for completed tools
  thinkingDuration?: number // Duration in seconds for completed thinking
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
  type: 'conversation' | 'deployment' | 'initialization'
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
  interactionType?: string | null // Type of interaction (user_message, claude_response, plan_ready, etc.)
  // Deployment-specific fields
  deploymentStages?: DeploymentStage[]
  deploymentUrl?: string
  // Initialization-specific fields
  initializationStages?: DeploymentStage[]
  templateName?: string
}

interface StatusSheetProps {
  projectId?: string
  actionBarRef?: React.RefObject<HTMLDivElement>
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onStopClick?: () => void
  questions?: any // Questions from Claude
  onApprovePlan?: () => void // Callback when user approves plan
  onRejectPlan?: () => void // Callback when user rejects plan (keep planning)
  onAnswerQuestions?: (answers: Record<string, string | string[]>, customInputs: Record<string, string>) => void
}

// Helper: Check if block has a plan waiting for approval
function hasPlanWaitingApproval(block: ConversationBlock): boolean {
  // Must be complete
  if (!block.isComplete) {
    return false
  }

  // NEW: Check interactionType first (most reliable)
  if (block.interactionType === 'plan_ready') {
    return true
  }

  // FALLBACK: Check if tool summary contains ExitPlanMode
  // For completed blocks, tools are grouped like "1x Grep, 1x ExitPlanMode"
  if (block.messages) {
    const toolMessages = block.messages.filter(m => m.type === 'tool')
    for (const toolMsg of toolMessages) {
      if (toolMsg.content.includes('ExitPlanMode')) {
        return true
      }
    }
  }

  return false
}

function StatusSheet({ projectId, actionBarRef, onMouseEnter, onMouseLeave, onStopClick, questions, onApprovePlan, onRejectPlan, onAnswerQuestions }: StatusSheetProps) {
  const { deploymentStatus, showStatusSheet, setShowStatusSheet, viewMode } = useAppStore()
  const { layoutState, statusSheetExpanded, setStatusSheetExpanded, setModalFreezeActive, setModalFreezeImage } = useLayoutStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [allBlocks, setAllBlocks] = useState<ConversationBlock[]>([])
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set())
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [expandedUserPrompts, setExpandedUserPrompts] = useState<Set<string>>(new Set())
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreBlocks, setHasMoreBlocks] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [actionBarHeight, setActionBarHeight] = useState(0)
  const [thinkingTimers, setThinkingTimers] = useState<Map<string, number>>(new Map())
  const [thinkingDots, setThinkingDots] = useState('')
  const [latestToolTimer, setLatestToolTimer] = useState<Map<string, number>>(new Map()) // blockId -> elapsed time
  const [keywords, setKeywords] = useState<Record<string, string>>({})
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string | string[]>>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const statusSheetRef = useRef<HTMLDivElement>(null)
  const prevLayoutStateRef = useRef<string>(layoutState)

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

  // Helper to check if all questions are answered
  const areAllQuestionsAnswered = (): boolean => {
    if (!questions?.questions) return false
    return questions.questions.every((q: any) => {
      const answer = questionAnswers[q.id]
      if (q.type === 'checkbox') {
        const answerArray = Array.isArray(answer) ? answer : []
        // If "custom" is selected, check that customInputs has a value
        if (answerArray.includes('__CUSTOM__')) {
          return customInputs[q.id] && customInputs[q.id].trim() !== ''
        }
        return answerArray.length > 0
      }
      if (q.type === 'radio') {
        // If "custom" is selected, check that customInputs has a value
        if (answer === '__CUSTOM__') {
          return customInputs[q.id] && customInputs[q.id].trim() !== ''
        }
        return answer && answer !== ''
      }
      return answer && answer !== ''
    })
  }

  // Helper to toggle checkbox answer
  const toggleCheckboxAnswer = (questionId: string, option: string) => {
    const currentAnswer = questionAnswers[questionId]
    const currentArray = Array.isArray(currentAnswer) ? currentAnswer : []

    if (currentArray.includes(option)) {
      setQuestionAnswers({
        ...questionAnswers,
        [questionId]: currentArray.filter(v => v !== option)
      })
    } else {
      setQuestionAnswers({
        ...questionAnswers,
        [questionId]: [...currentArray, option]
      })
    }
  }

  // Reset answers when questions change
  useEffect(() => {
    if (questions) {
      setQuestionAnswers({})
      setCustomInputs({})
    }
  }, [questions])

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

    // Collect all Claude messages and tools with timestamps for chronological sorting
    const timedMessages: ConversationMessage[] = []

    // Parse Claude messages
    if (block.claudeMessages) {
      try {
        const claudeMessages = JSON.parse(block.claudeMessages)

        // Handle both old format (string[]) and new format (object[])
        claudeMessages.forEach((msg: any) => {
          if (typeof msg === 'string') {
            // Old format - plain string (no timestamp, will be sorted to end)
            timedMessages.push({
              type: 'assistant',
              content: msg,
            })
          } else if (msg.type === 'text') {
            // New format - text message
            timedMessages.push({
              type: 'assistant',
              content: msg.content,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
            })
          } else if (msg.type === 'thinking') {
            // New format - thinking message
            timedMessages.push({
              type: 'thinking',
              content: msg.content,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
              thinkingDuration: msg.thinkingDuration,
            })
          }
        })
      } catch (e) {
        console.error('Failed to parse Claude messages:', e)
      }
    }

    // Parse tool executions
    if (block.toolExecutions) {
      try {
        const toolData = JSON.parse(block.toolExecutions)

        if (block.isComplete) {
          // Completed: show grouped summary
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
              timedMessages.push({
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
              timedMessages.push({
                type: 'tool',
                content: toolMessages,
              })
            }
          }
        } else {
          // In progress: show verbose tool executions with timestamps
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

              // Calculate duration if tool is complete
              let toolDuration: number | undefined
              if (tool.endTime && tool.startTime) {
                toolDuration = Math.round((tool.endTime - tool.startTime) / 1000)
              }

              timedMessages.push({
                type: 'tool',
                content: toolMsg,
                toolName: tool.toolName,
                toolId: tool.toolId,
                timestamp: tool.startTime ? new Date(tool.startTime) : undefined,
                toolDuration: toolDuration,
              })
            })
          }
        }
      } catch (e) {
        console.error('Failed to parse tool executions:', e)
      }
    }

    // Sort all messages by timestamp (messages without timestamps go to end)
    timedMessages.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return a.timestamp.getTime() - b.timestamp.getTime()
    })

    // Add sorted messages to the main messages array
    messages.push(...timedMessages)

    // If no Claude messages yet, show random loading message
    const hasAssistantMessages = messages.some(m => m.type === 'assistant' || m.type === 'thinking')
    if (!hasAssistantMessages && !block.isComplete) {
      messages.push({
        type: 'assistant',
        content: getLoadingPhrase(block.id),
      })
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

    // Parse actions - check if this is an initialization block
    let actions: Action[] | undefined
    let initializationStages: { label: string; isComplete: boolean }[] | undefined
    let templateName: string | undefined
    let blockType: 'conversation' | 'initialization' = 'conversation'

    if (block.actions) {
      try {
        const parsedActions = JSON.parse(block.actions)

        // Check if this is initialization data
        if (parsedActions.type === 'initialization') {
          blockType = 'initialization'
          templateName = parsedActions.templateName
          initializationStages = parsedActions.stages
        } else {
          actions = parsedActions
        }
      } catch (e) {
        console.error('Failed to parse actions:', e)
      }
    }

    return {
      id: block.id,
      type: blockType,
      projectId: block.projectId,
      userPrompt: block.userPrompt,
      messages,
      isComplete: block.isComplete,
      commitHash: block.commitHash || undefined,
      filesChanged: block.filesChanged || undefined,
      completionStats,
      summary: block.summary || undefined,
      actions,
      initializationStages,
      templateName,
    }
  }

  // Helper to check if a message is long (should be collapsible)
  const isLongMessage = (content: string): boolean => {
    const lines = content.split('\n')
    return lines.length > 1 || content.length > 105
  }

  // Helper to get truncated message
  const getTruncatedMessage = (content: string): string => {
    const lines = content.split('\n')
    if (lines.length > 1) {
      return lines[0].slice(0, 105) + '...'
    }
    if (content.length > 105) {
      return content.slice(0, 105) + '...'
    }
    return content
  }

  // Helper: Check if block has plan mode questions
  const hasQuestions = (block: ConversationBlock): boolean => {
    return block.messages?.some(m => m.content.includes('<QUESTIONS>')) || false
  }

  // Helper: Check if block is user answers to questions
  const isAnswerBlock = (block: ConversationBlock): boolean => {
    const isAnswer = block.userPrompt?.startsWith('Here are my answers to your questions') || false
    return isAnswer
  }

  // Helper: Strip <QUESTIONS> tags from text
  const stripQuestions = (text: string): string => {
    return text.replace(/<QUESTIONS>[\s\S]*?<\/QUESTIONS>/g, '').trim()
  }

  // Helper: Extract questions data from text
  const extractQuestions = (text: string): any => {
    const match = text.match(/<QUESTIONS>([\s\S]*?)<\/QUESTIONS>/)
    if (!match) return null

    try {
      return JSON.parse(match[1].trim())
    } catch {
      return null
    }
  }

  // Helper: Extract answers from user prompt
  const extractAnswers = (userPrompt: string): string[] => {
    const lines = userPrompt.split('\n').filter(line => line.trim())
    const answers: string[] = []

    for (const line of lines) {
      // Skip the first line "Here are my answers..."
      if (line.startsWith('Here are my answers')) continue
      if (line.startsWith('**') && line.includes('**')) {
        // This is a question line, skip it
        continue
      }
      // This is an answer line
      if (!line.startsWith('Please proceed')) {
        answers.push(line.trim())
      }
    }

    return answers
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
      const result = await window.electronAPI.git.restoreCheckpoint(projectId, block.commitHash)

      if (result.success) {
      } else {
        console.error(`❌ Failed to restore checkpoint: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Error restoring checkpoint:', error)
    }
  }

  // Load initial chat history from database
  // Load keywords once on mount for educational tooltips
  useEffect(() => {
    if (!window.electronAPI?.keywords) return

    window.electronAPI.keywords.getAll().then((result) => {
      if (result.success && result.keywords) {
        setKeywords(result.keywords)
      }
    })
  }, [])

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
          wasInterrupted = messages.some((m: any) => {
            // Handle both old format (string) and new format (object)
            if (typeof m === 'string') {
              return m.includes('⚠️ Stopped by user')
            } else if (m.content) {
              return m.content.includes('⚠️ Stopped by user')
            }
            return false
          })
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

  // Animate dots for thinking state: '' -> '.' -> '..' -> '...'
  useEffect(() => {
    const hasActiveThinking = allBlocks.some(block =>
      block.messages?.some(m => m.type === 'thinking' && !m.thinkingDuration)
    )

    if (hasActiveThinking) {
      const interval = setInterval(() => {
        setThinkingDots(prev => {
          if (prev === '...') return ''
          return prev + '.'
        })
      }, 400)

      return () => clearInterval(interval)
    } else {
      setThinkingDots('')
    }
  }, [allBlocks])

  // Track thinking timers for active blocks
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []

    allBlocks.forEach(block => {
      // Check if block has active thinking (no duration set = still thinking)
      const hasActiveThinking = block.messages?.some(m =>
        m.type === 'thinking' && !m.thinkingDuration
      )

      if (hasActiveThinking) {
        const thinkingMsg = block.messages?.find(m => m.type === 'thinking' && !m.thinkingDuration)
        if (thinkingMsg?.timestamp) {
          // Update timer every 100ms for smooth display
          const interval = setInterval(() => {
            setThinkingTimers(prev => {
              const newMap = new Map(prev)
              const elapsed = (Date.now() - thinkingMsg.timestamp!.getTime()) / 1000
              newMap.set(block.id, elapsed)
              return newMap
            })
          }, 100)
          intervals.push(interval)
        }
      }
    })

    return () => {
      intervals.forEach(interval => clearInterval(interval))
    }
  }, [allBlocks])

  // Track elapsed time for the LATEST tool in each block
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []

    allBlocks.forEach(block => {
      // Find the last tool message without a duration (active tool)
      const toolMessages = block.messages?.filter(m => m.type === 'tool') || []
      const latestTool = toolMessages[toolMessages.length - 1]

      if (latestTool && latestTool.timestamp && latestTool.toolDuration === undefined) {
        // This is an active tool - track its time
        const interval = setInterval(() => {
          setLatestToolTimer(prev => {
            const newMap = new Map(prev)
            const elapsed = (Date.now() - latestTool.timestamp!.getTime()) / 1000
            newMap.set(block.id, elapsed)
            return newMap
          })
        }, 100)
        intervals.push(interval)
      } else {
        // No active tool - clear timer for this block
        setLatestToolTimer(prev => {
          const newMap = new Map(prev)
          newMap.delete(block.id)
          return newMap
        })
      }
    })

    return () => {
      intervals.forEach(interval => clearInterval(interval))
    }
  }, [allBlocks])

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

  // Calculate these values BEFORE early returns (must always execute in same order)
  const currentBlock = hasHistory ? allBlocks[allBlocks.length - 1] : null
  const latestMessage = currentBlock && currentBlock.type === 'conversation' && currentBlock.messages
    ? currentBlock.messages[currentBlock.messages.length - 1]
    : null
  const isWorking = currentBlock ? !currentBlock.isComplete : false

  // Get display text and icon for collapsed state
  const getCollapsedState = () => {
    if (!currentBlock) {
      return { text: '', icon: null, needsAttention: false }
    }

    // Check if Claude has questions that need answers (only show after block is complete)
    if (questions && questions.questions && questions.questions.length > 0 && currentBlock.isComplete) {
      return { text: 'Claude has questions for you - click to answer', icon: MessageCircle, needsAttention: true }
    }

    // Check if plan is ready and needs approval (use helper function)
    if (currentBlock.type === 'conversation' && hasPlanWaitingApproval(currentBlock)) {
      return { text: 'Plan ready - click to review and approve', icon: ClipboardCheck, needsAttention: true }
    }

    if (currentBlock.type === 'deployment') {
      if (currentBlock.isComplete) {
        return { text: 'Deployment complete!', icon: Globe, needsAttention: true }
      }
      const currentStage = currentBlock.deploymentStages?.find((s) => !s.isComplete)
      return { text: currentStage ? currentStage.label : 'Deploying...', icon: null, needsAttention: false }
    }

    if (currentBlock.type === 'initialization') {
      if (currentBlock.isComplete) {
        return { text: 'Project ready!', icon: CheckCircle2, needsAttention: true }
      }
      const currentStage = currentBlock.initializationStages?.find((s) => !s.isComplete)
      return { text: currentStage ? currentStage.label : 'Setting up project...', icon: null, needsAttention: false }
    }

    // Check for in-progress actions
    if (currentBlock.actions && currentBlock.actions.length > 0) {
      const inProgressAction = currentBlock.actions.find(a => a.status === 'in_progress')
      if (inProgressAction) {
        if (inProgressAction.type === 'git_commit') {
          return { text: 'Committing and pushing changes to GitHub...', icon: null, needsAttention: false }
        }
        if (inProgressAction.type === 'build') {
          return { text: 'Building...', icon: null, needsAttention: false }
        }
        if (inProgressAction.type === 'dev_server') {
          return { text: 'Starting dev server...', icon: null, needsAttention: false }
        }
      }

      // Show last completed action
      const lastAction = currentBlock.actions[currentBlock.actions.length - 1]
      if (lastAction.status === 'success') {
        if (lastAction.type === 'git_commit') {
          return { text: 'Committed successfully', icon: null, needsAttention: false }
        }
        if (lastAction.type === 'build') {
          return { text: 'Build succeed', icon: null, needsAttention: false }
        }
        if (lastAction.type === 'dev_server') {
          return { text: 'Dev Server running. You can test your project!', icon: Server, needsAttention: true }
        }
      }
    }

    return { text: latestMessage?.content || '', icon: null, needsAttention: false }
  }

  // Thumbnail is now captured by LayoutManager before hiding the BrowserView
  // and passed via the state-changed event (see ProjectView.tsx)

  // Delayed slide in animation - appears after action bar (MUST be before return)
  useEffect(() => {
    if (hasHistory) {
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 600) // 600ms delay - appears after action bar animation (500ms)
      return () => clearTimeout(timer)
    }
  }, [hasHistory])

  // Use ResizeObserver to watch ActionBar height changes in real-time (MUST be before return)
  useEffect(() => {
    if (!actionBarRef?.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setActionBarHeight(entry.target.clientHeight)
      }
    })

    resizeObserver.observe(actionBarRef.current)

    // Set initial height
    setActionBarHeight(actionBarRef.current.clientHeight)

    return () => {
      resizeObserver.disconnect()
    }
  }, [actionBarRef])

  // Sync local expanded state with store
  useEffect(() => {
    setIsExpanded(statusSheetExpanded)
  }, [statusSheetExpanded])

  // Handle preview visibility based on layout state and StatusSheet expanded state
  useEffect(() => {
    const handlePreviewVisibility = async () => {
      if (!projectId) {
        return
      }

      // DEFAULT state: Control preview visibility based on StatusSheet state
      if (layoutState === 'DEFAULT') {
        if (statusSheetExpanded) {
          // StatusSheet expanded in DEFAULT → activate freeze, hide preview
          try {
            const result = await window.electronAPI?.layout.captureModalFreeze(projectId)

            // CRITICAL: Check if sheet is STILL expanded before activating freeze
            // (it might have been collapsed while we were capturing)
            const currentExpanded = useLayoutStore.getState().statusSheetExpanded
            const currentLayout = useLayoutStore.getState().layoutState

            if (result?.success && result.freezeImage && currentExpanded && currentLayout === 'DEFAULT') {
              setModalFreezeImage(result.freezeImage)
              setModalFreezeActive(true)
              await window.electronAPI?.preview.hide(projectId)
            }
          } catch (error) {
            console.error('❌ [PREVIEW VISIBILITY] Failed to capture freeze image:', error)
          }
        } else {
          // StatusSheet collapsed in DEFAULT → deactivate freeze, show preview
          setModalFreezeActive(false)
          await window.electronAPI?.preview.show(projectId)
        }
      }
      // TOOLS state: Preview frame is hidden completely (no frozen background)
      else if (layoutState === 'TOOLS') {
        // No freeze effect in TOOLS state - just empty space
        setModalFreezeActive(false)
      }
    }

    handlePreviewVisibility()
  }, [layoutState, statusSheetExpanded, projectId, setModalFreezeActive, setModalFreezeImage])

  // Handler for expanding StatusSheet
  const handleExpand = useCallback(() => {
    // Just update the state - the useEffect will handle freeze/preview logic
    setIsExpanded(true)
    setStatusSheetExpanded(true)
    setShowStatusSheet(true)
  }, [setStatusSheetExpanded, setShowStatusSheet, layoutState])

  // Handler for collapsing StatusSheet
  const handleCollapse = useCallback(() => {
    // Just update the state - the useEffect will handle freeze/preview logic
    setIsExpanded(false)
    setStatusSheetExpanded(false)
    setShowStatusSheet(false)
  }, [setStatusSheetExpanded, setShowStatusSheet, layoutState])

  // Auto-collapse StatusSheet when clicking outside
  useEffect(() => {
    // Only add listener when StatusSheet is expanded
    if (!statusSheetExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is inside StatusSheet
      const clickedInsideSheet = statusSheetRef.current?.contains(target)

      // Check if click is inside ActionBar
      const clickedInsideActionBar = actionBarRef?.current?.contains(target)

      // If clicked outside both StatusSheet and ActionBar, collapse
      if (!clickedInsideSheet && !clickedInsideActionBar) {
        handleCollapse()
      }
    }

    // Add listener with slight delay to avoid collapsing on the expand click itself
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusSheetExpanded, actionBarRef, handleCollapse])

  // Auto-collapse StatusSheet when cycling from TOOLS to DEFAULT
  // IMPORTANT: This must run BEFORE the preview visibility effect
  useEffect(() => {
    // Only collapse when going from TOOLS → DEFAULT with expanded sheet
    if (prevLayoutStateRef.current === 'TOOLS' && layoutState === 'DEFAULT' && statusSheetExpanded) {
      // Collapse the StatusSheet SYNCHRONOUSLY before other effects run
      setIsExpanded(false)
      setStatusSheetExpanded(false)
      setShowStatusSheet(false)
    }

    // Update ref for next comparison
    prevLayoutStateRef.current = layoutState
  }, [layoutState])  // Only depend on layoutState to ensure this runs first

  // Calculate bottom position based on action bar height
  const baseOffset = -19 // Gap between action bar and status sheet (adjusted for 5px lower action bar)
  const bottomPosition = isVisible
    ? (actionBarHeight > 0 ? actionBarHeight + baseOffset : 95)
    : (actionBarHeight > 0 ? actionBarHeight - 14 : 75)

  // Always render if has history (show collapsed or expanded based on state)
  const shouldRender = hasHistory

  return (
    <>
      {shouldRender && (
        <div
        className={`fixed right-0 z-[99] pointer-events-none w-2/3 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          bottom: `${bottomPosition}px`,
          transition: 'opacity 300ms ease-out'
        }}
      >
        <div
        ref={statusSheetRef}
        className="bg-dark-card border border-dark-border shadow-2xl w-full overflow-hidden pb-4 relative pointer-events-auto"
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
        {!isExpanded && (() => {
          const collapsedState = getCollapsedState()
          const IconComponent = collapsedState.icon

          return (
            <div
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors relative z-10"
              onClick={handleExpand}
            >
              {currentBlock.type === 'deployment' || currentBlock.type === 'initialization' ? (
                <>
                  {isWorking ? (
                    <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <>
                      {currentBlock.type === 'deployment' ? (
                        <Globe size={14} className={`text-primary flex-shrink-0 ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                      ) : (
                        <Rocket size={14} className={`text-primary flex-shrink-0 ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                      )}
                    </>
                  )}
                  <span className="text-xs text-gray-200 flex-1 line-clamp-1">{collapsedState.text}</span>
                  <ChevronUp size={14} className="text-gray-400" />
                </>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  {isWorking ? (
                    <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                  ) : IconComponent ? (
                    <IconComponent size={14} className={`flex-shrink-0 text-primary ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                  ) : null}
                  <span className="text-xs text-gray-200 flex-1 line-clamp-1">
                    {collapsedState.text}
                  </span>
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
                  <ChevronUp size={14} className="text-gray-400" />
                </div>
              )}
            </div>
          )
        })()}

        {/* Expanded State - Conversation Blocks */}
        {isExpanded && (
          <div className="pb-3 relative z-10">
            {/* Collapsible header */}
            <div
              className="flex items-center justify-between mb-3 py-2.5 cursor-pointer hover:bg-white/5 px-3 transition-colors"
              onClick={handleCollapse}
            >
              <span className="text-xs font-medium text-gray-300">Workflow Activity</span>
              <button className="p-1">
                <ChevronDown size={14} className="text-gray-300" />
              </button>
            </div>

            {/* Workflow Timeline */}
            <div ref={scrollContainerRef} className="max-h-[500px] overflow-y-scroll pl-3 pr-3 custom-scrollbar">
              {/* Loading spinner at top for infinite scroll */}
              {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="text-primary animate-spin" />
                  <span className="ml-2 text-xs text-gray-400">Loading older messages...</span>
                </div>
              )}

              {allBlocks.map((block, blockIndex) => {
                // ============================================================
                // NEW SIMPLIFIED LOGIC: Use interactionType to determine rendering
                // Fall back to old detection methods if interactionType is not set
                // ============================================================

                const blockType = block.interactionType || 'unknown';

                // Skip answer blocks - they're shown inline with questions
                const isAnswers = blockType === 'answers' || isAnswerBlock(block);
                if (isAnswers) {
                  return null;
                }

                // Get the actual index and check what comes next
                const actualIndex = allBlocks.findIndex(b => b.id === block.id);
                const nextBlock = actualIndex >= 0 && actualIndex < allBlocks.length - 1 ? allBlocks[actualIndex + 1] : null;

                // Determine if this is a questions block
                const isQuestions = blockType === 'questions' || hasQuestions(block);

                // For questions blocks - find the answer block that follows
                const answerBlock = (isQuestions && nextBlock && (nextBlock.interactionType === 'answers' || isAnswerBlock(nextBlock))) ? nextBlock : null;
                const isPlanModeWithAnswers = isQuestions && answerBlock !== null;

                // Determine if this is a plan ready block
                const isPlanReady = blockType === 'plan_ready' || hasPlanWaitingApproval(block);

                // For plan blocks - check if user already approved (next block is plan_approval)
                const isApprovalNext = nextBlock && (nextBlock.interactionType === 'plan_approval' || nextBlock.userPrompt === "I approve this plan. Please proceed with the implementation.");
                const implementationBlock = isApprovalNext ? nextBlock : null;

                // Skip plan_approval blocks - they're shown inline with the plan
                const isPlanApproval = blockType === 'plan_approval' || block.userPrompt === "I approve this plan. Please proceed with the implementation.";
                if (isPlanApproval) {
                  return null;
                }

                // Check if implementation already happened inline (Claude continued without waiting)
                const hasGitCommitInline = block.actions?.some(a => a.type === 'git_commit');

                // Check if we need approval buttons
                // Only show if: plan is ready, complete, no approval block next, and no implementation happened inline
                const needsApproval = isPlanReady && block.isComplete && !isApprovalNext && !hasGitCommitInline;

                // Stop button logic - show on last incomplete block
                const isLastBlock = blockIndex === allBlocks.length - 1;
                const showStopButton = isLastBlock && !block.isComplete

                // Render initialization block
                if (block.type === 'initialization') {
                  return (
                    <div key={block.id} className="bg-primary/5 rounded-lg p-3 border border-primary/20 relative mb-6">
                      {/* Header */}
                      <div className="flex items-start gap-2 mb-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                          {block.isComplete ? (
                            <CheckCircle2 size={12} className="text-green-400" />
                          ) : (
                            <Rocket size={12} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <span className="text-xs font-medium text-primary">
                            {block.isComplete ? 'Project Ready!' : `Setting up ${block.templateName || 'project'}`}
                          </span>
                        </div>
                      </div>

                      {/* Initialization Stages */}
                      <div className="space-y-2 ml-7">
                        {block.initializationStages?.map((stage, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {stage.isComplete ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
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
                    </div>
                  )
                }

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
                      {!isRestoreBlock && (() => {
                        // In plan mode with merged blocks, check both the main block and answer block for commitHash
                        const commitHashToCheck = (isPlanModeWithAnswers && answerBlock?.commitHash)
                          ? answerBlock.commitHash
                          : block.commitHash;

                        const blockToRestore = (isPlanModeWithAnswers && answerBlock?.commitHash)
                          ? answerBlock
                          : block;

                        const shouldShowRestore = block.isComplete && commitHashToCheck && commitHashToCheck !== 'unknown' && commitHashToCheck.length >= 7;

                        return (
                        <>
                          {shouldShowRestore ? (
                            <button
                              onClick={() => handleRestoreCheckpoint(blockToRestore)}
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
                        )
                      })()}

                      {/* RESTORE BLOCK - Timeline design matching other blocks */}
                      {isRestoreBlock ? (
                        <div className="relative pr-8">
                          {/* Continuous dotted line */}
                          <div className="absolute left-[12px] top-[12px] bottom-0 w-[2px] border-l-2 border-dashed border-white/10 z-0" />

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
                                {/* Server Icon */}
                                <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                  <Server size={24} className="text-white opacity-90" />
                                </div>

                                {/* Title + Status */}
                                <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-200">
                                      {deployAction.status === 'in_progress'
                                        ? 'Starting dev server...'
                                        : deployAction.status === 'success'
                                        ? 'Dev Server started successfully'
                                        : 'Failed to start dev server'
                                      }
                                    </span>
                                    {deployAction.status === 'success' && deployAction.data?.url && (
                                      <>
                                        <span className="text-gray-400 text-[11px]">•</span>
                                        <a
                                          href={deployAction.data.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group text-[11px]"
                                        >
                                          <span>{deployAction.data.url}</span>
                                          <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                        </a>
                                      </>
                                    )}
                                    {deployAction.status === 'success' && (
                                      <>
                                        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                          <Check size={10} className="text-green-400" />
                                        </div>
                                        {deployAction.data?.restartTime && (
                                          <span className="text-[10px] text-gray-500">
                                            {deployAction.data.restartTime}s
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {deployAction.status === 'in_progress' && (
                                      <Loader2 size={12} className="text-primary animate-spin" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Timeline Workflow */
                        <div className="relative pr-8">
                        {/* Continuous dotted line from top to bottom - behind icons */}
                        <div className="absolute left-[12px] top-[12px] bottom-0 w-[2px] border-l-2 border-dashed border-white/10 z-0" />

                        {/* STEP 0: USER (User Prompt) - Hide for answer blocks */}
                        {!isAnswerBlock(block) && (
                        <div className="relative pb-4">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* User Avatar */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <User size={24} className="text-white opacity-90" />
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
                        )}

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
                                  {isPlanModeWithAnswers ? 'Exploring & planning' : 'Claude:'}
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

                                // Check if this is the latest tool (for timer display)
                                const toolMessages = block.messages?.filter(m => m.type === 'tool') || []
                                const isLatestTool = message.type === 'tool' && message === toolMessages[toolMessages.length - 1]

                                return (
                                  <div key={idx}>
                                    <div className="flex items-start gap-2">
                                      {message.type === 'assistant' && (
                                        <>
                                          <Bot size={11} className="text-primary flex-shrink-0 opacity-60" style={{ marginTop: '8px' }} />
                                          <div className="flex-1">
                                            <span className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                              {isLong && !isMessageExpanded ? (
                                                getTruncatedMessage(stripQuestions(message.content))
                                              ) : (
                                                <KeywordHighlight
                                                  text={stripQuestions(message.content)}
                                                  keywords={keywords}
                                                  blockId={block.id}
                                                />
                                              )}
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
                                      {message.type === 'tool' && message.toolName && (
                                        <>
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500/50 flex-shrink-0 mt-1.5" />
                                          <span className="text-[11px] text-gray-400 leading-relaxed flex items-center gap-2">
                                            <span>
                                              Claude using tool{' '}
                                              <span className="text-primary font-medium">{message.toolName}</span>
                                              {message.content.includes('@') && (
                                                <> @ {message.content.split('@')[1].trim()}</>
                                              )}
                                            </span>
                                            {isLatestTool && message.toolDuration === undefined && (
                                              // Only show timer for the latest active tool
                                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Clock size={10} />
                                                <>{latestToolTimer.get(block.id)?.toFixed(1) || '0.0'}s</>
                                              </span>
                                            )}
                                          </span>
                                        </>
                                      )}
                                      {message.type === 'thinking' && (
                                        <>
                                          {message.thinkingDuration !== undefined ? (
                                            // Complete thinking - expandable
                                            <div className="flex-1">
                                              <button
                                                onClick={() => {
                                                  const newSet = new Set(expandedThinking)
                                                  if (newSet.has(messageId)) {
                                                    newSet.delete(messageId)
                                                  } else {
                                                    newSet.add(messageId)
                                                  }
                                                  setExpandedThinking(newSet)
                                                }}
                                                className="flex items-center gap-2 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                                              >
                                                <Brain size={9} className="flex-shrink-0" style={{ marginLeft: '1px' }} />
                                                <span className="font-medium">
                                                  Thought for {message.thinkingDuration}s
                                                </span>
                                                <ChevronDown
                                                  size={10}
                                                  className={`transition-transform ${expandedThinking.has(messageId) ? 'rotate-180' : ''}`}
                                                />
                                              </button>
                                              {expandedThinking.has(messageId) && (
                                                <div className="mt-2 pl-6 text-[10px] text-gray-400 leading-relaxed whitespace-pre-wrap border-l-2 border-purple-500/30">
                                                  {message.content}
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            // Active thinking - animated
                                            <div className="flex items-center gap-2">
                                              <Brain size={9} className="flex-shrink-0 text-purple-400" style={{ marginLeft: '1px' }} />
                                              <span className="text-[11px] text-purple-400 font-medium">
                                                Thinking{thinkingDots}
                                              </span>
                                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                <Clock size={10} />
                                                {thinkingTimers.get(block.id)?.toFixed(1) || '0.0'}s
                                              </span>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Completion Stats */}
                            {block.completionStats && (() => {
                              // Extract tool usage from messages
                              const toolUsageMessage = block.messages?.find(m => m.type === 'tool' && !m.toolName)
                              const toolUsage = toolUsageMessage?.content || ''

                              return (
                              <div className="mt-3">
                                <div className="flex items-center gap-2 flex-wrap text-[10px] bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                                  {toolUsage && (
                                    <>
                                      <span className="text-gray-400 flex items-center gap-1">
                                        <span className="text-gray-500">Used tools:</span>
                                        <span className="font-mono text-gray-300">{toolUsage}</span>
                                      </span>
                                      <span className="text-gray-600">|</span>
                                    </>
                                  )}
                                  <span className="text-gray-400 flex items-center gap-1">
                                    <span className="text-gray-500">Tokens:</span>
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
                              </div>
                              )
                            })()}

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
                        </div>

                        {/* STEP: QUESTIONS (Claude needs clarification) - Show when questions exist AND block is complete AND not in plan mode merged view */}
                        {questions && questions.questions && questions.questions.length > 0 && block.isComplete && !isPlanModeWithAnswers && (
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* Anthropic Icon */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6 opacity-90" />
                              </div>

                              {/* Title */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    Claude needs clarification
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Questions content */}
                            <div className="ml-10 space-y-4">
                              {questions.questions.map((q: any, index: number) => (
                                <div key={q.id || index} className="space-y-2">
                                  <label className="block text-[11px] font-medium text-gray-200">
                                    {q.question}
                                  </label>

                                  {/* Text Input */}
                                  {q.type === 'text' && (
                                    <input
                                      type="text"
                                      value={(questionAnswers[q.id] as string) || ''}
                                      onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                                      placeholder="Type your answer..."
                                      className="w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-[11px] text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
                                    />
                                  )}

                                  {/* Radio Buttons */}
                                  {q.type === 'radio' && (
                                    <div className="space-y-1.5">
                                      {q.options?.map((option: string, optIndex: number) => (
                                        <label
                                          key={optIndex}
                                          className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group"
                                        >
                                          <input
                                            type="radio"
                                            name={q.id}
                                            value={option}
                                            checked={questionAnswers[q.id] === option}
                                            onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                                            className="w-3 h-3 text-primary bg-dark-bg border-dark-border focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                          />
                                          <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                            {option}
                                          </span>
                                        </label>
                                      ))}

                                      {/* Hardcoded options */}
                                      <label className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group">
                                        <input
                                          type="radio"
                                          name={q.id}
                                          value="__CLAUDE_DECIDE__"
                                          checked={questionAnswers[q.id] === '__CLAUDE_DECIDE__'}
                                          onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                                          className="w-3 h-3 text-primary bg-dark-bg border-dark-border focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                        />
                                        <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                          Choose what you believe is the best option.
                                        </span>
                                      </label>

                                      <label className="flex items-start gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group">
                                        <input
                                          type="radio"
                                          name={q.id}
                                          value="__CUSTOM__"
                                          checked={questionAnswers[q.id] === '__CUSTOM__'}
                                          onChange={(e) => setQuestionAnswers({ ...questionAnswers, [q.id]: e.target.value })}
                                          className="w-3 h-3 mt-0.5 text-primary bg-dark-bg border-dark-border focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                          <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                            Type something:
                                          </span>
                                          {questionAnswers[q.id] === '__CUSTOM__' && (
                                            <input
                                              type="text"
                                              value={customInputs[q.id] || ''}
                                              onChange={(e) => setCustomInputs({ ...customInputs, [q.id]: e.target.value })}
                                              placeholder="Enter your answer..."
                                              className="mt-1.5 w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-[11px] text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
                                            />
                                          )}
                                        </div>
                                      </label>
                                    </div>
                                  )}

                                  {/* Checkboxes */}
                                  {q.type === 'checkbox' && (
                                    <div className="space-y-1.5">
                                      {q.options?.map((option: string, optIndex: number) => {
                                        const currentArray = Array.isArray(questionAnswers[q.id]) ? questionAnswers[q.id] as string[] : []
                                        const isChecked = currentArray.includes(option)

                                        return (
                                          <label
                                            key={optIndex}
                                            className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleCheckboxAnswer(q.id, option)}
                                              className="w-3 h-3 text-primary bg-dark-bg border-dark-border rounded focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                            />
                                            <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                              {option}
                                            </span>
                                          </label>
                                        )
                                      })}

                                      {/* Hardcoded options */}
                                      <label className="flex items-center gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group">
                                        <input
                                          type="checkbox"
                                          checked={((questionAnswers[q.id] as string[]) || []).includes('__CLAUDE_DECIDE__')}
                                          onChange={() => toggleCheckboxAnswer(q.id, '__CLAUDE_DECIDE__')}
                                          className="w-3 h-3 text-primary bg-dark-bg border-dark-border rounded focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                        />
                                        <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                          Choose what you believe is the best option.
                                        </span>
                                      </label>

                                      <label className="flex items-start gap-2 p-1.5 rounded hover:bg-dark-bg/30 cursor-pointer transition-colors group">
                                        <input
                                          type="checkbox"
                                          checked={((questionAnswers[q.id] as string[]) || []).includes('__CUSTOM__')}
                                          onChange={() => toggleCheckboxAnswer(q.id, '__CUSTOM__')}
                                          className="w-3 h-3 mt-0.5 text-primary bg-dark-bg border-dark-border rounded focus:ring-primary/50 focus:ring-1 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                          <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">
                                            Type something:
                                          </span>
                                          {((questionAnswers[q.id] as string[]) || []).includes('__CUSTOM__') && (
                                            <input
                                              type="text"
                                              value={customInputs[q.id] || ''}
                                              onChange={(e) => setCustomInputs({ ...customInputs, [q.id]: e.target.value })}
                                              placeholder="Enter your answer..."
                                              className="mt-1.5 w-full bg-dark-bg border border-dark-border rounded px-2 py-1.5 text-[11px] text-white placeholder-gray-500 outline-none focus:border-primary/50 transition-colors"
                                            />
                                          )}
                                        </div>
                                      </label>
                                    </div>
                                  )}
                                </div>
                              ))}

                              {/* Submit button */}
                              <div className="pt-2 flex gap-2">
                                <button
                                  onClick={() => {
                                    if (onAnswerQuestions) {
                                      onAnswerQuestions(questionAnswers, customInputs)
                                    }
                                  }}
                                  disabled={!areAllQuestionsAnswered()}
                                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 hover:border-primary/70 rounded text-[11px] text-primary font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Submit Answers
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: Waiting for user input */}
                        {isPlanModeWithAnswers && (
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* Anthropic Icon */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6 opacity-90" />
                              </div>

                              {/* Title + Status */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    Waiting for user input
                                  </span>
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Questions content */}
                            <div className="ml-10">
                              <span className="text-[11px] text-gray-400">
                                Claude asked questions to better understand your requirements
                              </span>
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: User provided answers */}
                        {isPlanModeWithAnswers && answerBlock && (
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* User Avatar */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <User size={24} className="text-white opacity-90" />
                              </div>

                              {/* Title + Status */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    User provided answers
                                  </span>
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Answers content */}
                            <div className="ml-10 space-y-1">
                              {extractAnswers(answerBlock.userPrompt || '').map((answer, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 flex-shrink-0 mt-1.5" />
                                  <span className="text-[11px] text-gray-300">{answer}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: Implementation step (from answer block - Claude's response) */}
                        {isPlanModeWithAnswers && answerBlock && answerBlock.messages && answerBlock.messages.length > 0 && (
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* Anthropic Icon */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6 opacity-90" />
                              </div>

                              {/* Title + Status */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    Creating plan
                                  </span>
                                  {answerBlock.isComplete && (
                                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <Check size={10} className="text-green-400" />
                                    </div>
                                  )}
                                  {answerBlock.isComplete && answerBlock.completionStats && (
                                    <span className="text-[10px] text-gray-500">
                                      {answerBlock.completionStats.timeSeconds}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Implementation messages */}
                            <div className="ml-10 space-y-3">
                              <div className="space-y-1.5">
                                {answerBlock.messages?.filter(m => !m.content.includes('⚠️ Stopped by user')).map((message, idx) => {
                                  const messageId = `${answerBlock.id}-msg-${idx}`
                                  const isLong = isLongMessage(message.content)
                                  const isMessageExpanded = expandedMessages.has(messageId)
                                  const toolMessages = answerBlock.messages?.filter(m => m.type === 'tool') || []
                                  const isLatestTool = message.type === 'tool' && message === toolMessages[toolMessages.length - 1]

                                  return (
                                    <div key={idx}>
                                      <div className="flex items-start gap-2">
                                        {message.type === 'assistant' && (
                                          <>
                                            <Bot size={11} className="text-primary flex-shrink-0 opacity-60" style={{ marginTop: '8px' }} />
                                            <div className="flex-1">
                                              <span className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                {isLong && !isMessageExpanded ? (
                                                  getTruncatedMessage(stripQuestions(message.content))
                                                ) : (
                                                  <KeywordHighlight
                                                    text={stripQuestions(message.content)}
                                                    keywords={keywords}
                                                    blockId={answerBlock.id}
                                                  />
                                                )}
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
                                        {message.type === 'tool' && message.toolName && (
                                          <>
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-500/50 flex-shrink-0 mt-1.5" />
                                            <span className="text-[11px] text-gray-400 leading-relaxed flex items-center gap-2">
                                              <span>
                                                Claude using tool{' '}
                                                <span className="text-primary font-medium">{message.toolName}</span>
                                                {message.content.includes('@') && (
                                                  <> @ {message.content.split('@')[1].trim()}</>
                                                )}
                                              </span>
                                              {isLatestTool && message.toolDuration === undefined && (
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                  <Clock size={10} />
                                                  <>{latestToolTimer.get(answerBlock.id)?.toFixed(1) || '0.0'}s</>
                                                </span>
                                              )}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* Stats for implementation block */}
                              {answerBlock.isComplete && answerBlock.completionStats && (() => {
                                // Extract tool usage from messages
                                const toolUsageMessage = answerBlock.messages?.find(m => m.type === 'tool' && !m.toolName)
                                const toolUsage = toolUsageMessage?.content || ''

                                return (
                                <div className="mt-3">
                                  <div className="flex items-center gap-2 flex-wrap text-[10px] bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                                    {toolUsage && (
                                      <>
                                        <span className="text-gray-400 flex items-center gap-1">
                                          <span className="text-gray-500">Used tools:</span>
                                          <span className="font-mono text-gray-300">{toolUsage}</span>
                                        </span>
                                        <span className="text-gray-600">|</span>
                                      </>
                                    )}
                                    <span className="text-gray-400 flex items-center gap-1">
                                      <span className="text-gray-500">Tokens:</span>
                                      <ArrowUpCircle size={10} className="text-blue-400" />
                                      <span>{answerBlock.completionStats.inputTokens}</span>
                                      <span className="text-gray-600">→</span>
                                      <ArrowDownCircle size={10} className="text-green-400" />
                                      <span>{answerBlock.completionStats.outputTokens}</span>
                                    </span>
                                    <span className="text-gray-600">|</span>
                                    <span className="text-gray-400 flex items-center gap-1">
                                      <DollarSign size={10} />
                                      {answerBlock.completionStats.cost.toFixed(4)}
                                    </span>
                                  </div>
                                </div>
                                )
                              })()}
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: Show blocks that come AFTER the merged view (approval + implementation) */}
                        {isPlanModeWithAnswers && answerBlock && (() => {
                          // Find blocks that come after answerBlock
                          const answerIndex = allBlocks.findIndex(b => b.id === answerBlock.id)
                          const blocksAfterAnswer = answerIndex >= 0 ? allBlocks.slice(answerIndex + 1) : []

                          // Only show blocks that are part of the plan mode session
                          // Stop when we hit a new user conversation (userPrompt that's not approval)
                          const additionalBlocks: any[] = []
                          for (const block of blocksAfterAnswer) {
                            // If this block has a userPrompt that's NOT an approval, it's a new conversation - stop here
                            if (block.userPrompt && !block.userPrompt.includes('approve')) {
                              break
                            }
                            additionalBlocks.push(block)
                          }

                          return additionalBlocks.length > 0 && additionalBlocks.map((afterBlock, idx) => (
                            <div key={afterBlock.id}>
                              {/* User approved plan */}
                              {afterBlock.userPrompt && afterBlock.userPrompt.includes('approve') && (
                                <div className="relative pb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                      <User size={24} className="text-white opacity-90" />
                                    </div>
                                    <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-200">
                                          User approved plan
                                        </span>
                                        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                          <Check size={10} className="text-green-400" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Implementation after approval */}
                              {afterBlock.messages && afterBlock.messages.length > 0 && (
                                <div className="relative pb-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                      <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6 opacity-90" />
                                    </div>
                                    <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-200">
                                          Implementing changes
                                        </span>
                                        {afterBlock.isComplete && (
                                          <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <Check size={10} className="text-green-400" />
                                          </div>
                                        )}
                                        {afterBlock.isComplete && afterBlock.completionStats && (
                                          <span className="text-[10px] text-gray-500">
                                            {afterBlock.completionStats.timeSeconds}s
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="ml-10 space-y-3">
                                    <div className="space-y-1.5">
                                      {afterBlock.messages?.filter(m => !m.content.includes('⚠️ Stopped by user')).map((message, msgIdx) => {
                                        const messageId = `${afterBlock.id}-msg-${msgIdx}`
                                        const isLong = isLongMessage(message.content)
                                        const isMessageExpanded = expandedMessages.has(messageId)
                                        const toolMessages = afterBlock.messages?.filter(m => m.type === 'tool') || []
                                        const isLatestTool = message.type === 'tool' && message === toolMessages[toolMessages.length - 1]

                                        return (
                                          <div key={msgIdx}>
                                            <div className="flex items-start gap-2">
                                              {message.type === 'assistant' && (
                                                <>
                                                  <Bot size={11} className="text-primary flex-shrink-0 opacity-60" style={{ marginTop: '8px' }} />
                                                  <div className="flex-1">
                                                    <span className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                                      {isLong && !isMessageExpanded ? (
                                                        getTruncatedMessage(stripQuestions(message.content))
                                                      ) : (
                                                        <KeywordHighlight
                                                          text={stripQuestions(message.content)}
                                                          keywords={keywords}
                                                          blockId={afterBlock.id}
                                                        />
                                                      )}
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
                                              {message.type === 'tool' && message.toolName && (
                                                <>
                                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500/50 flex-shrink-0 mt-1.5" />
                                                  <span className="text-[11px] text-gray-400 leading-relaxed flex items-center gap-2">
                                                    <span>
                                                      Claude using tool{' '}
                                                      <span className="text-primary font-medium">{message.toolName}</span>
                                                      {message.content.includes('@') && (
                                                        <> @ {message.content.split('@')[1].trim()}</>
                                                      )}
                                                    </span>
                                                    {isLatestTool && message.toolDuration === undefined && (
                                                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        <>{latestToolTimer.get(afterBlock.id)?.toFixed(1) || '0.0'}s</>
                                                      </span>
                                                    )}
                                                  </span>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>

                                    {afterBlock.isComplete && afterBlock.completionStats && (() => {
                                      // Extract tool usage from messages
                                      const toolUsageMessage = afterBlock.messages?.find(m => m.type === 'tool' && !m.toolName)
                                      const toolUsage = toolUsageMessage?.content || ''

                                      return (
                                      <div className="mt-3">
                                        <div className="flex items-center gap-2 flex-wrap text-[10px] bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                                          {toolUsage && (
                                            <>
                                              <span className="text-gray-400 flex items-center gap-1">
                                                <span className="text-gray-500">Used tools:</span>
                                                <span className="font-mono text-gray-300">{toolUsage}</span>
                                              </span>
                                              <span className="text-gray-600">|</span>
                                            </>
                                          )}
                                          <span className="text-gray-400 flex items-center gap-1">
                                            <span className="text-gray-500">Tokens:</span>
                                            <ArrowUpCircle size={10} className="text-blue-400" />
                                            <span>{afterBlock.completionStats.inputTokens}</span>
                                            <span className="text-gray-600">→</span>
                                            <ArrowDownCircle size={10} className="text-green-400" />
                                            <span>{afterBlock.completionStats.outputTokens}</span>
                                          </span>
                                          <span className="text-gray-600">|</span>
                                          <span className="text-gray-400 flex items-center gap-1">
                                            <DollarSign size={10} />
                                            {afterBlock.completionStats.cost.toFixed(4)}
                                          </span>
                                        </div>
                                      </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )}

                              {/* Show actions (commit, dev server) for this block */}
                              {afterBlock.actions && afterBlock.actions.length > 0 && afterBlock.actions.map((action, actionIdx) => {
                                if (action.type === 'git_commit' && action.status) {
                                  return (
                                    <div key={`git-${actionIdx}`} className="relative pb-4">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                          <img src={GitIcon} alt="Git" className="w-6 h-6 opacity-90" />
                                        </div>
                                        <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium text-gray-200">
                                              {action.status === 'success' ? 'Committed successfully' : 'Committing...'}
                                            </span>
                                            {action.status === 'success' && action.data?.commitHash && (
                                              <span className="font-mono text-[11px] bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded text-gray-400">
                                                {action.data.commitHash}
                                              </span>
                                            )}
                                            {action.status === 'success' && action.data?.filesChanged !== undefined && (
                                              <>
                                                <span className="text-gray-400 text-[11px]">•</span>
                                                <span className="text-[11px] text-gray-400">
                                                  {action.data.filesChanged} file{action.data.filesChanged !== 1 ? 's' : ''} changed
                                                </span>
                                              </>
                                            )}
                                            {action.status === 'success' && (
                                              <>
                                                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                                  <Check size={10} className="text-green-400" />
                                                </div>
                                                <span className="text-[10px] text-gray-500">
                                                  0.1s
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                                if (action.type === 'dev_server' && action.status) {
                                  return (
                                    <div key={`dev-${actionIdx}`} className="relative pb-4">
                                      <div className="flex items-center gap-3 mb-3">
                                        <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                          <Server size={24} className="text-white opacity-90" />
                                        </div>
                                        <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium text-gray-200">
                                              {action.status === 'success' ? 'Dev Server started successfully' : 'Starting dev server...'}
                                            </span>
                                            {action.status === 'success' && action.data?.url && (
                                              <>
                                                <span className="text-gray-400 text-[11px]">•</span>
                                                <a
                                                  href={action.data.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group text-[11px]"
                                                >
                                                  <span>{action.data.url}</span>
                                                  <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                                </a>
                                              </>
                                            )}
                                            {action.status === 'success' && (
                                              <>
                                                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                                  <Check size={10} className="text-green-400" />
                                                </div>
                                                {action.data?.restartTime && (
                                                  <span className="text-[10px] text-gray-500">
                                                    {action.data.restartTime}s
                                                  </span>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                                return null
                              })}
                            </div>
                          ))
                        })()}

                        {/* PLAN MODE: Plan approval (show when plan is ready) */}
                        {needsApproval && (
                          <div className="relative pb-4">
                            {/* Step header */}
                            <div className="flex items-center gap-3 mb-3">
                              {/* User Avatar */}
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                                <User size={24} className="text-white opacity-90" />
                              </div>

                              {/* Title */}
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    Plan ready for approval
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Approval content */}
                            <div className="ml-10">
                              <p className="text-[11px] text-gray-300 mb-3">
                                Review Claude's plan above. Choose an action below:
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (onApprovePlan) {
                                      onApprovePlan()
                                    }
                                  }}
                                  className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 hover:border-primary/70 rounded text-[11px] text-primary font-medium transition-all"
                                >
                                  Yes, confirm
                                </button>
                                <button
                                  onClick={() => {
                                    if (onRejectPlan) {
                                      onRejectPlan()
                                    }
                                  }}
                                  className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/50 hover:border-gray-500/70 rounded text-[11px] text-gray-300 font-medium transition-all"
                                >
                                  No, keep planning
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: User approval indicator */}
                        {isPlanReady && implementationBlock && (
                          <div className="relative pb-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10">
                                <User size={24} className="text-white opacity-90" />
                              </div>
                              <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-200">
                                    User approved plan
                                  </span>
                                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                    <Check size={10} className="text-green-400" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PLAN MODE: Show implementation (Claude executing the plan) */}
                        {isPlanReady && implementationBlock && (
                          <div className="relative pb-4">
                            {/* Claude header */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex-shrink-0 bg-white/[0.02] relative z-10">
                                <img src={AnthropicIcon} alt="Anthropic" className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap" style={{ marginTop: '3px' }}>
                                <span className="text-sm font-medium text-gray-200">
                                  Claude:
                                </span>
                                {implementationBlock.isComplete && implementationBlock.completionStats && (
                                  <span className="text-[10px] text-gray-500">
                                    {implementationBlock.completionStats.timeSeconds}s
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Implementation content */}
                            <div className="ml-10">
                              {/* Implementation messages */}
                              {implementationBlock.messages && implementationBlock.messages
                                .filter(m => m.type === 'assistant' || m.type === 'thinking' || m.type === 'tool')
                                .map((msg, msgIdx) => {
                                  if (msg.type === 'thinking') {
                                    return (
                                      <div key={`impl-thinking-${msgIdx}`} className="mb-2 text-[11px] text-gray-500 italic">
                                        Thought for {msg.thinkingDuration || '...'}s
                                      </div>
                                    )
                                  }

                                  if (msg.type === 'tool') {
                                    return null // Tools shown separately in stats
                                  }

                                  return (
                                    <div key={`impl-msg-${msgIdx}`} className="mb-3">
                                      <div className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                                        {msg.content}
                                      </div>
                                    </div>
                                  )
                                })}

                              {/* Implementation stats */}
                              {implementationBlock.completionStats && (() => {
                                const toolUsageMessage = implementationBlock.messages?.find(m => m.type === 'tool' && !m.toolName)
                                const toolUsage = toolUsageMessage?.content || ''

                                return (
                                  <div className="mt-3">
                                    <div className="flex items-center gap-2 flex-wrap text-[10px] bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2">
                                      {toolUsage && (
                                        <>
                                          <span className="text-gray-400 flex items-center gap-1">
                                            <span className="text-gray-500">Used tools:</span>
                                            <span className="font-mono text-gray-300">{toolUsage}</span>
                                          </span>
                                          <span className="text-gray-600">|</span>
                                        </>
                                      )}
                                      <span className="text-gray-400 flex items-center gap-1">
                                        <span className="text-gray-500">Tokens:</span>
                                        <ArrowUpCircle size={10} className="text-blue-400" />
                                        <span>{implementationBlock.completionStats.inputTokens}</span>
                                        <span className="text-gray-600">→</span>
                                        <ArrowDownCircle size={10} className="text-green-400" />
                                        <span>{implementationBlock.completionStats.outputTokens}</span>
                                      </span>
                                      <span className="text-gray-600">|</span>
                                      <span className="text-gray-400 flex items-center gap-1">
                                        <DollarSign size={10} />
                                        {implementationBlock.completionStats.cost.toFixed(4)}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )}

                      {/* STEP 2: GIT (GitHub Commit) - Use answer/implementation block in plan mode */}
                      {(() => {
                        const gitBlockToUse =
                          (isPlanModeWithAnswers && answerBlock) ? answerBlock :
                          (isPlanReady && implementationBlock) ? implementationBlock :
                          block
                        const git = gitBlockToUse?.actions?.find(a => a.type === 'git_commit')
                        // Only show if git action exists AND has started
                        const shouldShowGit = git && git.status
                        return shouldShowGit && (
                        <div className="relative pb-4">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Icon - Adjust left/right positioning here */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <img src={GitIcon} alt="Git" className="w-6 h-6 opacity-90" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-200">
                                  {git.status === 'in_progress'
                                    ? 'Committing and pushing to GitHub...'
                                    : git.status === 'success'
                                    ? 'Committed successfully'
                                    : 'Commit failed'
                                  }
                                </span>
                                {git.status === 'success' && git.data?.commitHash && (
                                  <span className="font-mono text-[11px] bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded text-gray-400">
                                    {git.data.commitHash}
                                  </span>
                                )}
                                {git.status === 'success' && git.data?.filesChanged !== undefined && (
                                  <>
                                    <span className="text-gray-400 text-[11px]">•</span>
                                    <span className="text-[11px] text-gray-400">
                                      {git.data.filesChanged} file{git.data.filesChanged !== 1 ? 's' : ''} changed
                                    </span>
                                  </>
                                )}
                                {git.status === 'success' && (
                                  <>
                                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <Check size={10} className="text-green-400" />
                                    </div>
                                    <span className="text-[10px] text-gray-500">
                                      0.1s
                                    </span>
                                  </>
                                )}
                                {git.status === 'in_progress' && (
                                  <Loader2 size={12} className="text-primary animate-spin" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        )
                      })()}

                      {/* STEP 3: DEPLOY (Dev Server) - Use answer/implementation block in plan mode */}
                      {(() => {
                        const deployBlockToUse =
                          (isPlanModeWithAnswers && answerBlock) ? answerBlock :
                          (isPlanReady && implementationBlock) ? implementationBlock :
                          block
                        const deploy = deployBlockToUse?.actions?.find(a => a.type === 'dev_server')
                        // Only show if deploy action exists AND has started
                        const shouldShowDeploy = deploy && deploy.status
                        return shouldShowDeploy && (
                        <div className="relative">
                          {/* Step header */}
                          <div className="flex items-center gap-3 mb-3">
                            {/* Server Icon */}
                            <div className="flex-shrink-0 bg-white/[0.02] relative z-10" style={{ marginLeft: '0px', marginRight: '0px' }}>
                              <Server size={24} className="text-white opacity-90" />
                            </div>

                            {/* Title + Status */}
                            <div className="flex-1 min-w-0" style={{ marginTop: '3px' }}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-200">
                                  {deploy.status === 'in_progress'
                                    ? 'Starting dev server...'
                                    : deploy.status === 'success'
                                    ? 'Dev Server started successfully'
                                    : 'Failed to start dev server'
                                  }
                                </span>
                                {deploy.status === 'success' && deploy.data?.url && (
                                  <>
                                    <span className="text-gray-400 text-[11px]">•</span>
                                    <a
                                      href={deploy.data.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group text-[11px]"
                                    >
                                      <span>{deploy.data.url}</span>
                                      <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                    </a>
                                  </>
                                )}
                                {deploy.status === 'success' && (
                                  <>
                                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                      <Check size={10} className="text-green-400" />
                                    </div>
                                    {deploy.data?.restartTime && (
                                      <span className="text-[10px] text-gray-500">
                                        {deploy.data.restartTime}s
                                      </span>
                                    )}
                                  </>
                                )}
                                {deploy.status === 'in_progress' && (
                                  <Loader2 size={12} className="text-primary animate-spin" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        )
                      })()}

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
          .icon-bounce {
            animation: bounce-icon 2s ease-out infinite;
          }
          @keyframes bounce-icon {
            0%, 100% {
              transform: translateY(0);
              animation-timing-function: ease-out;
            }
            20% {
              transform: translateY(-11px);
              animation-timing-function: ease-in;
            }
            40% {
              transform: translateY(0);
              animation-timing-function: ease-out;
            }
            45% {
              transform: translateY(-2px);
              animation-timing-function: ease-in;
            }
            50% {
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    </div>
      )}
    </>
  )
}

export default StatusSheet
