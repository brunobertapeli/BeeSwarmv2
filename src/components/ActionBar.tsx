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
  Smartphone
} from 'lucide-react'
import { useAppStore, type DeploymentStatus } from '../store/appStore'
import { useToast } from '../hooks/useToast'
import StatusSheet from './StatusSheet'
import ContextBar from './ContextBar'
import type { ClaudeStatus, ClaudeContext, ClaudeModel } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'

interface ActionBarProps {
  projectId?: string
  onChatClick?: () => void
  onImagesClick?: () => void
  onSettingsClick?: () => void
  onConsoleClick?: () => void
}

type ViewMode = 'desktop' | 'mobile'

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
  onConsoleClick
}: ActionBarProps) {
  const { netlifyConnected, deploymentStatus, setDeploymentStatus, viewMode, setViewMode } = useAppStore()
  const toast = useToast()
  const [isVisible, setIsVisible] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [claudeStatus, setClaudeStatus] = useState<ClaudeStatus>('idle')
  const [claudeContext, setClaudeContext] = useState<ClaudeContext | null>(null)
  const [availableModels, setAvailableModels] = useState<ClaudeModel[]>([])
  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('sonnet')
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [loadingDots, setLoadingDots] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const workStartTimeRef = useRef<number | null>(null)

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
    setSelectedModel('sonnet') // Default, will be overridden by context if available

    const unsubStatus = window.electronAPI.claude.onStatusChanged((id, status) => {
      if (id === projectId) {
        setClaudeStatus(status)
      }
    })

    const unsubCompleted = window.electronAPI.claude.onCompleted((id) => {
      if (id === projectId) {
        toast.success('Done!', 'Claude finished successfully')
        setClaudeStatus('completed')
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
      } else {
        // Only set to null if no context exists
        setClaudeContext(null)
      }
    })

    return () => {
      unsubStatus()
      unsubCompleted()
      unsubError()
      unsubContextUpdated()
      unsubModelChanged()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 8 * 24 // 8 lines * 24px line height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }, [message])

  // Close model dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false)
      }
    }

    if (showModelDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelDropdown])

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

  // Animate loading dots and track elapsed time when Claude is working
  useEffect(() => {
    if (isClaudeWorking) {
      // Start timer
      workStartTimeRef.current = Date.now()
      setElapsedSeconds(0)

      // Animate dots: '' -> '.' -> '..' -> '...'
      const dotsInterval = setInterval(() => {
        setLoadingDots(prev => {
          if (prev === '...') return ''
          return prev + '.'
        })
      }, 400)

      // Update elapsed time every second
      const timeInterval = setInterval(() => {
        if (workStartTimeRef.current) {
          const elapsed = Math.floor((Date.now() - workStartTimeRef.current) / 1000)
          setElapsedSeconds(elapsed)
        }
      }, 1000)

      return () => {
        clearInterval(dotsInterval)
        clearInterval(timeInterval)
      }
    } else {
      // Reset when not working
      setLoadingDots('')
      setElapsedSeconds(0)
      workStartTimeRef.current = null
    }
  }, [isClaudeWorking])

  const handleSend = async () => {
    if (message.trim() && !isInputBlocked && projectId) {
      const prompt = message.trim()
      setMessage('')

      try {
        // Create chat block first
        const blockResult = await window.electronAPI?.chat.createBlock(projectId, prompt)

        if (!blockResult?.success) {
          toast.error('Failed to create chat block', blockResult?.error || 'Unknown error')
          console.error('Failed to create chat block:', blockResult?.error)
          return
        }

        console.log('✅ Chat block created:', blockResult.block.id)

        // Check if Claude session exists, if not start it with the prompt
        const statusResult = await window.electronAPI?.claude.getStatus(projectId)

        if (statusResult?.status === 'idle') {
          // Start session with the prompt and selected model (lazy initialization)
          const result = await window.electronAPI?.claude.startSession(projectId, prompt, selectedModel)

          if (!result?.success) {
            toast.error('Failed to start Claude', result?.error || 'Unknown error')
            console.error('Failed to start Claude:', result?.error)
          }
        } else {
          // Send prompt to existing session (model is already set)
          const result = await window.electronAPI?.claude.sendPrompt(projectId, prompt)

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

  const toggleViewMode = () => {
    const newMode = viewMode === 'desktop' ? 'mobile' : 'desktop'
    setViewMode(newMode)
    toast.info(
      `Switched to ${newMode} view`,
      'Preview mode updated'
    )
  }

  const handleStop = async () => {
    if (!projectId) return

    try {
      await window.electronAPI?.claude.destroySession(projectId)
      toast.info('Stopped', 'Claude session stopped')
    } catch (error) {
      console.error('Error stopping Claude:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
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
        />
      )}

      {/* Action Bar */}
      <div
        className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[100] transition-all duration-500 ease-out ${
          isVisible && !isHidden
            ? 'translate-y-0 opacity-100'
            : 'translate-y-32 opacity-0'
        }`}
        onMouseEnter={handleMouseEnterBar}
        onMouseLeave={handleMouseLeaveBar}
      >
        <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded-2xl shadow-2xl overflow-visible w-[680px] relative action-bar-container">
          {/* Top Row - Textarea with Send Icon Inside */}
          <div className="px-3 pt-3 pb-2">
            <div className="relative flex items-start">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder={
                  isDeploying
                    ? "Deploying your app..."
                    : isClaudeWorking
                    ? `Claude is working${loadingDots}${elapsedSeconds > 0 ? ` ${elapsedSeconds}s` : ''}`
                    : "Tell Claude what to build..."
                }
                disabled={isInputBlocked}
                className={`flex-1 border border-dark-border/50 rounded-xl px-3.5 py-2.5 pr-11 text-sm outline-none transition-all resize-none overflow-y-auto ${
                  isInputBlocked
                    ? 'bg-dark-bg/30 text-gray-500 placeholder-gray-600 cursor-not-allowed'
                    : 'bg-dark-bg/50 text-white placeholder-gray-500 focus:border-primary/30'
                }`}
                rows={1}
                style={{ lineHeight: '24px', minHeight: '42px', maxHeight: '192px' }}
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || isInputBlocked}
                className={`absolute right-3 transition-all ${
                  (textareaRef.current?.scrollHeight || 0) > 42
                    ? 'bottom-2.5'
                    : 'top-[12px]'
                } ${
                  message.trim() && !isInputBlocked
                    ? 'text-primary hover:text-primary-dark cursor-pointer'
                    : 'text-gray-600 cursor-not-allowed'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          {/* Bottom Row - Model Dropdown + Icons */}
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            {/* Model Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="bg-dark-bg/30 border border-dark-border/30 rounded-lg pl-2.5 pr-7 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer relative flex items-center gap-1.5"
              >
                <span>
                  {availableModels.length > 0
                    ? availableModels.find(m => m.value === selectedModel)?.displayName || selectedModel
                    : selectedModel === 'sonnet' ? 'Sonnet 4.5' : selectedModel === 'opus' ? 'Opus 4.1' : 'Haiku 4.5'}
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
                        { value: 'sonnet', displayName: 'Sonnet 4.5' },
                        { value: 'opus', displayName: 'Opus 4.1' },
                        { value: 'haiku', displayName: 'Haiku 4.5' }
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
              className="p-1.5 hover:bg-dark-bg/50 rounded-lg transition-all icon-button-group relative"
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
                  <div className="relative">
                    <Rocket size={13} className="text-primary animate-pulse" />
                    {/* Spinning ring around rocket */}
                    <svg className="absolute inset-0 -m-1 w-[21px] h-[21px] animate-spin" viewBox="0 0 21 21">
                      <circle
                        cx="10.5"
                        cy="10.5"
                        r="8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray="8 42"
                        className="text-primary opacity-60"
                      />
                    </svg>
                  </div>
                  <span className="text-[11px] text-primary font-medium">
                    {Math.round(deployProgress)}%
                  </span>
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
