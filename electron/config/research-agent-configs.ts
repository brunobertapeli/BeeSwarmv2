import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import { ResearchAgentType } from '../services/ResearchAgentService';

/**
 * Configuration for a research agent type
 */
export interface ResearchAgentConfig {
  /**
   * Permission mode for this agent
   * - 'default': Standard permission behavior
   * - 'acceptEdits': Auto-accept file edits
   * - 'bypassPermissions': Bypass all permission checks (autonomous)
   * - 'plan': Planning mode - no execution, asks for approval
   */
  permissionMode: PermissionMode;

  /**
   * List of allowed tool names for this agent
   * If undefined, all tools are allowed
   */
  allowedTools?: string[];

  /**
   * List of disallowed tool names for this agent
   * Takes precedence over allowedTools
   */
  disallowedTools?: string[];

  /**
   * Maximum number of conversation turns
   * Prevents infinite loops
   */
  maxTurns?: number;

  /**
   * Maximum tokens for extended thinking
   * Enables deeper reasoning for complex tasks
   */
  maxThinkingTokens?: number;

  /**
   * Model override for this agent type
   * If undefined, uses the model selected by user
   */
  model?: string;

  /**
   * Whether to include partial message events
   * Useful for streaming progress updates
   */
  includePartialMessages?: boolean;

  /**
   * Additional directories this agent can access
   * Beyond the project working directory
   */
  additionalDirectories?: string[];
}

/**
 * Configuration for each research agent type
 */
export const RESEARCH_AGENT_CONFIGS: Record<ResearchAgentType, ResearchAgentConfig> = {
  /**
   * Bug Finder Agent
   * - Searches for bugs, edge cases, logic errors
   * - Read-only access, no file modifications
   * - Uses plan mode to present findings for review
   */
  'bug-finder': {
    permissionMode: 'plan',
    allowedTools: [
      // File reading and searching
      'Read',
      'Grep',
      'Glob',

      // Code analysis
      'WebFetch', // Can fetch documentation

      // Organization
      'TodoWrite',
      'ExitPlanMode',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 15,
    maxThinkingTokens: 3000,
    includePartialMessages: true, // Enable streaming for real-time progress
  },

  /**
   * Code Auditor Agent
   * - Performs security audits and code quality checks
   * - Read-only access with web search capabilities
   * - Uses plan mode to present audit report
   */
  'code-auditor': {
    permissionMode: 'plan',
    allowedTools: [
      // File reading and searching
      'Read',
      'Grep',
      'Glob',

      // Research
      'WebFetch',
      'WebSearch',

      // Organization
      'TodoWrite',
      'ExitPlanMode',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 20,
    maxThinkingTokens: 4000,
    includePartialMessages: true, // Enable streaming for real-time progress
  },

  /**
   * Web Searcher Agent
   * - Searches the web for information, documentation, tutorials
   * - Can read local files for context
   * - Autonomous mode for fast results
   */
  'web-searcher': {
    permissionMode: 'bypassPermissions',
    allowedTools: [
      // Web access
      'WebSearch',
      'WebFetch',

      // Read local files for context
      'Read',
      'Grep',
      'Glob',

      // Organization
      'TodoWrite',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 10,
    maxThinkingTokens: 2000,
    includePartialMessages: true, // Enable streaming for real-time progress
  },

  /**
   * API Researcher Agent
   * - Researches APIs, compares options, analyzes documentation
   * - Can search web and read local files
   * - Uses plan mode to present recommendations
   */
  'api-researcher': {
    permissionMode: 'plan',
    allowedTools: [
      // Web research
      'WebSearch',
      'WebFetch',

      // Read local files for context
      'Read',
      'Grep',
      'Glob',

      // Organization
      'TodoWrite',
      'ExitPlanMode',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 15,
    maxThinkingTokens: 3500,
    includePartialMessages: true, // Enable streaming for real-time progress
  },

  /**
   * Feature Planner Agent
   * - Creates implementation plans for new features
   * - Can read codebase and search for patterns
   * - Uses plan mode to present detailed plan
   */
  'feature-planner': {
    permissionMode: 'plan',
    allowedTools: [
      // Codebase exploration
      'Read',
      'Grep',
      'Glob',

      // Research
      'WebFetch',
      'WebSearch',

      // Organization
      'TodoWrite',
      'ExitPlanMode',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 20,
    maxThinkingTokens: 5000, // Needs deep thinking for planning
    includePartialMessages: true, // Enable streaming for real-time progress
  },

  /**
   * General Researcher Agent
   * - General-purpose research for any topic
   * - Full read access with web search
   * - Autonomous mode for flexibility
   */
  'researcher': {
    permissionMode: 'default', // Standard mode with user prompts
    allowedTools: [
      // Full read access
      'Read',
      'Grep',
      'Glob',

      // Web research
      'WebSearch',
      'WebFetch',

      // Organization
      'TodoWrite',
    ],
    disallowedTools: [
      // No file modifications
      'Write',
      'Edit',
      'NotebookEdit',

      // No command execution
      'Bash',
      'BashOutput',
      'KillBash',
    ],
    maxTurns: 15,
    maxThinkingTokens: 3000,
    includePartialMessages: true, // Enable streaming for real-time progress
  },
};

/**
 * Get configuration for a specific agent type
 */
export function getResearchAgentConfig(agentType: ResearchAgentType): ResearchAgentConfig {
  const config = RESEARCH_AGENT_CONFIGS[agentType];
  if (!config) {
    throw new Error(`No configuration found for agent type: ${agentType}`);
  }
  return config;
}

/**
 * Get merged configuration for an agent, allowing runtime overrides
 */
export function getMergedAgentConfig(
  agentType: ResearchAgentType,
  overrides?: Partial<ResearchAgentConfig>
): ResearchAgentConfig {
  const baseConfig = getResearchAgentConfig(agentType);

  // Merge overrides
  return {
    ...baseConfig,
    ...overrides,
    // Special handling for arrays - merge instead of replace
    allowedTools: overrides?.allowedTools ?? baseConfig.allowedTools,
    disallowedTools: overrides?.disallowedTools ?? baseConfig.disallowedTools,
    additionalDirectories: overrides?.additionalDirectories ?? baseConfig.additionalDirectories,
  };
}
