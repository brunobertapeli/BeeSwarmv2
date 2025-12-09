/**
 * Helper functions for StatusSheet component
 * Extracted from StatusSheet.tsx for better maintainability
 */

import type { ConversationBlock, ConversationMessage, CompletionStats, Action } from '../types/statusSheet'

// ============================================
// CONSTANTS
// ============================================

export const LOADING_PHRASES = [
  'Warming up the engines...',
  'Booting up the code engines...',
  'Charging the circuits...',
  'Activating the neural cores...',
  'Charging the neural network...',
  'Spinning up the AI nodes...',
  'Linking the thought patterns...',
  'Calibrating the reasoning unit...',
  'Optimizing the neural flow...',
] as const

// ============================================
// PURE HELPER FUNCTIONS
// ============================================

/**
 * Safe JSON parse with fallback
 */
export function safeParse<T = any>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString) return fallback
  try {
    return JSON.parse(jsonString)
  } catch (e) {
    console.error('Failed to parse JSON:', e)
    return fallback
  }
}

/**
 * Check if block has a plan waiting for approval
 */
export function hasPlanWaitingApproval(block: ConversationBlock): boolean {
  if (!block.isComplete) {
    return false
  }

  // Check interactionType first (most reliable)
  if (block.interactionType === 'plan_ready') {
    return true
  }

  // Fallback: Check if tool summary contains ExitPlanMode
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

/**
 * Get random loading phrase based on block ID for consistency
 */
export function getLoadingPhrase(blockId: string): string {
  const hash = blockId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return LOADING_PHRASES[hash % LOADING_PHRASES.length]
}

/**
 * Estimate number of lines in user prompt
 */
export function estimatePromptLines(text: string): number {
  if (!text) return 1
  const charsPerLine = 50
  const explicitLines = text.split('\n').length
  const estimatedLines = Math.ceil(text.length / charsPerLine)
  return Math.max(explicitLines, estimatedLines)
}

/**
 * Get font size class based on line count
 */
export function getPromptFontSize(lineCount: number): string {
  if (lineCount >= 8) return 'text-[13px]'
  if (lineCount >= 2) return 'text-[14px]'
  return 'text-[15px]'
}

// ============================================
// TRANSFORM FUNCTION
// ============================================

/**
 * Transform database block to UI block
 */
export function transformBlock(block: any): ConversationBlock {
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
    const claudeMessages = safeParse(block.claudeMessages, [])

    if (Array.isArray(claudeMessages)) {
      claudeMessages.forEach((msg: any) => {
        if (typeof msg === 'string') {
          timedMessages.push({
            type: 'assistant',
            content: msg,
          })
        } else if (msg.type === 'text') {
          timedMessages.push({
            type: 'assistant',
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
          })
        } else if (msg.type === 'thinking') {
          timedMessages.push({
            type: 'thinking',
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
            thinkingDuration: msg.thinkingDuration,
          })
        }
      })
    }
  }

  // Parse tool executions
  if (block.toolExecutions) {
    const toolData = safeParse(block.toolExecutions, [])

    if (block.isComplete) {
      // Completed: show grouped summary
      if (Array.isArray(toolData) && toolData.length > 0) {
        const grouped: Record<string, number> = {}
        toolData.forEach((tool: any) => {
          grouped[tool.toolName] = (grouped[tool.toolName] || 0) + 1
        })
        const toolMessages = Object.entries(grouped).map(([toolName, count]) =>
          `${count}x ${toolName}`
        ).join(', ')
        if (toolMessages) {
          timedMessages.push({
            type: 'tool',
            content: toolMessages,
          })
        }
      } else if (toolData && typeof toolData === 'object' && !Array.isArray(toolData)) {
        // Already grouped (legacy)
        const toolMessages = Object.entries(toolData).map(([toolName, count]) =>
          `${count}x ${toolName}`
        ).join(', ')
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
            const fileName = tool.filePath.split('/').pop() || tool.filePath
            toolMsg += ` @ ${fileName}`
          } else if (tool.command) {
            toolMsg += ` @ ${tool.command}`
          }

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
  }

  // Sort all messages by timestamp
  timedMessages.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0
    if (!a.timestamp) return 1
    if (!b.timestamp) return -1
    return a.timestamp.getTime() - b.timestamp.getTime()
  })

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
    completionStats = safeParse(block.completionStats, undefined)
  }

  // Parse actions
  let actions: Action[] | undefined
  let initializationStages: { label: string; isComplete: boolean }[] | undefined
  let templateName: string | undefined
  let sourceProjectName: string | undefined
  let blockType: 'conversation' | 'initialization' | 'context_cleared' = 'conversation'

  // Check for context_cleared type first
  if (block.interactionType === 'context_cleared') {
    blockType = 'context_cleared'
  }

  if (block.actions) {
    const parsedActions = safeParse(block.actions, null)

    if (parsedActions) {
      if (parsedActions.type === 'initialization') {
        blockType = 'initialization'
        templateName = parsedActions.templateName
        initializationStages = parsedActions.stages
        sourceProjectName = parsedActions.sourceProjectName // For forked projects
      } else if (Array.isArray(parsedActions)) {
        actions = parsedActions
      }
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
    sourceProjectName,
    interactionType: block.interactionType,
    completedAt: block.completedAt || undefined,
  }
}
