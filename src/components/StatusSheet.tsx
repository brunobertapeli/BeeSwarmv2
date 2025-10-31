import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Loader2, RotateCcw, User, Bot, Square, Rocket, Globe, ExternalLink } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface ConversationMessage {
  type: 'user' | 'assistant' | 'tool'
  content: string
  timestamp?: Date
}

interface DeploymentStage {
  label: string
  isComplete: boolean
}

interface ConversationBlock {
  id: string
  type: 'conversation' | 'deployment'
  userPrompt?: string
  messages?: ConversationMessage[]
  isComplete: boolean
  commitHash?: string
  // Deployment-specific fields
  deploymentStages?: DeploymentStage[]
  deploymentUrl?: string
}

// Mock conversation blocks - will be replaced with real data from backend
const MOCK_BLOCKS: ConversationBlock[] = [
  {
    id: '1',
    type: 'conversation',
    userPrompt: 'Add a dark mode toggle to the settings page',
    messages: [
      { type: 'assistant', content: "I'll help you add a dark mode toggle. Let me first check the current settings page structure." },
      { type: 'tool', content: 'Reading file: src/pages/Settings.tsx' },
      { type: 'tool', content: 'Reading file: src/context/ThemeContext.tsx' },
      { type: 'assistant', content: 'I found the theme context. Now I\'ll add the toggle component.' },
      { type: 'tool', content: 'Writing changes to src/pages/Settings.tsx' },
      { type: 'tool', content: 'Creating new file: src/components/DarkModeToggle.tsx' },
      { type: 'assistant', content: 'Dark mode toggle has been added to the settings page.' },
      { type: 'tool', content: 'Committed changes: "feat: add dark mode toggle to settings"' },
    ],
    isComplete: true,
    commitHash: 'a3f2b1c',
  },
  {
    id: '2',
    type: 'conversation',
    userPrompt: 'Fix the bug where the form doesn\'t validate email correctly',
    messages: [
      { type: 'assistant', content: 'I\'ll investigate the email validation issue.' },
      { type: 'tool', content: 'Searching for email validation logic...' },
      { type: 'tool', content: 'Found in src/utils/validation.ts' },
      { type: 'tool', content: 'Reading file: src/utils/validation.ts' },
      { type: 'assistant', content: 'I found the issue - the regex pattern was missing special characters. Fixing now.' },
      { type: 'tool', content: 'Updating validation.ts...' },
      { type: 'tool', content: 'Running tests...' },
      { type: 'assistant', content: 'Tests passed! The email validation is now working correctly.' },
      { type: 'tool', content: 'Committed changes: "fix: improve email validation regex"' },
    ],
    isComplete: true,
    commitHash: 'b7e4d2a',
  },
  {
    id: '3',
    type: 'conversation',
    userPrompt: 'Create a loading skeleton for the user profile card',
    messages: [
      { type: 'assistant', content: 'I\'ll create a loading skeleton component for the profile card.' },
      { type: 'tool', content: 'Reading file: src/components/ProfileCard.tsx' },
      { type: 'assistant', content: 'Analyzing the profile card structure to match the skeleton design...' },
      { type: 'tool', content: 'Creating ProfileCardSkeleton.tsx...' },
    ],
    isComplete: false,
  },
]

interface StatusSheetProps {
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onStopClick?: () => void
}

function StatusSheet({ onMouseEnter, onMouseLeave, onStopClick }: StatusSheetProps) {
  const { deploymentStatus } = useAppStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [allBlocks, setAllBlocks] = useState<ConversationBlock[]>(MOCK_BLOCKS)

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
    return latestMessage?.content || ''
  }

  return (
    <div
      className={`fixed left-1/2 transform -translate-x-1/2 z-45 transition-all duration-500 ease-out ${
        isVisible ? 'bottom-[110px] opacity-100' : 'bottom-[90px] opacity-0'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="bg-dark-card border border-dark-border rounded-t-2xl shadow-2xl w-[680px] overflow-hidden transition-all duration-300 pb-4"
        style={{
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* Collapsed State - Single Clickable Row */}
        {!isExpanded && (
          <div
            className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
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
          <div className="px-4 pb-3">
            {/* Collapsible header */}
            <div
              className="flex items-center justify-between mb-3 py-2.5 cursor-pointer hover:bg-white/5 -mx-4 px-4 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <span className="text-xs font-medium text-gray-300">Conversation History</span>
              <button className="p-1">
                <ChevronDown size={14} className="text-gray-300" />
              </button>
            </div>

            {/* Conversation blocks - scrollable */}
            <div className="space-y-3 max-h-[400px] overflow-y-scroll pr-2 custom-scrollbar">
              {allBlocks.map((block, blockIndex) => {
                const isLastBlock = blockIndex === allBlocks.length - 1
                const showStopButton = isLastBlock && !block.isComplete

                // Render deployment block
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

                // Render conversation block
                return (
                  <div key={block.id} className="bg-white/5 rounded-lg p-3 border border-white/10 relative">
                    {/* Checkpoint button or Stop button */}
                    {block.isComplete ? (
                      <button
                        className="absolute top-2 right-2 p-1.5 hover:bg-white/10 rounded-lg transition-colors group tooltip-fast"
                        title="Restore to this checkpoint"
                      >
                        <RotateCcw size={12} className="text-gray-400 group-hover:text-primary transition-colors" />
                      </button>
                    ) : showStopButton ? (
                      <button
                        onClick={onStopClick}
                        className="absolute top-2 right-2 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors group tooltip-fast"
                        title="Stop generation"
                      >
                        <Square size={12} className="text-gray-400 group-hover:text-red-400 transition-colors fill-current" />
                      </button>
                    ) : null}

                  {/* User Prompt */}
                  {block.userPrompt && (
                    <div className="flex items-start gap-2 mb-2 pr-8">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                        <User size={12} className="text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <span className="text-xs font-medium text-gray-200">{block.userPrompt}</span>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  <div className="space-y-1.5 ml-7">
                    {block.messages?.map((message, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {message.type === 'assistant' && (
                          <>
                            <Bot size={10} className="text-primary flex-shrink-0 mt-1 opacity-60" />
                            <span className="text-[11px] text-gray-300 leading-relaxed">{message.content}</span>
                          </>
                        )}
                        {message.type === 'tool' && (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-500/50 flex-shrink-0 mt-1.5" />
                            <span className="text-[11px] text-gray-400 leading-relaxed font-mono">{message.content}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Completion indicator */}
                  {block.isComplete && block.commitHash && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-[10px] text-primary font-mono">
                        Committed: {block.commitHash}
                      </span>
                    </div>
                  )}

                  {/* Working indicator */}
                  {!block.isComplete && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
                      <Loader2 size={10} className="text-primary animate-spin" />
                      <span className="text-[10px] text-primary">
                        Working...
                      </span>
                    </div>
                    )}
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

        /* Fast tooltip appearance */
        .tooltip-fast[title]:hover::after {
          transition-delay: 0.1s !important;
        }
      `}</style>
    </div>
  )
}

export default StatusSheet
