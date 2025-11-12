import { useState, useEffect, useRef } from 'react'
import {
  Image as ImageIcon,
  Settings,
  Rocket,
  ChevronDown,
  Loader2,
  Send,
  Pin,
  Globe,
  ExternalLink,
  Terminal,
  Monitor,
  Smartphone,
  Plus,
  Sliders,
  FileText,
  X as CloseIcon,
  Edit2,
  StickyNote,
  Kanban
} from 'lucide-react'
import { useAppStore, type DeploymentStatus } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { useToast } from '../hooks/useToast'
import StatusSheet from './StatusSheet'
import ContextBar from './ContextBar'
import ContentEditableInput, { type ContentEditableInputRef } from './ContentEditableInput'
import type { ClaudeStatus, ClaudeContext, ClaudeModel } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'

interface ActionBarProps {
  projectId?: string
  onChatClick?: () => void
  onImagesClick?: () => void
  onSettingsClick?: () => void
  onConsoleClick?: () => void
  autoOpen?: boolean
  autoPinned?: boolean
  autoMessage?: string
  onAutoMessageSent?: () => void
}

type ViewMode = 'desktop' | 'mobile'

// Helper to get display name from model ID
const getModelDisplayName = (modelId: string): string => {
  // Map full model IDs to display names (including correct snapshot dates)
  if (modelId.includes('sonnet')) return 'Sonnet 4.5'
  if (modelId.includes('opus')) return 'Opus 4.1'
  if (modelId.includes('haiku')) return 'Haiku 4.5'
  return modelId
}

// Deployment stages with user-friendly labels
const DEPLOYMENT_STAGES = [
  { status: 'creating' as DeploymentStatus, label: 'Creating instance', icon: Rocket },
  { status: 'building' as DeploymentStatus, label: 'Building app', icon: Loader2 },
  { status: 'setting-keys' as DeploymentStatus, label: 'Setting up keys', icon: Loader2 },
  { status: 'finalizing' as DeploymentStatus, label: 'Finalizing', icon: Loader2 },
]

function ActionBar({
  projectId,
  onChatClick,
  onImagesClick,
  onSettingsClick,
  onConsoleClick,
  autoOpen = false,
  autoPinned = false,
  autoMessage,
  onAutoMessageSent
}: ActionBarProps) {
  const { netlifyConnected, deploymentStatus, setDeploymentStatus, viewMode, setViewMode } = useAppStore()
  const { layoutState, isActionBarVisible, editModeEnabled, setEditModeEnabled, imageReferences, removeImageReference, clearImageReferences, textContents, addTextContent, removeTextContent, clearTextContents, prefilledMessage, setPrefilledMessage, kanbanEnabled, setKanbanEnabled } = useLayoutStore()
  const toast = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [isHidden, setIsHidden] = useState(false) // Start visible (not hidden)
  const [isLocked, setIsLocked] = useState(true) // Start pinned
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus>('idle')
  const [claudeContext, setClaudeContext] = useState<ClaudeContext | null>(null)
  const [availableModels, setAvailableModels] = useState<ClaudeModel[]>([])
  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [loadingDots, setLoadingDots] = useState('')
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showTweakMenu, setShowTweakMenu] = useState(false)
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const [planModeToggle, setPlanModeToggle] = useState(false) // Only for next message, resets after send
  const [attachments, setAttachments] = useState<Array<{id: string, type: 'image' | 'file', name: string, preview?: string}>>([])
  const [questions, setQuestions] = useState<any>(null)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string | string[]>>({})
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [isProcessingAnswers, setIsProcessingAnswers] = useState(false)
  const textareaRef = useRef<ContentEditableInputRef>(null)
  const actionBarRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const tweakMenuRef = useRef<HTMLDivElement>(null)
  const autoMessageSentRef = useRef(false) // Track if auto-message was already sent
  const autoMessageTimerRef = useRef<NodeJS.Timeout | null>(null) // Track timer to prevent cleanup

  // Check if Claude is working (also block if status is undefined to prevent race condition)
  const isClaudeWorking = claudeStatus === 'starting' || claudeStatus === 'running' || claudeStatus === undefined

  // Check if deployment is in progress
  const isDeploying = deploymentStatus !== 'idle' && deploymentStatus !== 'live'
  const isLive = deploymentStatus === 'live'
  const isInputBlocked = isClaudeWorking || isDeploying

  useEffect(() => {
    // Slide up animation on mount
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // Handle auto-open and auto-pin for website import
  useEffect(() => {
    if (autoOpen && !isHidden) {
      // Auto-open is already handled by isVisible animation above
      // Just ensure it's not hidden
      setIsHidden(false)
    }
    if (autoPinned) {
      setIsLocked(true)
      setIsHidden(false) // Show the ActionBar when auto-pinned
    }
  }, [autoOpen, autoPinned])

  // Load available models on mount
  useEffect(() => {
    window.electronAPI?.claude.getModels().then((result) => {
      if (result.success && result.models) {
        setAvailableModels(result.models)
      }
    })
  }, [])

  // Listen for Claude status changes and context updates
  useEffect(() => {
    if (!projectId || !window.electronAPI?.claude) return

    // Reset status only - don't clear context yet (will be fetched below)
    setClaudeStatus('idle')
    setSelectedModel('claude-sonnet-4-5-20250929') // Default, will be overridden by context if available

    const unsubStatus = window.electronAPI.claude.onStatusChanged((id, status) => {
      if (id === projectId) {
        setClaudeStatus(status)
      }
    })

    const unsubCompleted = window.electronAPI.claude.onCompleted(async (id) => {
      if (id === projectId) {
        toast.success('Done!', 'Claude finished successfully')
        setClaudeStatus('completed')

        // Migration is now marked complete immediately when message is sent (see sendAutoMessage)
        // No need to mark it again here - just reset the ref for cleanup
        if (autoMessage && autoMessageSentRef.current) {
          autoMessageSentRef.current = false
        }
      }
    })

    const unsubError = window.electronAPI.claude.onError((id, error) => {
      if (id === projectId) {
        console.error('Claude error:', error)
        toast.error('Claude Error', error)
        setClaudeStatus('error')
      }
    })

    const unsubContextUpdated = window.electronAPI.claude.onContextUpdated((id, context) => {
      if (id === projectId) {
        setClaudeContext(context)
      }
    })

    const unsubModelChanged = window.electronAPI.claude.onModelChanged((id, model) => {
      if (id === projectId) {
        setSelectedModel(model)
        toast.success('Model Changed', `Switched to ${model}`)
      }
    })

    const unsubQuestions = window.electronAPI.claude.onQuestions((id, questions) => {
      if (id === projectId) {
        // TODO: Show questions in UI
      }
    })

    // Fetch initial status and context immediately
    Promise.all([
      window.electronAPI.claude.getStatus(projectId),
      window.electronAPI.claude.getContext(projectId)
    ]).then(([statusResult, contextResult]) => {
      // Set status
      if (statusResult.success && statusResult.status) {
        setClaudeStatus(statusResult.status)
      }

      // Set context and model
      if (contextResult.success && contextResult.context) {
        setClaudeContext(contextResult.context)
        // Override default model with saved model from context
        if (contextResult.context.model) {
          setSelectedModel(contextResult.context.model)
        }
      }
      // NOTE: If no context exists, keep current state (don't reset to null unnecessarily)
      // This prevents resetting the display when switching between projects
      // Context will be set when Claude actually starts working
    })

    return () => {
      unsubStatus()
      unsubCompleted()
      unsubError()
      unsubContextUpdated()
      unsubModelChanged()
      unsubQuestions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Watch for prefilled message from other components (e.g., image reference)
  useEffect(() => {
    if (prefilledMessage !== null) {
      setMessage(prefilledMessage)
      setPrefilledMessage(null) // Clear it after applying

      // Focus textarea after a brief delay
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [prefilledMessage, setPrefilledMessage])

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current?.textarea
    if (textarea) {
      // Only auto-resize when there's a message
      if (message) {
        textarea.style.height = 'auto'
        const scrollHeight = textarea.scrollHeight
        const maxHeight = 8 * 24 // 8 lines * 24px line height
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
      } else {
        // Reset to base height when no message
        textarea.style.height = attachments.length > 0 ? '70px' : '42px'
      }
    }
  }, [message, attachments])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false)
      }
      if (tweakMenuRef.current && !tweakMenuRef.current.contains(event.target as Node)) {
        setShowTweakMenu(false)
      }
    }

    if (showModelDropdown || showPlusMenu || showTweakMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown, showPlusMenu, showTweakMenu])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // E - Toggle Edit Mode (only in DEFAULT mode)
      if (e.key.toLowerCase() === 'e' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (layoutState === 'DEFAULT') {
          e.preventDefault()
          toggleEditMode()
        }
      }

      // N - Add Sticky Note (only in TOOLS mode)
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (layoutState === 'TOOLS') {
          e.preventDefault()
          handleAddStickyNote()
        }
      }

      // K - Toggle Kanban Board (only in TOOLS mode)
      if (e.key.toLowerCase() === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (layoutState === 'TOOLS') {
          e.preventDefault()
          toggleKanban()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [layoutState, kanbanEnabled, editModeEnabled, setKanbanEnabled, setEditModeEnabled]) // Re-run when layout state or kanban state changes

  // Listen for questions from Claude (plan mode)
  useEffect(() => {
    if (!projectId || !window.electronAPI?.claude) return

    const unsubQuestions = window.electronAPI.claude.onQuestions((id, questionsData) => {
      if (id !== projectId) return

      setQuestions(questionsData)
      setQuestionAnswers({}) // Reset answers
      setCustomInputs({}) // Reset custom inputs
      // DON'T set isInPlanModeSession=true here - that's premature!
      // Questions arriving doesn't mean the plan is ready for approval yet
      // Wait for Claude to complete after answering questions
    })

    return () => {
      unsubQuestions()
    }
  }, [projectId])

  // Auto-send message for website import
  // This needs to be after handleSend is defined, so we'll move it below

  const startHideTimer = () => {
    if (!isLocked) {
      hideTimerRef.current = setTimeout(() => {
        setIsHidden(true)
      }, 2000)
    }
  }

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const handleMouseEnterBar = () => {
    clearHideTimer()
    setIsHidden(false)
  }

  const handleMouseLeaveBar = () => {
    if (!isLocked && !isTextareaFocused) {
      startHideTimer()
    }
  }

  const handleMouseEnterBottom = () => {
    if (isHidden) {
      setIsHidden(false)
    }
  }

  const toggleLock = () => {
    setIsLocked(!isLocked)
    if (isLocked) {
      // When unlocking, start the hide timer
      startHideTimer()
    } else {
      // When locking, clear any hide timer and show the bar
      clearHideTimer()
      setIsHidden(false)
    }
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearHideTimer()
    }
  }, [])

  // Animate loading dots when Claude is working
  useEffect(() => {
    if (isClaudeWorking) {
      // Animate dots: '' -> '.' -> '..' -> '...'
      const dotsInterval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === '...') return ''
          return prev + '.'
        })
      }, 400)

      return () => {
        clearInterval(dotsInterval)
      }
    } else {
      // Reset when not working
      setLoadingDots('')
    }
  }, [isClaudeWorking])

  const handleSend = async () => {
    if (message.trim() && !isInputBlocked && projectId) {
      // Build the final prompt with all context
      let prompt = message.trim()

      // Replace inline text content markers with actual content
      // Format: [pasted 45 lines #123456]
      for (const content of textContents) {
        // Extract short ID from full content.id (TEXT_1234567890 -> 567890)
        const shortId = content.id.replace('TEXT_', '').slice(-6)
        const markerRegex = new RegExp(`\\[pasted (\\d+) lines #${shortId}\\]`, 'g')
        if (prompt.match(markerRegex)) {
          // Replace marker with formatted content in code block
          const formattedContent = `\`\`\`\n${content.content}\n\`\`\``
          prompt = prompt.replace(markerRegex, formattedContent)
        }
      }

      // Prepend image references context if any exist
      if (imageReferences.length > 0) {
        const imageContext = imageReferences
          .map(
            (ref) =>
              `- Image: ${ref.name}\n  Path: ${ref.path}\n  Dimensions: ${ref.dimensions}`
          )
          .join('\n')
        prompt = `I'd like to modify the following image(s):\n\n${imageContext}\n\n${prompt}`
      }

      const currentAttachments = [...attachments] // Copy attachments before clearing
      const usePlanMode = planModeToggle // Capture plan mode state before clearing

      // Clear UI state immediately
      setMessage('')
      setAttachments([]) // Clear attachments from UI
      setPlanModeToggle(false) // Reset toggle for next message
      clearImageReferences() // Clear image references after sending
      clearTextContents() // Clear text content pills after sending

      // Disable edit mode when sending a message to Claude
      if (editModeEnabled) {
        setEditModeEnabled(false)
      }

      try {
        // Convert attachments to Claude format
        const claudeAttachments = currentAttachments.map(att => {
          // Extract media type and base64 data from data URL
          // Format: data:image/png;base64,iVBORw0KG...
          const dataUrlMatch = att.preview?.match(/^data:([^;]+);base64,(.+)$/)
          let mediaType = dataUrlMatch?.[1] || ''
          const base64Data = dataUrlMatch?.[2] || ''

          // Convert UI type 'file' to Claude API type 'document'
          const claudeType = att.type === 'file' ? 'document' : att.type

          // Force correct media type based on file extension for PDFs
          // FileReader sometimes detects wrong MIME type
          if (att.type === 'file' && att.name.toLowerCase().endsWith('.pdf')) {
            mediaType = 'application/pdf'
          } else if (att.type === 'image') {
            // For images, trust the data URL media type or infer from extension
            if (!mediaType || mediaType === 'application/octet-stream') {
              const ext = att.name.split('.').pop()?.toLowerCase()
              mediaType = ext === 'png' ? 'image/png' :
                         ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                         ext === 'gif' ? 'image/gif' :
                         ext === 'webp' ? 'image/webp' : 'image/png'
            }
          }

          // Validation: catch type mismatches
          if (att.type === 'image' && claudeType !== 'image') {
            console.error('❌ [FRONTEND] BUG: Image typed as document!', { att, claudeType })
          }
          if (att.type === 'file' && claudeType !== 'document') {
            console.error('❌ [FRONTEND] BUG: File not typed as document!', { att, claudeType })
          }

          return {
            type: claudeType as 'image' | 'document',
            data: base64Data,
            mediaType,
            name: att.name
          }
        })

        // Create chat block first
        const blockResult = await window.electronAPI?.chat.createBlock(projectId, prompt)

        if (!blockResult?.success) {
          toast.error('Failed to create chat block', blockResult?.error || 'Unknown error')
          console.error('Failed to create chat block:', blockResult?.error)
          return
        }

        // Check if Claude session exists, if not start it with the prompt
        const statusResult = await window.electronAPI?.claude.getStatus(projectId)

        if (statusResult?.status === 'idle') {
          // Start session with the prompt and selected model (lazy initialization)
          const result = await window.electronAPI?.claude.startSession(
            projectId,
            prompt,
            selectedModel,
            claudeAttachments.length > 0 ? claudeAttachments : undefined,
            thinkingEnabled,
            usePlanMode
          )

          if (!result?.success) {
            toast.error('Failed to start Claude', result?.error || 'Unknown error')
            console.error('Failed to start Claude:', result?.error)
          }
        } else {
          // Send prompt to existing session with current selected model
          const result = await window.electronAPI?.claude.sendPrompt(
            projectId,
            prompt,
            selectedModel,
            claudeAttachments.length > 0 ? claudeAttachments : undefined,
            thinkingEnabled,
            usePlanMode
          )

          if (!result?.success) {
            toast.error('Failed to send message', result?.error || 'Unknown error')
            console.error('Failed to send prompt:', result?.error)
          }
        }
      } catch (error) {
        console.error('Error sending prompt:', error)
        toast.error('Failed to send message', error instanceof Error ? error.message : 'Unknown error')
      }
    }
  }

  // Auto-send message for website import (after handleSend is defined)
  useEffect(() => {
    // For website import, send when ready (idle or completed - both mean Claude is not currently working)
    const isClaudeReady = claudeStatus === 'idle' || claudeStatus === 'completed'
    if (autoMessage && projectId && !autoMessageSentRef.current && isClaudeReady && !isInputBlocked) {
      // Mark as sent to prevent re-sending
      autoMessageSentRef.current = true

      // Send directly without setting message in UI
      const sendAutoMessage = async () => {
        try {
          // Create chat block first
          const blockResult = await window.electronAPI?.chat.createBlock(projectId, autoMessage)

          if (!blockResult?.success) {
            toast.error('Failed to create chat block', blockResult?.error || 'Unknown error')
            console.error('Failed to create chat block:', blockResult?.error)
            return
          }

          // Start session with the prompt (always starts fresh for website import)
          const result = await window.electronAPI?.claude.startSession(
            projectId,
            autoMessage,
            selectedModel,
            undefined, // No attachments
            thinkingEnabled,
            false // Not plan mode
          )

          if (!result?.success) {
            console.error('⭐ [WEBSITE IMPORT] Failed to start Claude:', result?.error)
            toast.error('Failed to start Claude', result?.error || 'Unknown error')
            return
          }

          // Mark migration as complete immediately after sending
          // This prevents race conditions where the user refreshes/switches projects
          // before Claude finishes (which could take 5+ minutes)
          // IMPORTANT: Await this to ensure the file is written before allowing any state changes
          if (onAutoMessageSent) {
            await onAutoMessageSent()
          }
        } catch (error) {
          console.error('⭐ [WEBSITE IMPORT] Error sending auto message:', error)
          toast.error('Failed to send message', error instanceof Error ? error.message : 'Unknown error')
        }
      }

      // Only set timer if we don't already have one
      if (!autoMessageTimerRef.current) {
        const currentProjectId = projectId // Capture current project ID
        const currentAutoMessage = autoMessage // Capture current auto message
        autoMessageTimerRef.current = setTimeout(() => {
          // Verify we're still on the same project AND have the same auto message
          // This prevents sending if the user switched projects or if autoMessage was cleared
          if (currentProjectId === projectId && currentAutoMessage === autoMessage && autoMessage) {
            sendAutoMessage()
          }
          autoMessageTimerRef.current = null
        }, 1500)
      }
    }

    // Cleanup: only clear timer if autoMessage is removed (project changed)
    return () => {
      if (!autoMessage && autoMessageTimerRef.current) {
        clearTimeout(autoMessageTimerRef.current)
        autoMessageTimerRef.current = null
      }
    }
  }, [autoMessage, projectId, selectedModel, thinkingEnabled, toast, claudeStatus, isInputBlocked])

  // Reset auto-message sent flag only when autoMessage is cleared or project changes
  const prevAutoMessageRef = useRef(autoMessage)
  const prevProjectIdRef = useRef(projectId)

  useEffect(() => {
    const autoMessageCleared = prevAutoMessageRef.current && !autoMessage
    const projectChanged = prevProjectIdRef.current !== projectId

    // Only reset if autoMessage was cleared OR project actually changed
    if (autoMessageCleared || projectChanged) {
      autoMessageSentRef.current = false
      if (autoMessageTimerRef.current) {
        clearTimeout(autoMessageTimerRef.current)
        autoMessageTimerRef.current = null
      }
    }

    // Update refs for next comparison
    prevAutoMessageRef.current = autoMessage
    prevProjectIdRef.current = projectId
  }, [autoMessage, projectId])

  const handleDeploy = () => {
    if (!netlifyConnected || isDeploying || isLive) return

    // Reset progress
    setDeployProgress(0)

    // Start deployment flow
    let currentStageIndex = 0
    setDeploymentStatus(DEPLOYMENT_STAGES[0].status)

    const interval = setInterval(() => {
      currentStageIndex++
      if (currentStageIndex < DEPLOYMENT_STAGES.length) {
        setDeploymentStatus(DEPLOYMENT_STAGES[currentStageIndex].status)
      } else {
        // All stages complete - set to live
        setDeploymentStatus('live')
        clearInterval(interval)
        // Show success toast
        toast.success('Deployment complete!', 'Your app is now live')
      }
    }, 2500) // 2.5 seconds per stage
  }

  // Update progress bar during deployment
  useEffect(() => {
    if (isDeploying) {
      const progressInterval = setInterval(() => {
        setDeployProgress((prev) => {
          if (prev >= 100) return 100
          return prev + 1 // Increment by 1% every 100ms
        })
      }, 100)

      return () => clearInterval(progressInterval)
    } else if (deploymentStatus === 'idle') {
      setDeployProgress(0)
    } else if (deploymentStatus === 'live') {
      setDeployProgress(100)
    }
  }, [isDeploying, deploymentStatus])

  const handleVisitLive = () => {
    // Open the hosted URL
    const url = 'https://your-app.netlify.app' // This will come from backend
    window.open(url, '_blank')
  }

  const toggleViewMode = async () => {
    const newMode = viewMode === 'desktop' ? 'mobile' : 'desktop'
    setViewMode(newMode)

    // Notify LayoutManager about view mode change
    await window.electronAPI?.layout.setViewMode(newMode)

    toast.info(
      `Switched to ${newMode} view`,
      'Preview mode updated'
    )
  }

  const toggleEditMode = () => {
    setEditModeEnabled(!editModeEnabled)
    toast.info(
      editModeEnabled ? 'Edit mode disabled' : 'Edit mode enabled',
      editModeEnabled ? 'Images are no longer highlighted' : 'Click on images to edit'
    )
  }

  const handleAddStickyNote = () => {
    // Only allow in TOOLS mode
    if (layoutState !== 'TOOLS') return

    // TODO: Implement sticky note creation
    toast.info('Sticky Note Added', 'New sticky note created')
  }

  const toggleKanban = () => {
    // Only allow in TOOLS mode
    if (layoutState !== 'TOOLS') return

    const newState = !kanbanEnabled
    setKanbanEnabled(newState)
    toast.info(
      newState ? 'Kanban Enabled' : 'Kanban Disabled',
      newState ? 'Kanban board shown' : 'Kanban board hidden'
    )
  }

  const handleStop = async () => {
    if (!projectId) return

    try {
      await window.electronAPI?.claude.destroySession(projectId)
      toast.info('Stopped', 'Generation stopped and reverted to last checkpoint')
    } catch (error) {
      console.error('Error stopping Claude:', error)
      toast.error('Error', 'Failed to stop generation')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items

    // Check for images first
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
        return // Exit after handling image
      }
    }

    // Check for large text pastes (logs, schemas, etc.)
    const text = e.clipboardData.getData('text/plain')
    if (text) {
      const lineCount = text.split('\n').length
      const charCount = text.length

      // Threshold: 200+ characters OR 5+ lines
      if (charCount >= 200 || lineCount >= 5) {
        e.preventDefault()

        // Generate unique short ID for this content
        const timestamp = Date.now()
        const shortId = timestamp.toString().slice(-6) // Last 6 digits
        const contentId = `TEXT_${timestamp}`

        // Insert inline marker at cursor position
        const textarea = e.currentTarget
        const cursorPos = textarea.selectionStart
        const currentMessage = message

        // Create simple marker: [pasted 45 lines #123456]
        const marker = `[pasted ${lineCount} lines #${shortId}]`

        const newMessage =
          currentMessage.slice(0, cursorPos) +
          marker +
          currentMessage.slice(cursorPos)

        setMessage(newMessage)

        // Store content with full ID for later replacement
        addTextContent({
          id: contentId,
          content: text,
          lineCount,
          preview: text.slice(0, 50).replace(/\n/g, ' ')
        })

        // Move cursor after the marker
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = cursorPos + marker.length
          textarea.focus()
        }, 0)
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
    const validFileTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv', 'text/plain', 'text/html', 'application/vnd.oasis.opendocument.text', 'application/rtf', 'application/epub+zip']

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
      } else if (validFileTypes.includes(file.type) || file.name.endsWith('.docx') || file.name.endsWith('.odt') || file.name.endsWith('.rtf') || file.name.endsWith('.epub')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const preview = event.target?.result as string
          setAttachments(prev => [...prev, {
            id: Math.random().toString(36),
            type: 'file',
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
      {/* Bottom hover trigger zone */}
      <div
        className="fixed bottom-0 left-0 right-0 h-4 z-[90]"
        onMouseEnter={handleMouseEnterBottom}
      />

      {/* iOS-style indicator when hidden */}
      {isHidden && (
        <div className="fixed bottom-2 left-1/2 transform -translate-x-1/2 z-[90]">
          <div className="w-32 h-1 bg-gray-600/50 rounded-full" />
        </div>
      )}

      {/* Status Sheet - shows when action bar is visible and has history */}
      {!isHidden && (
        <StatusSheet
          projectId={projectId}
          actionBarRef={actionBarRef}
          onMouseEnter={() => {
            clearHideTimer()
            setIsTextareaFocused(true) // Prevent auto-hide
          }}
          onMouseLeave={() => {
            setIsTextareaFocused(false)
            if (!isLocked) {
              startHideTimer()
            }
          }}
          onStopClick={handleStop}
          questions={questions}
          onRejectPlan={() => {
            // User wants to refine the plan - keep conversation going with plan mode
            setQuestions(null) // Clear questions UI
            setQuestionAnswers({}) // Clear answers
            setCustomInputs({}) // Clear custom inputs
            setPlanModeToggle(true) // Enable plan mode for next message
            // Focus the textarea so user can type immediately
            if (textareaRef.current) {
              textareaRef.current.focus()
            }
          }}
          onApprovePlan={async () => {
            if (!projectId) return

            // Clear questions state
            setQuestions(null)
            setQuestionAnswers({})
            setCustomInputs({})

            // Send approval message to proceed with implementation (planMode=false)
            const approvalPrompt = "I approve this plan. Please proceed with the implementation."

            try {
              // Create chat block for approval
              const blockResult = await window.electronAPI?.chat.createBlock(projectId, approvalPrompt)

              if (!blockResult?.success) {
                console.error('Failed to create chat block for plan approval:', blockResult?.error)
                return
              }

              // Send approval to Claude with planMode=false to enable execution
              await window.electronAPI?.claude.sendPrompt(
                projectId,
                approvalPrompt,
                undefined, // use current model
                undefined, // no attachments
                undefined, // thinking disabled
                false // planMode=false - tells Claude to execute the plan
              )
            } catch (error) {
              console.error('Failed to send plan approval to Claude:', error)
            }
          }}
          onAnswerQuestions={async (answers, customData) => {
            if (isProcessingAnswers || !projectId) return
            setIsProcessingAnswers(true)

            // Format answers for Claude
            const questionsData = questions
            const answersText = questionsData.questions.map((q: any) => {
              let answer = answers[q.id]
              let answerStr = ''

              if (answer === '__CLAUDE_DECIDE__') {
                answerStr = 'Choose what you believe is the best option.'
              } else if (answer === '__CUSTOM__') {
                answerStr = customData[q.id] || ''
              } else if (Array.isArray(answer)) {
                // For checkbox, handle special values and custom input
                const processedAnswers = answer.map(val => {
                  if (val === '__CLAUDE_DECIDE__') return 'Choose what you believe is the best option.'
                  if (val === '__CUSTOM__') return customData[q.id] || ''
                  return val
                }).filter(v => v)
                answerStr = processedAnswers.join(', ')
              } else {
                answerStr = answer || ''
              }

              return `**${q.question}**\n${answerStr}`
            }).join('\n\n')

            const formattedPrompt = `Here are my answers to your questions:\n\n${answersText}\n\nPlease proceed with the implementation based on these answers.`

            try {
              // Create chat block for the answers
              const blockResult = await window.electronAPI?.chat.createBlock(projectId, formattedPrompt)

              if (!blockResult?.success) {
                console.error('Failed to create chat block for answers:', blockResult?.error)
                return
              }

              // Send answers to Claude (keep plan mode if toggle is active)
              await window.electronAPI?.claude.sendPrompt(
                projectId,
                formattedPrompt,
                undefined, // use current model
                undefined, // no attachments
                undefined, // thinking disabled
                planModeToggle // Keep plan mode if still active
              )

              // Clear questions
              setQuestions(null)
              setQuestionAnswers({})
              setCustomInputs({})
            } catch (error) {
              console.error('Failed to send answers to Claude:', error)
            } finally {
              setIsProcessingAnswers(false)
            }
          }}
        />
      )}

      {/* Action Bar */}
      <div
        className={`fixed left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${
          isVisible && !isHidden
            ? 'translate-y-0 opacity-100'
            : 'translate-y-32 opacity-0'
        }`}
        style={{ bottom: '11px' }}
        onMouseEnter={handleMouseEnterBar}
        onMouseLeave={handleMouseLeaveBar}
      >
        <div ref={actionBarRef} className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-2xl shadow-2xl overflow-visible w-[938px] relative action-bar-container">
          {/* Top Row - Textarea with Send Icon Inside */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative flex items-start">
              {/* Custom Plan Mode Placeholder */}
              {planModeToggle && !message && attachments.length === 0 && !isTextareaFocused && (
                <div className="absolute left-[14px] top-[10px] pointer-events-none text-sm text-gray-500 z-[5]">
                  Describe the task you need Claude to plan ahead.
                </div>
              )}

              {/* Attachment Chips - Inside textarea at top */}
              {attachments.length > 0 && (
                <div className="absolute left-[14px] top-[10px] flex gap-1.5 z-[5] pointer-events-auto max-w-[calc(100%-60px)] overflow-x-auto overflow-y-hidden scrollbar-hide">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative bg-dark-bg/90 border border-dark-border/50 rounded-full px-2.5 py-1 flex items-center gap-1.5 group hover:bg-dark-bg transition-colors flex-shrink-0"
                    >
                      {attachment.type === 'image' && attachment.preview ? (
                        <img
                          src={attachment.preview}
                          alt={attachment.name}
                          className="w-3 h-3 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <FileText size={12} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-[10px] text-gray-300 max-w-[60px] truncate">
                        {attachment.name}
                      </span>
                      <button
                        onClick={() => setAttachments(attachments.filter(a => a.id !== attachment.id))}
                        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <CloseIcon size={10} className="text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <ContentEditableInput
                ref={textareaRef}
                value={message}
                onChange={(value) => setMessage(value)}
                imageReferences={imageReferences}
                onRemoveImageReference={removeImageReference}
                textContents={textContents}
                onRemoveTextContent={removeTextContent}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder={
                  isDeploying
                    ? "Deploying your app..."
                    : isClaudeWorking
                    ? `Claude is working${loadingDots}`
                    : planModeToggle
                    ? ""
                    : "Ask Claude to build..."
                }
                disabled={isInputBlocked}
                className={`flex-1 border rounded-xl pr-11 text-sm outline-none transition-all overflow-y-auto ${
                  isInputBlocked
                    ? 'bg-dark-bg/30 text-gray-500 placeholder-gray-600 cursor-not-allowed border-dark-border/50'
                    : planModeToggle
                    ? 'bg-dark-bg/50 text-white placeholder-gray-500 border-blue-400/50 focus:border-blue-400/70'
                    : 'bg-dark-bg/50 text-white placeholder-gray-500 border-dark-border/50 focus:border-primary/30'
                } ${attachments.length > 0 ? 'pt-[38px]' : ''}`}
              />
              {isClaudeWorking ? (
                <div
                  className={`absolute right-3 transition-all ${
                    (textareaRef.current?.textarea?.scrollHeight || 0) > 42
                      ? 'bottom-2.5'
                      : 'top-[12px]'
                  }`}
                >
                  <div className="relative w-[18px] h-[18px]">
                    {/* Pulsing outer ring */}
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    {/* Spinning loader */}
                    <Loader2 size={18} className="text-primary animate-spin relative z-10" />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || isInputBlocked}
                  className={`absolute right-3 transition-all ${
                    (textareaRef.current?.scrollHeight || 0) > 42
                      ? 'bottom-2.5'
                      : 'top-[12px]'
                  } ${
                    message.trim() && !isInputBlocked
                      ? planModeToggle
                        ? 'text-blue-400 hover:text-blue-500 cursor-pointer'
                        : 'text-primary hover:text-primary-dark cursor-pointer'
                      : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row - Model Dropdown + Icons */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            {/* Plus Button */}
            <div className="relative" ref={plusMenuRef}>
              <button
                onClick={() => setShowPlusMenu(!showPlusMenu)}
                className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
              >
                <Plus size={15} className="text-gray-400 hover:text-primary transition-colors" />
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                  Attach files
                </span>
              </button>

              {/* Plus Menu */}
              {showPlusMenu && (
                <>
                  <div className="fixed inset-0 z-[200]" onClick={() => setShowPlusMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-2 min-w-[180px] z-[201] overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="relative z-10 space-y-1">
                      <button
                        onClick={async () => {
                          setShowPlusMenu(false)
                          setIsLocked(true) // Lock the action bar
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = 'image/jpeg,image/png,image/gif,image/webp'
                          input.onchange = async (e) => {
                            setIsLocked(false) // Unlock when file selected
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (event) => {
                                const preview = event.target?.result as string
                                setAttachments([...attachments, {
                                  id: Math.random().toString(36),
                                  type: 'image',
                                  name: file.name,
                                  preview
                                }])
                              }
                              reader.readAsDataURL(file)
                            }
                          }
                          // Handle cancel (when user closes picker without selecting)
                          window.addEventListener('focus', () => {
                            setTimeout(() => setIsLocked(false), 500)
                          }, { once: true })
                          input.click()
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] text-gray-300 hover:bg-dark-bg/50 transition-colors flex items-center gap-2"
                      >
                        <ImageIcon size={14} />
                        <span>Import an image</span>
                      </button>
                      <button
                        onClick={async () => {
                          setShowPlusMenu(false)
                          setIsLocked(true) // Lock the action bar
                          const input = document.createElement('input')
                          input.type = 'file'
                          input.accept = '.pdf,.docx,.csv,.txt,.html,.odt,.rtf,.epub'
                          input.onchange = async (e) => {
                            setIsLocked(false) // Unlock when file selected
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (event) => {
                                const preview = event.target?.result as string
                                setAttachments([...attachments, {
                                  id: Math.random().toString(36),
                                  type: 'file',
                                  name: file.name,
                                  preview
                                }])
                              }
                              reader.readAsDataURL(file)
                            }
                          }
                          // Handle cancel (when user closes picker without selecting)
                          window.addEventListener('focus', () => {
                            setTimeout(() => setIsLocked(false), 500)
                          }, { once: true })
                          input.click()
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] text-gray-300 hover:bg-dark-bg/50 transition-colors flex items-center gap-2"
                      >
                        <FileText size={14} />
                        <span>Import a file</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Tweak Button */}
            <div className="relative" ref={tweakMenuRef}>
              <button
                onClick={() => setShowTweakMenu(!showTweakMenu)}
                className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
              >
                <Sliders size={15} className="text-gray-400 hover:text-primary transition-colors" />
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                  Settings
                </span>
              </button>

              {/* Tweak Menu */}
              {showTweakMenu && (
                <>
                  <div className="fixed inset-0 z-[200]" onClick={() => setShowTweakMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1 bg-dark-card border border-dark-border rounded-lg shadow-2xl p-2 min-w-[180px] z-[201] overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div className="relative z-10 space-y-1">
                      <button
                        onClick={() => {
                          setPlanModeToggle(!planModeToggle)
                          setShowTweakMenu(false)
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-[11px] text-gray-300 hover:text-blue-400 hover:bg-dark-bg/50 transition-colors"
                      >
                        {planModeToggle ? 'Cancel plan mode' : 'Plan mode'}
                      </button>
                      <button
                        onClick={() => {
                          setThinkingEnabled(!thinkingEnabled)
                        }}
                        className={`w-full px-3 py-2 rounded-lg text-left text-[11px] transition-colors flex items-center justify-between ${
                          thinkingEnabled
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        <span>Thinking {thinkingEnabled ? 'on' : 'off'}</span>
                        <div className={`w-2 h-2 rounded-full ${thinkingEnabled ? 'bg-green-400' : 'bg-red-400'}`} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

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
                    {/* Background Image */}
                    <div
                      className="absolute inset-0 opacity-10 pointer-events-none"
                      style={{
                        backgroundImage: `url(${bgImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />

                    <div className="p-1 relative z-10">
                      {(availableModels.length > 0 ? availableModels : [
                        { value: 'claude-sonnet-4-5-20250929', displayName: 'Sonnet 4.5' },
                        { value: 'claude-opus-4-1-20250805', displayName: 'Opus 4.1' },
                        { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5' }
                      ]).map((model) => (
                        <button
                          key={model.value}
                          onClick={async () => {
                            const newModel = model.value
                            setSelectedModel(newModel)
                            setShowModelDropdown(false)

                            if (!projectId) return

                            // Only call changeModel if there's an active session
                            if (claudeStatus !== 'idle') {
                              try {
                                const result = await window.electronAPI?.claude.changeModel(projectId, newModel)
                                if (!result?.success) {
                                  toast.error('Failed to change model', result?.error || 'Unknown error')
                                  // Revert selection on error
                                  setSelectedModel(selectedModel)
                                }
                              } catch (error) {
                                console.error('Error changing model:', error)
                                toast.error('Failed to change model', error instanceof Error ? error.message : 'Unknown error')
                                // Revert selection on error
                                setSelectedModel(selectedModel)
                              }
                            }
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

            {/* Context Usage Bar */}
            <ContextBar
              context={claudeContext}
              projectId={projectId}
              onClearContext={async () => {
                if (!projectId) return

                try {
                  await window.electronAPI?.claude.clearSession(projectId)
                  // Context will be updated via onContextUpdated event with baseline
                  toast.success('Context Cleared', 'Starting fresh conversation')
                } catch (error) {
                  console.error('Error clearing context:', error)
                  toast.error('Failed to clear context', error instanceof Error ? error.message : 'Unknown error')
                }
              }}
            />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action Icons */}
            <button
              onClick={onConsoleClick}
              className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
            >
              <Terminal size={15} className="text-gray-400 hover:text-primary transition-colors" />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                Console
              </span>
            </button>

            <button
              onClick={toggleViewMode}
              disabled={layoutState === 'TOOLS'}
              className={`p-1.5 rounded-lg transition-all icon-button-group relative ${
                layoutState === 'TOOLS'
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-dark-bg/50'
              }`}
            >
              {viewMode === 'desktop' ? (
                <Monitor size={15} className="text-gray-400 hover:text-primary transition-colors" />
              ) : (
                <Smartphone size={15} className="text-gray-400 hover:text-primary transition-colors" />
              )}
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                {viewMode === 'desktop' ? 'Desktop view' : 'Mobile view'}
              </span>
            </button>

            <button
              onClick={onImagesClick}
              className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
            >
              <ImageIcon size={15} className="text-gray-400 hover:text-primary transition-colors" />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                Images
              </span>
            </button>

            <button
              onClick={toggleEditMode}
              disabled={layoutState !== 'DEFAULT'}
              className={`p-1.5 rounded-lg transition-all icon-button-group relative ${
                layoutState !== 'DEFAULT'
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-dark-bg/50'
              }`}
            >
              <Edit2
                size={15}
                className={`transition-colors ${
                  editModeEnabled
                    ? 'text-purple-500'
                    : 'text-gray-400'
                } ${layoutState === 'DEFAULT' && !editModeEnabled ? 'hover:text-gray-200' : ''}`}
              />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                {editModeEnabled ? 'Disable Edit Mode (E)' : 'Enable Edit Mode (E)'}
              </span>
            </button>

            <button
              onClick={handleAddStickyNote}
              disabled={layoutState !== 'TOOLS'}
              className={`p-1.5 rounded-lg transition-all icon-button-group relative ${
                layoutState !== 'TOOLS'
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-dark-bg/50'
              }`}
            >
              <StickyNote
                size={15}
                className={`transition-colors ${
                  layoutState === 'TOOLS'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-400'
                }`}
              />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                Add Sticky Note (N)
              </span>
            </button>

            <button
              onClick={toggleKanban}
              disabled={layoutState !== 'TOOLS'}
              className={`p-1.5 rounded-lg transition-all icon-button-group relative ${
                layoutState !== 'TOOLS'
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-dark-bg/50'
              }`}
            >
              <Kanban
                size={15}
                className={`transition-colors ${
                  kanbanEnabled
                    ? 'text-blue-500'
                    : layoutState === 'TOOLS'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-400'
                }`}
              />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                {kanbanEnabled ? 'Close Kanban Board (K)' : 'Open Kanban Board (K)'}
              </span>
            </button>

            <button
              onClick={onSettingsClick}
              className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
            >
              <Settings size={15} className="text-gray-400 hover:text-primary transition-colors" />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                Settings
              </span>
            </button>

            {/* Divider */}
            <div className="w-px h-5 bg-dark-border/50" />

            {/* Deploy Button */}
            {!netlifyConnected ? (
              // Not connected - show disabled state
              <button
                disabled
                className="px-2.5 py-1.5 bg-gray-700/30 border border-gray-700/50 rounded-lg transition-all cursor-not-allowed relative icon-button-group"
              >
                <div className="flex items-center gap-1.5">
                  <Rocket size={13} className="text-gray-600" />
                  <span className="text-[11px] text-gray-600 font-medium">Deploy</span>
                </div>
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                  Connect Netlify first
                </span>
              </button>
            ) : isLive ? (
              // Live - show visit button
              <button
                onClick={handleVisitLive}
                className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 rounded-lg transition-all relative icon-button-group"
              >
                <div className="flex items-center gap-1.5">
                  <Globe size={13} className="text-primary" />
                  <span className="text-[11px] text-primary font-medium">Live</span>
                  <ExternalLink size={10} className="text-primary opacity-60" />
                </div>
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                  Visit live site
                </span>
              </button>
            ) : isDeploying ? (
              // Deploying - show progress animation
              <button
                disabled
                className="relative px-2.5 py-1.5 bg-primary/10 border border-primary/30 rounded-lg transition-all cursor-wait overflow-hidden"
              >
                {/* Progress bar background */}
                <div
                  className="absolute inset-0 bg-primary/20 transition-all duration-300"
                  style={{ width: `${deployProgress}%` }}
                />

                {/* Icon and text */}
                <div className="relative flex items-center gap-1.5">
                  <Rocket size={13} className="text-primary" />
                  <span className="text-[11px] text-primary font-medium">Deploy</span>
                </div>
              </button>
            ) : (
              // Idle - show deploy button
              <button
                onClick={handleDeploy}
                className="px-2.5 py-1.5 bg-dark-bg/30 hover:bg-dark-bg border border-dark-border hover:border-primary/50 rounded-lg transition-all relative icon-button-group"
              >
                <div className="flex items-center gap-1.5">
                  <Rocket size={13} className="text-gray-400 group-hover:text-primary transition-colors" />
                  <span className="text-[11px] text-gray-300 hover:text-white font-medium transition-colors">Deploy</span>
                </div>
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                  Deploy to Netlify
                </span>
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-dark-border/50" />

            {/* Pin Button */}
            <button
              onClick={toggleLock}
              className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
            >
              <Pin
                size={15}
                className={`transition-colors ${
                  isLocked
                    ? 'text-primary'
                    : 'text-gray-400 hover:text-primary'
                }`}
              />
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-dark-bg/95 backdrop-blur-sm border border-dark-border text-[10px] text-white px-2 py-1 rounded opacity-0 hover-tooltip transition-opacity whitespace-nowrap pointer-events-none z-[60]">
                {isLocked ? 'Auto-hide' : 'Keep visible'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Scoped styles for tooltip fix */}
      <style>{`
        .icon-button-group:hover .hover-tooltip {
          opacity: 1;
        }
      `}</style>
    </>
  )
}

export default ActionBar
