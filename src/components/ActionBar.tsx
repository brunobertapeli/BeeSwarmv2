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
import type { ClaudeStatus } from '../types/electron'

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
  const [message, setMessage] = useState('')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4.5')
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Check if Claude is working
  const isClaudeWorking = claudeStatus === 'starting' || claudeStatus === 'running'

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

  // Listen for Claude status changes
  useEffect(() => {
    if (!projectId || !window.electronAPI?.claude) return

    const unsubStatus = window.electronAPI.claude.onStatusChanged((id, status) => {
      if (id === projectId) {
        console.log(`Claude status changed: ${status}`)
        setClaudeStatus(status)
      }
    })

    const unsubCompleted = window.electronAPI.claude.onCompleted((id) => {
      if (id === projectId) {
        console.log('Claude completed!')
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

    // Get initial status
    window.electronAPI.claude.getStatus(projectId).then((result) => {
      if (result.success && result.status) {
        setClaudeStatus(result.status)
      }
    })

    return () => {
      unsubStatus()
      unsubCompleted()
      unsubError()
    }
  }, [projectId, toast])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const scrollHeight = textareaRef.current.scrollHeight
      const maxHeight = 8 * 24 // 8 lines * 24px line height
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }, [message])

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

  const handleSend = async () => {
    if (message.trim() && !isInputBlocked && projectId) {
      const prompt = message.trim()
      setMessage('')

      try {
        // Check if Claude session exists, if not start it with the prompt
        const statusResult = await window.electronAPI?.claude.getStatus(projectId)

        if (statusResult?.status === 'idle') {
          // Start session with the prompt (lazy initialization)
          console.log('Starting Claude session with first message')
          const result = await window.electronAPI?.claude.startSession(projectId, prompt)

          if (!result?.success) {
            toast.error('Failed to start Claude', result?.error || 'Unknown error')
            console.error('Failed to start Claude:', result?.error)
          }
        } else {
          // Send prompt to existing session
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
                    ? "Claude is working..."
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
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-dark-bg/30 border border-dark-border/30 rounded-lg pl-2.5 pr-7 py-1.5 text-[11px] text-gray-300 outline-none hover:border-primary/30 transition-all cursor-pointer appearance-none"
              >
                <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                <option value="gemini-3.0-pro">Gemini 3.0 Pro</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>

            {/* Context Usage Bar */}
            <ContextBar
              onClearContext={async () => {
                if (!projectId) return

                try {
                  await window.electronAPI?.claude.clearSession(projectId)
                  toast.success('Context Cleared', 'Starting fresh conversation')
                } catch (error) {
                  console.error('Error clearing context:', error)
                  toast.error('Failed to clear context', error instanceof Error ? error.message : 'Unknown error')
                }
              }}
              onCompactContext={() => {
                toast.info('Compact Context', 'Optimizing conversation history...')
                console.log('Compact context clicked - TODO')
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
