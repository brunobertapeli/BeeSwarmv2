/**
 * Types for StatusSheet component
 * Extracted from StatusSheet.tsx for better maintainability
 */

export interface ConversationMessage {
  type: 'user' | 'assistant' | 'tool' | 'thinking'
  content: string
  timestamp?: Date
  toolName?: string
  toolId?: string
  toolDuration?: number
  thinkingDuration?: number
}

export interface DeploymentStage {
  label: string
  isComplete: boolean
}

export interface CompletionStats {
  timeSeconds: number
  inputTokens: number
  outputTokens: number
  cost: number
}

export interface Action {
  type: 'git_commit' | 'build' | 'dev_server' | 'checkpoint_restore'
  status: 'in_progress' | 'success' | 'error'
  message?: string
  data?: any
  timestamp: number
}

export interface ConversationBlock {
  id: string
  type: 'conversation' | 'deployment' | 'initialization' | 'context_cleared'
  projectId?: string
  userPrompt?: string
  messages?: ConversationMessage[]
  isComplete: boolean
  commitHash?: string
  filesChanged?: number
  completionStats?: CompletionStats
  summary?: string
  actions?: Action[]
  completionMessage?: string
  interactionType?: string | null
  deploymentStages?: DeploymentStage[]
  deploymentUrl?: string
  initializationStages?: DeploymentStage[]
  templateName?: string
  completedAt?: number
}

export interface StatusSheetProps {
  projectId?: string
  actionBarRef?: React.RefObject<HTMLDivElement>
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onStopClick?: () => void
  onApprovePlan?: () => void
  onRejectPlan?: () => void
  onXMLTagClick?: (tag: string, content: string) => void
  onXMLTagDetected?: (tag: string, content: string) => void
}
