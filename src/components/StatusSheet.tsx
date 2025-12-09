import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronUp, Loader2, User, Bot, Square, Rocket, Globe, ExternalLink, CheckCircle2, Check, ArrowDownCircle, ArrowUpCircle, DollarSign, Info, X, Brain, Clock, Server, ClipboardCheck, Copy } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { MessageContent } from './MessageContent'

// Types
import type { ConversationBlock, StatusSheetProps } from '../types/statusSheet'

// Helpers
import {
  hasPlanWaitingApproval,
  safeParse,
  transformBlock,
  estimatePromptLines,
  getPromptFontSize,
} from '../utils/statusSheetHelpers'

// Assets
import AnthropicIcon from '../assets/images/anthropic.svg'
import GitIcon from '../assets/images/git.svg'
import successSound from '../assets/sounds/success.wav'

function StatusSheet({ projectId, actionBarRef, onMouseEnter, onMouseLeave, onStopClick, onApprovePlan, onRejectPlan, onXMLTagClick, onXMLTagDetected, onFixDeploymentError }: StatusSheetProps) {
  const { showStatusSheet, setShowStatusSheet, viewMode } = useAppStore()
  const { layoutState, statusSheetExpanded, setStatusSheetExpanded, setPreviewHidden } = useLayoutStore()
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
  const [deploymentTimer, setDeploymentTimer] = useState<Map<string, number>>(new Map()) // blockId -> elapsed time
  const [keywords, setKeywords] = useState<Record<string, string>>({})
  const [overflowingMessages, setOverflowingMessages] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const statusSheetRef = useRef<HTMLDivElement>(null)
  const prevLayoutStateRef = useRef<string>(layoutState)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Ref for currentOffset to fix stale closure in scroll handler
  const currentOffsetRef = useRef(currentOffset)
  currentOffsetRef.current = currentOffset

  // Ref to prevent double-click on restore
  const isRestoringRef = useRef(false)

  // State for restore confirmation
  const [confirmingRestoreBlockId, setConfirmingRestoreBlockId] = useState<string | null>(null)

  // Detect overflow for messages
  useEffect(() => {
    const checkOverflow = () => {
      const newOverflowingMessages = new Set<string>()

      messageRefs.current.forEach((element, messageId) => {
        if (element && element.scrollHeight > element.clientHeight) {
          newOverflowingMessages.add(messageId)
        }
      })

      setOverflowingMessages(newOverflowingMessages)
    }

    // Use requestAnimationFrame to ensure DOM is fully laid out before checking
    // This fixes the issue where overflow isn't detected after app reload
    const rafId = requestAnimationFrame(() => {
      // Additional timeout to ensure styles are applied
      setTimeout(checkOverflow, 50)
    })

    const handleResize = () => checkOverflow()
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [allBlocks, expandedMessages, isExpanded])


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

  // Handle restore to checkpoint (with debounce protection)
  const handleRestoreCheckpoint = async (block: ConversationBlock) => {
    // Prevent double-click
    if (isRestoringRef.current) return
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

    isRestoringRef.current = true
    try {
      const result = await window.electronAPI.git.restoreCheckpoint(projectId, block.commitHash)

      if (!result.success) {
        console.error(`❌ Failed to restore checkpoint: ${result.error}`)
      }
    } catch (error) {
      console.error('❌ Error restoring checkpoint:', error)
    } finally {
      isRestoringRef.current = false
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
          const messages = safeParse(block.claudeMessages, [])
          if (Array.isArray(messages)) {
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
        }
      } catch (e) {
        console.error('Failed to check interruption:', e)
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

  // Listen for deployment events from backend
  useEffect(() => {
    if (!projectId || !window.electronAPI?.deployment) return

    // When deployment starts
    const unsubStarted = window.electronAPI.deployment.onStarted((id: string, provider: string, projectName: string) => {
      if (id !== projectId) return

      // Create deployment block
      const deploymentBlock: ConversationBlock = {
        id: `deploy-${Date.now()}`,
        projectId: id,
        type: 'deployment',
        isComplete: false,
        deploymentProvider: provider as 'netlify' | 'railway' | 'vercel',
        deploymentStartTime: Date.now(),
        deploymentLogs: [],
        deploymentStages: provider === 'netlify'
          ? [
              { label: 'Building project', isComplete: false },
              { label: 'Uploading to Netlify', isComplete: false },
              { label: 'Deploying', isComplete: false },
            ]
          : provider === 'vercel'
          ? [
              { label: 'Building project', isComplete: false },
              { label: 'Deploying to Vercel', isComplete: false },
            ]
          : [
              { label: 'Creating services', isComplete: false },
              { label: 'Building Backend', isComplete: false },
              { label: 'Deploying Backend', isComplete: false },
              { label: 'Building Frontend', isComplete: false },
              { label: 'Deploying Frontend', isComplete: false },
            ],
      }
      setAllBlocks(prev => [...prev, deploymentBlock])
    })

    // When progress updates come in
    const unsubProgress = window.electronAPI.deployment.onProgress((id: string, message: string) => {
      if (id !== projectId) return

      setAllBlocks(prev => prev.map(block => {
        if (block.type === 'deployment' && !block.isComplete && block.projectId === id) {
          // Update stages based on message content
          const updatedStages = [...(block.deploymentStages || [])]
          const logs = [...(block.deploymentLogs || []), message]

          // Parse progress messages to update stages
          if (block.deploymentProvider === 'netlify') {
            if (message.includes('Build complete') || message.includes('built in')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
            }
            // Build FAILED - mark Building project as failed
            if (message.includes('Build') && message.includes('FAILED')) {
              updatedStages[0] = { ...updatedStages[0], isFailed: true }
            }
            if (message.includes('Uploading') || message.includes('Finished uploading')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: message.includes('Finished') }
            }
            if (message.includes('Deploy is live') || message.includes('Deploy complete')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isComplete: true }
            }
          } else if (block.deploymentProvider === 'railway') {
            // Stages: [0] Creating services, [1] Building Backend, [2] Deploying Backend, [3] Building Frontend, [4] Deploying Frontend

            // Creating services complete when we start building
            if (message.includes('Deploying') && message.includes('service')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
            }

            // Backend stages
            if (message.includes('Backend') && message.includes('BUILDING')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              // Building Backend in progress (not complete yet)
            }
            if (message.includes('Backend') && message.includes('DEPLOYING')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              // Deploying Backend in progress
            }
            if (message.includes('Backend') && message.includes('SUCCESS')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isComplete: true }
            }
            // Backend FAILED - mark Building Backend as failed
            if (message.includes('Backend') && message.includes('FAILED')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isFailed: true }
            }
            // Backend CRASHED - deployed successfully but crashed at runtime
            if (message.includes('Backend') && message.includes('CRASHED')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isFailed: true, label: 'Backend Crashed' }
            }

            // Frontend stages
            if (message.includes('Frontend') && message.includes('BUILDING')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              // Building Frontend in progress
            }
            if (message.includes('Frontend') && message.includes('DEPLOYING')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[3] = { ...updatedStages[3], isComplete: true }
              // Deploying Frontend in progress
            }
            if (message.includes('Frontend') && message.includes('SUCCESS')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[3] = { ...updatedStages[3], isComplete: true }
              updatedStages[4] = { ...updatedStages[4], isComplete: true }
            }
            // Frontend FAILED - mark Building Frontend as failed
            if (message.includes('Frontend') && message.includes('FAILED')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              // Backend should be complete if we got to frontend
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isComplete: true }
              updatedStages[3] = { ...updatedStages[3], isFailed: true }
            }
            // Frontend CRASHED - deployed successfully but crashed at runtime
            if (message.includes('Frontend') && message.includes('CRASHED')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isComplete: true }
              updatedStages[3] = { ...updatedStages[3], isComplete: true }
              updatedStages[4] = { ...updatedStages[4], isFailed: true, label: 'Frontend Crashed' }
            }

            // All services running - mark everything complete
            if (message.includes('All services running')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
              updatedStages[2] = { ...updatedStages[2], isComplete: true }
              updatedStages[3] = { ...updatedStages[3], isComplete: true }
              updatedStages[4] = { ...updatedStages[4], isComplete: true }
            }
          } else if (block.deploymentProvider === 'vercel') {
            // Stages: [0] Building project, [1] Deploying to Vercel
            if (message.includes('Build complete') || message.includes('built in')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
            }
            // Build FAILED
            if (message.includes('Build') && message.includes('FAILED')) {
              updatedStages[0] = { ...updatedStages[0], isFailed: true }
            }
            if (message.includes('Deploying to Vercel')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
            }
            if (message.includes('Deployed successfully') || message.includes('Production:')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isComplete: true }
            }
            // Deploy FAILED
            if (message.includes('Deploy failed')) {
              updatedStages[0] = { ...updatedStages[0], isComplete: true }
              updatedStages[1] = { ...updatedStages[1], isFailed: true }
            }
          }

          return {
            ...block,
            deploymentStages: updatedStages,
            deploymentLogs: logs,
          }
        }
        return block
      }))
    })

    // When deployment completes
    const unsubComplete = window.electronAPI.deployment.onComplete((id: string, result: any) => {
      if (id !== projectId) {
        return
      }

      setAllBlocks(prev => {
        return prev.map(block => {
          if (block.type === 'deployment' && !block.isComplete && block.projectId === id) {
            let updatedStages = block.deploymentStages

            if (result.success) {
              // Mark all stages as complete
              updatedStages = block.deploymentStages?.map(s => ({ ...s, isComplete: true }))
            } else {
              // Mark the current (first non-complete) stage as failed
              updatedStages = block.deploymentStages?.map((s, idx) => {
                // Find first non-complete stage and mark it as failed
                const firstIncompleteIdx = block.deploymentStages?.findIndex(stage => !stage.isComplete && !stage.isFailed)
                if (idx === firstIncompleteIdx) {
                  return { ...s, isFailed: true }
                }
                return s
              })
            }

            return {
              ...block,
              isComplete: true,
              completedAt: Date.now(),
              deploymentUrl: result.success ? result.url : undefined,
              deploymentError: result.success ? undefined : result.error,
              deploymentStages: updatedStages,
            }
          }
          return block
        })
      })
    })

    return () => {
      unsubStarted?.()
      unsubProgress?.()
      unsubComplete?.()
    }
  }, [projectId])

  // Track if user is near bottom (for smart auto-scroll)
  const isNearBottomRef = useRef(true)

  // Update near-bottom status on scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || !isExpanded) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      isNearBottomRef.current = distanceFromBottom < 150
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [isExpanded])

  // Auto-scroll to bottom only if user is near bottom
  useEffect(() => {
    if (isExpanded && scrollContainerRef.current && isNearBottomRef.current) {
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

  // Track elapsed time for deployment blocks
  useEffect(() => {
    const intervals: NodeJS.Timeout[] = []

    allBlocks.forEach(block => {
      if (block.type === 'deployment' && !block.isComplete && block.deploymentStartTime) {
        const interval = setInterval(() => {
          setDeploymentTimer(prev => {
            const newMap = new Map(prev)
            const elapsed = (Date.now() - block.deploymentStartTime!) / 1000
            newMap.set(block.id, elapsed)
            return newMap
          })
        }, 100)
        intervals.push(interval)
      } else if (block.type === 'deployment' && block.isComplete) {
        // Clear timer for completed deployments
        setDeploymentTimer(prev => {
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
  // Uses refs for offset to avoid stale closure issues
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || !statusSheetExpanded) return

    const handleScroll = () => {
      const { scrollTop } = scrollContainer
      const threshold = 100 // Load more when within 100px of top

      if (scrollTop <= threshold && hasMoreBlocks && !isLoadingMore) {
        loadMoreBlocks()
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [statusSheetExpanded, hasMoreBlocks, isLoadingMore])

  // Check if there's any conversation history
  const hasHistory = allBlocks.length > 0

  // Calculate these values BEFORE early returns (must always execute in same order)
  const currentBlock = hasHistory ? allBlocks[allBlocks.length - 1] : null
  const latestMessage = currentBlock && currentBlock.type === 'conversation' && currentBlock.messages
    ? currentBlock.messages[currentBlock.messages.length - 1]
    : null
  const isWorking = currentBlock ? !currentBlock.isComplete : false

  // Get display text and icon for collapsed state (memoized for performance)
  const collapsedState = useMemo(() => {
    if (!currentBlock) {
      return { text: '', icon: null, needsAttention: false }
    }

    // Check if plan is ready and needs approval (use helper function)
    if (currentBlock.type === 'conversation' && hasPlanWaitingApproval(currentBlock)) {
      return { text: 'Plan ready - click to review and approve', icon: ClipboardCheck, needsAttention: true }
    }

    if (currentBlock.type === 'deployment') {
      // Check if any stage failed
      const hasFailed = currentBlock.deploymentStages?.some(s => s.isFailed)
      if (hasFailed) {
        return { text: 'Deployment failed', icon: X, needsAttention: true }
      }
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

    if (currentBlock.type === 'context_cleared') {
      return { text: 'Initiated a Fresh Context Window', icon: User, needsAttention: false }
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
  }, [currentBlock, latestMessage])

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
        const newHeight = entry.target.clientHeight
        setActionBarHeight(newHeight)
      }
    })

    resizeObserver.observe(actionBarRef.current)

    // Set initial height
    const initialHeight = actionBarRef.current.clientHeight
    setActionBarHeight(initialHeight)

    return () => {
      resizeObserver.disconnect()
    }
  }, [actionBarRef])

  // Sync local expanded state with store
  useEffect(() => {
    setIsExpanded(statusSheetExpanded)
  }, [statusSheetExpanded])

  // Hide/show preview when StatusSheet expands/collapses
  useEffect(() => {
    if (!projectId || layoutState !== 'DEFAULT') return

    if (statusSheetExpanded) {
      window.electronAPI?.preview.hide(projectId)
      setPreviewHidden(true)
    } else {
      window.electronAPI?.preview.show(projectId)
      setPreviewHidden(false)
    }
  }, [statusSheetExpanded, projectId, layoutState, setPreviewHidden])

  // Handler for expanding StatusSheet
  const handleExpand = useCallback(() => {
    setIsExpanded(true)
    setStatusSheetExpanded(true)
    setShowStatusSheet(true)
  }, [setStatusSheetExpanded, setShowStatusSheet])

  // Handler for collapsing StatusSheet
  const handleCollapse = useCallback(() => {
    setIsExpanded(false)
    setStatusSheetExpanded(false)
    setShowStatusSheet(false)
  }, [setStatusSheetExpanded, setShowStatusSheet])

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
  const bottomPosition = actionBarHeight > 0 ? actionBarHeight + baseOffset : 76

  // Always render if has history (show collapsed or expanded based on state)
  const shouldRender = hasHistory

  return (
    <>
      {shouldRender && (
        <div
          className={`absolute z-[99] pointer-events-none ${isVisible ? 'opacity-100' : 'opacity-0'
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
            className="bg-dark-card border border-dark-border shadow-2xl w-full overflow-hidden pb-4 relative pointer-events-auto rounded-br-[10px]"
            style={{
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
            }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            {/* Collapsed State - Single Clickable Row */}
            {!isExpanded && (() => {
              const IconComponent = collapsedState.icon

              return (
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors relative z-10 h-[40px] overflow-hidden"
                  onClick={handleExpand}
                >
                  {currentBlock?.type === 'deployment' || currentBlock?.type === 'initialization' ? (
                    <>
                      {isWorking ? (
                        <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <>
                          {currentBlock?.type === 'deployment' ? (
                            <Globe size={14} className={`text-primary flex-shrink-0 ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                          ) : (
                            <Rocket size={14} className={`text-primary flex-shrink-0 ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                          )}
                        </>
                      )}
                      <span className="text-[13px] text-gray-200 flex-1 line-clamp-1">{collapsedState.text}</span>
                      <ChevronUp size={14} className="text-gray-400" />
                    </>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      {isWorking ? (
                        <Loader2 size={14} className="text-primary animate-spin flex-shrink-0" />
                      ) : IconComponent ? (
                        <IconComponent size={14} className={`flex-shrink-0 text-primary ${collapsedState.needsAttention ? 'icon-bounce' : ''}`} />
                      ) : null}
                      <span className="text-[13px] text-gray-200 flex-1 line-clamp-1">
                        {collapsedState.text}
                      </span>
                      {/* Stop button - only show when working on conversation */}
                      <div className="w-[28px] flex items-center justify-center flex-shrink-0">
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
                      </div>
                      <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
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
                  className="flex items-center justify-between mb-3 py-2.5 cursor-pointer hover:bg-white/5 px-3 transition-colors relative overflow-hidden"
                  onClick={handleCollapse}
                >
                  <span className="text-[13px] font-medium text-gray-300">Workflow Activity</span>
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
                      <span className="ml-2 text-[13px] text-gray-400">Loading older messages...</span>
                    </div>
                  )}

                  {allBlocks.map((block, blockIndex) => {
                    // ============================================================
                    // NEW SIMPLIFIED LOGIC: Use interactionType to determine rendering
                    // Fall back to old detection methods if interactionType is not set
                    // ============================================================

                    const blockType = block.interactionType || 'unknown';

                    // Skip answer blocks (legacy interaction type)
                    const isAnswers = blockType === 'answers';
                    if (isAnswers) {
                      return null;
                    }

                    // Get the actual index and check what comes next
                    const actualIndex = allBlocks.findIndex(b => b.id === block.id);
                    const nextBlock = actualIndex >= 0 && actualIndex < allBlocks.length - 1 ? allBlocks[actualIndex + 1] : null;

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
                      const isFork = !!block.sourceProjectName
                      return (
                        <div key={block.id} className="mb-6">
                          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4 relative">
                            {/* STEP 1: Initiating new project or Forked from */}
                            <div className="timeline-step">
                              <div className="step-track">
                                <div className="step-icon step-icon-user">
                                  {isFork ? (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white opacity-90">
                                      <circle cx="12" cy="18" r="3" />
                                      <circle cx="6" cy="6" r="3" />
                                      <circle cx="18" cy="6" r="3" />
                                      <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                                      <path d="M12 12v3" />
                                    </svg>
                                  ) : (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white opacity-90">
                                      <path d="M12 5v14M5 12h14" />
                                    </svg>
                                  )}
                                </div>
                                <div className="step-line"></div>
                              </div>
                              <div className="step-content">
                                <div className="flex items-center gap-2 pt-1 pb-2">
                                  <span className="text-[14px] font-semibold text-gray-100">
                                    {isFork ? `Forked from ${block.sourceProjectName}` : 'Initiating new project'}
                                  </span>
                                  {!block.isComplete && (
                                    <Loader2 size={12} className="text-primary animate-spin" />
                                  )}
                                </div>
                                {/* Initialization Stages */}
                                <div className="space-y-2">
                                  {block.initializationStages?.map((stage, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      {stage.isComplete ? (
                                        <Check size={12} className="text-green-400 flex-shrink-0" />
                                      ) : (
                                        <Loader2 size={12} className="text-primary animate-spin flex-shrink-0" />
                                      )}
                                      <span className={`text-[13px] ${stage.isComplete ? 'text-gray-400' : 'text-gray-300'}`}>
                                        {stage.label}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* STEP 2: Project Ready (only show when complete) */}
                            {block.isComplete && (
                              <div className="timeline-step">
                                <div className="step-track">
                                  <div className="step-icon" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                                    <Rocket size={14} className="text-green-400" />
                                  </div>
                                </div>
                                <div className="step-content">
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[14px] font-semibold text-gray-100">Your project is ready</span>
                                    <Check size={12} className="text-green-400" />
                                  </div>
                                  {/* Restore button for initial project state */}
                                  {block.commitHash && block.commitHash !== 'unknown' && block.commitHash.length >= 7 && (
                                    <div className="mt-3">
                                      {confirmingRestoreBlockId === block.id ? (
                                        <div className="flex items-center gap-2">
                                          <div className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary">
                                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                              <path d="M3 3v5h5" />
                                            </svg>
                                            <span className="text-[13px] text-primary font-medium">Restore to initial state?</span>
                                          </div>
                                          <button
                                            onClick={() => {
                                              handleRestoreCheckpoint(block)
                                              setConfirmingRestoreBlockId(null)
                                            }}
                                            className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded transition-colors"
                                            title="Confirm restore"
                                          >
                                            <Check size={14} className="text-green-400" />
                                          </button>
                                          <button
                                            onClick={() => setConfirmingRestoreBlockId(null)}
                                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                                            title="Cancel"
                                          >
                                            <X size={14} className="text-red-400" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmingRestoreBlockId(block.id)}
                                          className="group inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded transition-colors"
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary group-hover:text-primary-light">
                                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                            <path d="M3 3v5h5" />
                                          </svg>
                                          <span className="text-[13px] text-primary group-hover:text-primary-light font-medium">Restore to initial state</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Render context cleared block
                    if (block.type === 'context_cleared') {
                      return (
                        <div key={block.id} className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/20 relative mb-6">
                          {/* Timestamp (top right) */}
                          {block.completedAt && (
                            <span className="absolute top-3 right-3 text-[11px] text-gray-500 z-10">
                              {new Date(block.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                              <User size={14} className="text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <span className="text-[13px] font-medium text-blue-400">
                                Initiated a Fresh Context Window
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // Render deployment block with timeline design
                    if (block.type === 'deployment') {
                      const providerName = block.deploymentProvider === 'railway' ? 'Railway' : block.deploymentProvider === 'vercel' ? 'Vercel' : 'Netlify'
                      // Use live timer for in-progress, calculated time for completed
                      const elapsedTime = block.isComplete && block.deploymentStartTime && block.completedAt
                        ? (block.completedAt - block.deploymentStartTime) / 1000
                        : deploymentTimer.get(block.id) || 0
                      const currentStage = block.deploymentStages?.find(s => !s.isComplete)

                      return (
                        <div key={block.id} className="mb-6">
                          <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4 relative">
                            {/* Timestamp */}
                            {block.isComplete && block.completedAt && (
                              <span className="absolute top-3 right-3 text-[11px] text-gray-500 z-10">
                                {new Date(block.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}

                            {/* Timeline Step */}
                            <div className="timeline-step">
                              <div className="step-track">
                                <div className="step-icon step-icon-deploy">
                                  <Rocket size={14} className="text-white opacity-90" />
                                </div>
                                {block.deploymentUrl && <div className="step-line"></div>}
                              </div>
                              <div className="step-content">
                                {/* Header */}
                                {(() => {
                                  // Check if any stage failed
                                  const hasFailed = block.deploymentStages?.some(s => s.isFailed)
                                  // Check if all stages are complete (health check phase)
                                  const allStagesComplete = block.deploymentStages?.every(s => s.isComplete) && !hasFailed
                                  const isHealthCheckPhase = allStagesComplete && !block.isComplete

                                  return (
                                    <div className="flex flex-col gap-1 pt-1 pb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[14px] font-semibold ${hasFailed ? 'text-red-400' : 'text-gray-100'}`}>
                                          {hasFailed
                                            ? `${providerName} Deployment Failed`
                                            : block.isComplete
                                            ? `Deployed to ${providerName}`
                                            : isHealthCheckPhase
                                            ? `Deployed to ${providerName}`
                                            : `Deploying to ${providerName}`}
                                        </span>
                                        {hasFailed ? (
                                          <span className="text-[12px] text-gray-500">{elapsedTime.toFixed(1)}s</span>
                                        ) : block.isComplete ? (
                                          <span className="text-[12px] text-gray-500">{elapsedTime.toFixed(1)}s</span>
                                        ) : (
                                          <Loader2 size={12} className="text-primary animate-spin" />
                                        )}
                                      </div>
                                      {/* Subtext for different phases */}
                                      {!block.isComplete && !hasFailed && (
                                        <span className="text-[11px] text-gray-500">
                                          {isHealthCheckPhase
                                            ? 'Running health checks to make sure everything works...'
                                            : 'This can take up to 5 minutes'}
                                        </span>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Deployment Stages */}
                                <div className="space-y-2">
                                  {block.deploymentStages?.map((stage, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      {stage.isFailed ? (
                                        <X size={12} className="text-red-400 flex-shrink-0" />
                                      ) : stage.isComplete ? (
                                        <Check size={12} className="text-green-400 flex-shrink-0" />
                                      ) : currentStage === stage ? (
                                        <Loader2 size={12} className="text-primary animate-spin flex-shrink-0" />
                                      ) : (
                                        <div className="w-3 h-3 flex items-center justify-center flex-shrink-0">
                                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                                        </div>
                                      )}
                                      <span className={`text-[13px] ${
                                        stage.isFailed
                                          ? 'text-red-400'
                                          : stage.isComplete
                                          ? 'text-gray-400'
                                          : currentStage === stage
                                          ? 'text-gray-200'
                                          : 'text-gray-500'
                                      }`}>
                                        {stage.label}
                                        {stage.isFailed && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              onFixDeploymentError?.()
                                            }}
                                            className="ml-2 text-[11px] text-red-400/70 hover:text-red-300 hover:underline transition-colors"
                                          >
                                            (Click to fix)
                                          </button>
                                        )}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Error message */}
                                {block.deploymentError && (
                                  <div className="mt-3 p-2 bg-red-500/10 rounded border border-red-500/20">
                                    <p className="text-[12px] text-red-400 font-mono break-words">
                                      {block.deploymentError}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Live URL Step */}
                            {block.isComplete && block.deploymentUrl && (
                              <div className="timeline-step">
                                <div className="step-track">
                                  <div className="step-icon" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                                    <Globe size={14} className="text-green-400" />
                                  </div>
                                </div>
                                <div className="step-content">
                                  <div className="pt-1">
                                    <button
                                      onClick={() => window.electronAPI?.shell?.openExternal(block.deploymentUrl!)}
                                      className="group inline-flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/15 px-2.5 py-1 rounded transition-colors"
                                    >
                                      <span className="url-dot"></span>
                                      <span className="text-[13px] font-mono text-green-400 group-hover:text-green-300 font-medium">
                                        {block.deploymentUrl}
                                      </span>
                                      <ExternalLink size={10} className="text-green-400/60 group-hover:text-green-300" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // Render conversation block with timeline workflow
                    const hasDeployAction = block.actions?.some(a => a.type === 'dev_server')
                    const hasRestoreAction = block.actions?.some(a => a.type === 'checkpoint_restore')
                    const deployAction = block.actions?.find(a => a.type === 'dev_server')
                    const restoreAction = block.actions?.find(a => a.type === 'checkpoint_restore')
                    const isRestoreBlock = hasRestoreAction || block.userPrompt?.startsWith('Restore to checkpoint')
                    const wasInterrupted = block.messages?.some(m => m.content.includes('⚠️ Stopped by user'))

                    return (
                      <div key={block.id} className="mb-6">
                        {/* Workflow Block Container */}
                        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-4 relative">
                          {/* Timestamp (top right) - all blocks */}
                          {block.isComplete && block.completedAt && (
                            <span className="absolute top-3 right-3 text-[11px] text-gray-500 z-10">
                              {new Date(block.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {/* Stop button (top right) - only for non-restore blocks */}
                          {!isRestoreBlock && showStopButton && (
                            <button
                              onClick={onStopClick}
                              className="absolute top-3 right-3 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group z-10"
                              title="Stop generation"
                            >
                              <Square size={12} className="text-gray-400 group-hover:text-red-400 transition-colors fill-current" />
                            </button>
                          )}

                          {/* RESTORE BLOCK - Timeline design matching other blocks */}
                          {isRestoreBlock ? (
                            <div className="relative">
                              {/* Git Restore Step */}
                              <div className="timeline-step">
                                <div className="step-track">
                                  <div className="step-icon step-icon-restore">
                                    <img src={GitIcon} alt="Git" className="w-4 h-4 opacity-90" />
                                  </div>
                                  {hasDeployAction && <div className="step-line"></div>}
                                </div>
                                <div className="step-content">
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="text-[14px] font-semibold text-gray-100">
                                      {restoreAction?.status === 'in_progress'
                                        ? 'Restoring checkpoint...'
                                        : restoreAction?.status === 'success'
                                          ? `Restored to checkpoint #${restoreAction?.data?.commitHash || ''}`
                                          : 'Restore failed'
                                      }
                                    </span>
                                    {restoreAction?.status === 'success' && (
                                      <span className="text-[12px] text-gray-500">0.1s</span>
                                    )}
                                    {restoreAction?.status === 'in_progress' && (
                                      <Loader2 size={12} className="text-primary animate-spin" />
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Dev Server Step */}
                              {hasDeployAction && deployAction && (
                                <div className="timeline-step">
                                  <div className="step-track">
                                    <div className="step-icon step-icon-server">
                                      <Server size={14} className="text-white opacity-90" />
                                    </div>
                                  </div>
                                  <div className="step-content">
                                    <div className="flex items-center gap-2 flex-wrap pt-1">
                                      <span className="text-[14px] font-semibold text-gray-100">
                                        {deployAction.status === 'in_progress'
                                          ? 'Starting dev server...'
                                          : deployAction.status === 'success'
                                            ? 'Dev Server started successfully'
                                            : 'Failed to start dev server'
                                        }
                                      </span>
                                      {deployAction.status === 'success' && deployAction.data?.url && (
                                        <>
                                          <span className="text-gray-500 text-[12px]">•</span>
                                          <button
                                            onClick={() => window.electronAPI?.shell?.openExternal(deployAction.data.url)}
                                            className="flex items-center gap-1 text-primary hover:text-primary-light transition-colors group text-[12px]"
                                          >
                                            <span>{deployAction.data.url}</span>
                                            <ExternalLink size={10} className="opacity-50 group-hover:opacity-100" />
                                          </button>
                                        </>
                                      )}
                                      {deployAction.status === 'success' && (
                                        <span className="text-[12px] text-gray-500">
                                          {deployAction.data?.restartTime ? `${deployAction.data.restartTime}s` : ''}
                                        </span>
                                      )}
                                      {deployAction.status === 'in_progress' && (
                                        <Loader2 size={12} className="text-primary animate-spin" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Timeline Workflow */
                            <div className="relative">
                              {/* STEP 0: USER (User Prompt) - Hide for answer blocks */}
                              {!isAnswers && (
                                <div className="timeline-step">
                                  <div className="step-track">
                                    <div className="step-icon step-icon-user">
                                      <User size={14} className="text-white opacity-90" />
                                    </div>
                                    <div className="step-line"></div>
                                  </div>
                                  <div className="step-content">
                                    {/* Header: Title on same line as icon */}
                                    <div className="step-header pt-1 pb-2">
                                      <span className="text-[14px] font-semibold text-gray-100">User</span>
                                    </div>
                                    {/* Message below */}
                                    {(() => {
                                      const prompt = block.userPrompt || 'User request'
                                      const lineCount = estimatePromptLines(prompt)
                                      const needsExpansion = lineCount > 10
                                      const isPromptExpanded = expandedUserPrompts.has(block.id)

                                      return (
                                        <div>
                                          <p className={`text-[14px] text-gray-300 leading-relaxed whitespace-pre-wrap ${needsExpansion && !isPromptExpanded ? 'line-clamp-3' : ''}`}>
                                            {prompt}
                                          </p>
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
                                              className="mt-1 text-[12px] text-primary hover:text-primary-light transition-colors"
                                            >
                                              {isPromptExpanded ? 'Show less' : 'Show more'}
                                            </button>
                                          )}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )}

                              {/* STEP 1: ANTHROPIC (Code Editing) */}
                              {(() => {
                                return (
                                  <div className="timeline-step">
                                    <div className="step-track">
                                      <div className="step-icon step-icon-claude">
                                        <img src={AnthropicIcon} alt="Anthropic" className="w-4 h-4" />
                                      </div>
                                      <div className="step-line"></div>
                                    </div>
                                    <div className="step-content">
                                      {/* Title + Status */}
                                      <div className="flex items-center gap-2 pt-1 mb-3">
                                        <span className="text-[14px] font-semibold text-gray-100">
                                          Claude
                                        </span>
                                        {block.isComplete && block.completionStats && (
                                          <span className="text-[12px] text-gray-500">
                                            {block.completionStats.timeSeconds}s
                                          </span>
                                        )}
                                      </div>

                                      {/* Anthropic step content (always visible) */}
                                      <div className="space-y-3">

                                  {/* Messages */}
                                  <div className="space-y-1.5">
                                    {block.messages?.filter(m =>
                                      !m.content.includes('⚠️ Stopped by user') &&
                                      !(m.type === 'tool' && !m.toolName) // Filter out tool summary messages - they appear in stats section
                                    ).map((message, idx) => {
                                      const messageId = `${block.id}-msg-${idx}`
                                      const isMessageExpanded = expandedMessages.has(messageId)
                                      const hasOverflow = overflowingMessages.has(messageId)

                                      // Check if this is the latest tool (for timer display)
                                      const toolMessages = block.messages?.filter(m => m.type === 'tool') || []
                                      const isLatestTool = message.type === 'tool' && message === toolMessages[toolMessages.length - 1]

                                      return (
                                        <div key={idx} className="mb-3">
                                          {message.type === 'thinking' && (
                                            <div>
                                              {message.thinkingDuration !== undefined ? (
                                                // Complete thinking - expandable
                                                <div>
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
                                                    className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded mb-1.5 hover:bg-white/10 transition-colors"
                                                  >
                                                    <span>Thought for {message.thinkingDuration}s</span>
                                                    <ChevronDown size={10} className={`transition-transform ${expandedThinking.has(messageId) ? 'rotate-180' : ''}`} />
                                                  </button>
                                                  {expandedThinking.has(messageId) && (
                                                    <p className="text-[13px] text-gray-400 leading-relaxed whitespace-pre-wrap">
                                                      {message.content}
                                                    </p>
                                                  )}
                                                </div>
                                              ) : (
                                                // Active thinking - animated
                                                <div className="flex items-center gap-2">
                                                  <span className="inline-block text-[11px] text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                                                    Thinking{thinkingDots} {thinkingTimers.get(block.id)?.toFixed(1) || '0.0'}s
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                          {message.type === 'assistant' && (
                                            <div className="flex items-start gap-2">
                                              <div className="w-1 h-1 rounded-full bg-gray-500 flex-shrink-0 mt-2" />
                                              <div className="flex-1 relative">
                                                <div
                                                  ref={(el) => {
                                                    if (el) {
                                                      messageRefs.current.set(messageId, el)
                                                    } else {
                                                      messageRefs.current.delete(messageId)
                                                    }
                                                  }}
                                                  className="text-[13px] text-gray-400 leading-relaxed whitespace-pre-wrap"
                                                style={{
                                                  display: '-webkit-box',
                                                  WebkitBoxOrient: 'vertical',
                                                  WebkitLineClamp: !isMessageExpanded ? 3 : 'unset',
                                                  overflow: 'hidden'
                                                }}
                                              >
                                                <MessageContent
                                                  text={message.content}
                                                  onXMLClick={onXMLTagClick}
                                                  onXMLDetected={onXMLTagDetected}
                                                  keywords={keywords}
                                                  blockId={block.id}
                                                />
                                              </div>
                                              {(hasOverflow || isMessageExpanded) && (
                                                <span
                                                  onClick={() => {
                                                    const newSet = new Set(expandedMessages)
                                                    if (newSet.has(messageId)) {
                                                      newSet.delete(messageId)
                                                    } else {
                                                      newSet.add(messageId)
                                                    }
                                                    setExpandedMessages(newSet)
                                                  }}
                                                  className="text-[12px] text-primary hover:underline cursor-pointer"
                                                >
                                                  {isMessageExpanded ? '(Show less)' : '(Show more)'}
                                                </span>
                                              )}
                                              </div>
                                            </div>
                                          )}
                                          {message.type === 'tool' && message.toolName && (
                                            <div className="flex items-center gap-2 text-[12px] text-gray-500">
                                              <span>
                                                Claude using tool{' '}
                                                <span className="text-primary">{message.toolName}</span>
                                                {message.content.includes('@') && (
                                                  <> @ {message.content.split('@')[1].trim()}</>
                                                )}
                                              </span>
                                              {isLatestTool && message.toolDuration === undefined && (
                                                <span className="text-gray-500">
                                                  {latestToolTimer.get(block.id)?.toFixed(1) || '0.0'}s
                                                </span>
                                              )}
                                            </div>
                                          )}
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
                                      <div className="flex flex-wrap gap-4 pt-3 mt-3 border-t border-white/10 text-[12px]">
                                        {toolUsage && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-gray-500">Used tools:</span>
                                            <span className="text-gray-400">{toolUsage}</span>
                                          </div>
                                        )}
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-500">Tokens:</span>
                                          <span className="text-gray-400 tabular-nums">{block.completionStats.inputTokens} → {block.completionStats.outputTokens}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 pl-4 border-l border-white/10">
                                          <span className="text-gray-500">${block.completionStats.cost.toFixed(4)}</span>
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
                                        className="flex items-center gap-1.5 text-[12px] text-primary hover:text-primary-light transition-colors"
                                      >
                                        {expandedSummaries.has(block.id) ? (
                                          <ChevronUp size={10} />
                                        ) : (
                                          <ChevronDown size={10} />
                                        )}
                                        <span className="font-medium">Summary</span>
                                      </button>

                                      {expandedSummaries.has(block.id) && (
                                        <div className="mt-2 pl-4 text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap">
                                          {block.summary}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}

                              {/* PLAN MODE: Plan approval (show when plan is ready) */}
                              {needsApproval && (() => {
                                const hasGitAfter = block.actions?.some(a => a.type === 'git_commit' && a.status)
                                const hasServerAfter = block.actions?.some(a => a.type === 'dev_server' && a.status)
                                const hasMoreAfter = hasGitAfter || hasServerAfter

                                return (
                                  <div className="timeline-step">
                                    <div className="step-track">
                                      <div className="step-icon step-icon-plan">
                                        <User size={14} className="text-white opacity-90" />
                                      </div>
                                      {hasMoreAfter && <div className="step-line"></div>}
                                    </div>
                                    <div className="step-content">
                                      <div className="flex items-center gap-2 pt-1 mb-3">
                                        <span className="text-[14px] font-semibold text-gray-100">
                                          Plan ready for approval
                                        </span>
                                      </div>
                                      <p className="text-[12px] text-gray-400 mb-3">
                                        Review Claude's plan above. Choose an action below:
                                      </p>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => onApprovePlan?.()}
                                          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 hover:border-primary/70 rounded text-[12px] text-primary font-medium transition-all"
                                        >
                                          Yes, confirm
                                        </button>
                                        <button
                                          onClick={() => onRejectPlan?.()}
                                          className="px-4 py-2 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/50 hover:border-gray-500/70 rounded text-[12px] text-gray-300 font-medium transition-all"
                                        >
                                          No, keep planning
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })()}

                              {/* PLAN MODE: User approval indicator + Implementation */}
                              {isPlanReady && implementationBlock && (() => {
                                const implHasGit = implementationBlock.actions?.some(a => a.type === 'git_commit' && a.status)
                                const implHasServer = implementationBlock.actions?.some(a => a.type === 'dev_server' && a.status)

                                return (
                                  <>
                                    {/* User approved step */}
                                    <div className="timeline-step">
                                      <div className="step-track">
                                        <div className="step-icon step-icon-user">
                                          <User size={14} className="text-white opacity-90" />
                                        </div>
                                        <div className="step-line"></div>
                                      </div>
                                      <div className="step-content">
                                        <div className="flex items-center gap-2 pt-1">
                                          <span className="text-[14px] font-semibold text-gray-100">
                                            User approved plan
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Claude implementation step */}
                                    <div className="timeline-step">
                                      <div className="step-track">
                                        <div className="step-icon step-icon-claude">
                                          <img src={AnthropicIcon} alt="Anthropic" className="w-4 h-4" />
                                        </div>
                                        {(implHasGit || implHasServer) && <div className="step-line"></div>}
                                      </div>
                                      <div className="step-content">
                                        <div className="flex items-center gap-2 pt-1 mb-3">
                                          <span className="text-[14px] font-semibold text-gray-100">
                                            Claude
                                          </span>
                                          {implementationBlock.isComplete && implementationBlock.completionStats && (
                                            <span className="text-[12px] text-gray-500">
                                              {implementationBlock.completionStats.timeSeconds}s
                                            </span>
                                          )}
                                        </div>

                                        {/* Implementation messages */}
                                        {implementationBlock.messages && implementationBlock.messages
                                          .filter(m =>
                                            (m.type === 'assistant' || m.type === 'thinking' || m.type === 'tool') &&
                                            !(m.type === 'tool' && !m.toolName)
                                          )
                                          .map((msg, msgIdx) => {
                                            if (msg.type === 'thinking') {
                                              return (
                                                <div key={`impl-thinking-${msgIdx}`} className="mb-2 text-[12px] text-gray-500 italic">
                                                  Thought for {msg.thinkingDuration || '...'}s
                                                </div>
                                              )
                                            }
                                            if (msg.type === 'tool') return null
                                            return (
                                              <div key={`impl-msg-${msgIdx}`} className="mb-3">
                                                <div className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
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
                                            <div className="flex flex-wrap gap-4 pt-3 mt-3 border-t border-white/10 text-[12px]">
                                              {toolUsage && (
                                                <div className="flex items-center gap-1.5">
                                                  <span className="text-gray-500">Used tools:</span>
                                                  <span className="text-gray-400">{toolUsage}</span>
                                                </div>
                                              )}
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-gray-500">Tokens:</span>
                                                <span className="text-gray-400 tabular-nums">{implementationBlock.completionStats.inputTokens} → {implementationBlock.completionStats.outputTokens}</span>
                                              </div>
                                              <div className="flex items-center gap-1.5 pl-4 border-l border-white/10">
                                                <span className="text-gray-500">${implementationBlock.completionStats.cost.toFixed(4)}</span>
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  </>
                                )
                              })()}

                              {/* STEP 2: GIT (GitHub Commit) - Use implementation block in plan mode */}
                              {(() => {
                                const gitBlockToUse =
                                  (isPlanReady && implementationBlock) ? implementationBlock : block
                                const git = gitBlockToUse?.actions?.find(a => a.type === 'git_commit')
                                const shouldShowGit = git && git.status
                                const hasServerAfterGit = gitBlockToUse?.actions?.some(a => a.type === 'dev_server' && a.status)

                                return shouldShowGit && (
                                  <div className="timeline-step">
                                    <div className="step-track">
                                      <div className="step-icon step-icon-git">
                                        <img src={GitIcon} alt="Git" className="w-4 h-4 opacity-90" />
                                      </div>
                                      {(hasServerAfterGit || wasInterrupted) && <div className="step-line"></div>}
                                    </div>
                                    <div className="step-content">
                                      {/* Header: Title + Status + Time */}
                                      <div className="flex items-center justify-between pt-1 pb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[14px] font-semibold text-gray-100">Git</span>
                                          <span className={`text-[14px] ${git.status === 'in_progress' ? 'text-gray-400' : git.status === 'error' ? 'text-red-400' : 'text-gray-100'}`}>
                                            {git.status === 'in_progress'
                                              ? 'Committing...'
                                              : git.status === 'success'
                                                ? 'Committed successfully'
                                                : 'Commit failed'
                                            }
                                          </span>
                                          {git.status === 'success' && (
                                            <Check size={12} className="text-green-400" />
                                          )}
                                          {git.status === 'in_progress' && (
                                            <Loader2 size={12} className="text-primary animate-spin" />
                                          )}
                                        </div>
                                        {git.status === 'success' && (
                                          <span className="text-[12px] text-gray-500">0.1s</span>
                                        )}
                                      </div>
                                      {/* Details: Hash • Files changed */}
                                      {git.status === 'success' && (
                                        <div className="flex items-center gap-2 mb-3">
                                          {git.data?.commitHash && (
                                            <span
                                              className="group/hash font-mono text-[12px] bg-purple-500/10 px-2 py-0.5 rounded text-purple-400 flex items-center gap-1 cursor-pointer hover:bg-purple-500/20 transition-colors"
                                              onClick={() => navigator.clipboard.writeText(git.data?.commitHash || '')}
                                              title="Click to copy hash"
                                            >
                                              {git.data.commitHash}
                                              <Copy size={10} className="opacity-0 group-hover/hash:opacity-100 transition-opacity" />
                                            </span>
                                          )}
                                          {git.data?.filesChanged !== undefined && (
                                            <>
                                              <span className="text-gray-600">•</span>
                                              <span className="text-[12px] text-gray-500">
                                                {git.data.filesChanged} file{git.data.filesChanged !== 1 ? 's' : ''} changed
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {/* Restore button */}
                                      {git.status === 'success' && block.commitHash && block.commitHash !== 'unknown' && block.commitHash.length >= 7 && (
                                        <div className="mt-2">
                                          {confirmingRestoreBlockId === block.id ? (
                                            <div className="flex items-center gap-2">
                                              <div className="inline-flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary">
                                                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                  <path d="M3 3v5h5" />
                                                </svg>
                                                <span className="text-[13px] text-primary font-medium">Restore to this checkpoint?</span>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  handleRestoreCheckpoint(block)
                                                  setConfirmingRestoreBlockId(null)
                                                }}
                                                className="p-1.5 bg-green-500/20 hover:bg-green-500/30 rounded transition-colors"
                                                title="Confirm restore"
                                              >
                                                <Check size={14} className="text-green-400" />
                                              </button>
                                              <button
                                                onClick={() => setConfirmingRestoreBlockId(null)}
                                                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                                                title="Cancel"
                                              >
                                                <X size={14} className="text-red-400" />
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              onClick={() => setConfirmingRestoreBlockId(block.id)}
                                              className="group inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded transition-colors"
                                            >
                                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-primary group-hover:text-primary-light">
                                                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                <path d="M3 3v5h5" />
                                              </svg>
                                              <span className="text-[13px] text-primary group-hover:text-primary-light font-medium">Restore to this checkpoint</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}

                              {/* STEP 3: DEPLOY (Dev Server) - Use implementation block in plan mode */}
                              {(() => {
                                const deployBlockToUse =
                                  (isPlanReady && implementationBlock) ? implementationBlock : block
                                const deploy = deployBlockToUse?.actions?.find(a => a.type === 'dev_server')
                                const shouldShowDeploy = deploy && deploy.status

                                return shouldShowDeploy && (
                                  <div className="timeline-step">
                                    <div className="step-track">
                                      <div className="step-icon step-icon-server">
                                        <Server size={14} className="text-white opacity-90" />
                                      </div>
                                      {wasInterrupted && <div className="step-line"></div>}
                                    </div>
                                    <div className="step-content">
                                      {/* Header: Title + Status + Time */}
                                      <div className="flex items-center justify-between pt-1 pb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[14px] font-semibold text-gray-100">Dev Server</span>
                                          <span className={`text-[14px] ${deploy.status === 'in_progress' ? 'text-gray-400' : deploy.status === 'error' ? 'text-red-400' : 'text-gray-100'}`}>
                                            {deploy.status === 'in_progress'
                                              ? 'starting...'
                                              : deploy.status === 'success'
                                                ? 'started successfully'
                                                : 'failed to start'
                                            }
                                          </span>
                                          {deploy.status === 'success' && (
                                            <Check size={12} className="text-green-400" />
                                          )}
                                          {deploy.status === 'in_progress' && (
                                            <Loader2 size={12} className="text-primary animate-spin" />
                                          )}
                                        </div>
                                        {deploy.status === 'success' && deploy.data?.restartTime && (
                                          <span className="text-[12px] text-gray-500">{deploy.data.restartTime}s</span>
                                        )}
                                      </div>
                                      {/* URL with pulsing dot */}
                                      {deploy.status === 'success' && deploy.data?.url && (
                                        <div className="mt-2">
                                          <button
                                            onClick={() => window.electronAPI?.shell?.openExternal(deploy.data.url)}
                                            className="group inline-flex items-center gap-1.5 bg-primary/10 hover:bg-primary/15 px-2.5 py-1 rounded transition-colors"
                                          >
                                            <span className="url-dot"></span>
                                            <span className="text-[13px] font-mono text-primary group-hover:text-primary-light font-medium">
                                              {deploy.data.url}
                                            </span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}

                              {/* STEP: INTERRUPTED (Stopped by user) */}
                              {wasInterrupted && (
                                <div className="timeline-step">
                                  <div className="step-track">
                                    <div className="step-icon step-icon-stopped">
                                      <X size={14} className="text-red-400" />
                                    </div>
                                  </div>
                                  <div className="step-content">
                                    <div className="flex items-center gap-2 pt-1">
                                      <span className="text-[14px] font-semibold text-gray-100">
                                        Stopped by user
                                      </span>
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
          /* Timeline Step Design */
          .timeline-step {
            display: flex;
            gap: 0;
          }
          .step-track {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 40px;
            flex-shrink: 0;
          }
          .step-icon {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            z-index: 1;
          }
          .step-icon-user {
            background: rgba(255, 255, 255, 0.1);
          }
          .step-icon-claude {
            background: rgba(217, 119, 6, 0.3);
          }
          .step-icon-git {
            background: rgba(34, 197, 94, 0.2);
          }
          .step-icon-server {
            background: rgba(59, 130, 246, 0.2);
          }
          .step-icon-deploy {
            background: rgba(217, 119, 6, 0.3);
          }
          .step-icon-restore {
            background: rgba(34, 197, 94, 0.2);
          }
          .step-icon-stopped {
            background: rgba(239, 68, 68, 0.15);
          }
          .step-icon-plan {
            background: rgba(139, 92, 246, 0.2);
          }
          .step-line {
            width: 2px;
            flex-grow: 1;
            margin: 8px 0;
            background-image: repeating-linear-gradient(
              to bottom,
              rgba(255, 255, 255, 0.15) 0px,
              rgba(255, 255, 255, 0.15) 4px,
              transparent 4px,
              transparent 8px
            );
            min-height: 16px;
          }
          .step-content {
            flex: 1;
            padding-bottom: 16px;
            padding-left: 4px;
            min-width: 0;
          }
          .url-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
            animation: pulse 2s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
          </div>
        </div>
      )}
    </>
  )
}

export default StatusSheet
