import { EventEmitter } from 'events';
import { query, type SDKMessage, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { databaseService } from './DatabaseService';
import { getResearchAgentSystemPrompt } from '../prompts/research-agent-prompts';
import { getResearchAgentConfig } from '../config/research-agent-configs';

/**
 * Research Agent attachment (images only for now)
 */
export interface ResearchAgentAttachment {
  type: 'image';
  data: string; // base64 encoded
  mediaType: string; // e.g., 'image/jpeg', 'image/png'
  name?: string;
}

/**
 * Research Agent types
 */
export type ResearchAgentType =
  | 'bug-finder'
  | 'code-auditor'
  | 'web-searcher'
  | 'api-researcher'
  | 'feature-planner'
  | 'researcher';

/**
 * Research Agent status
 */
export type ResearchAgentStatus = 'starting' | 'working' | 'finished' | 'error' | 'stopped';

/**
 * Research Agent instance
 */
export interface ResearchAgent {
  id: string; // Unique agent ID (UUID)
  projectId: string;
  agentType: ResearchAgentType;
  task: string; // User's original prompt
  model: string;
  sessionId: string | null; // Claude session ID
  status: ResearchAgentStatus;
  currentActivity: string | null; // Current tool/action being executed
  startTime: number; // Timestamp
  endTime: number | null;
  result: string | null; // Final result
  briefDescription: string | null; // Extracted from <BRIEF_DESCRIPTION> tag
  summary: string | null; // Extracted from <SUMMARY> tag
  actions: any[] | null; // Extracted from <ACTIONS> tag (bug-finder, code-auditor, api-researcher, feature-planner)
  findings: string | null; // Extracted from <FINDINGS> tag (web-searcher, researcher) - markdown format
  fullHistory: string | null; // JSON string of all messages
  abortController: AbortController | null;
  query: Query | null;
}

/**
 * Research Agent event for real-time updates
 */
export interface ResearchAgentEvent {
  agentId: string;
  projectId: string;
  type: string;
  message?: any;
}

/**
 * ResearchAgentService
 *
 * Manages multiple parallel research agents using Claude Agent SDK.
 * Each agent runs independently with its own session, context, and system prompt.
 */
class ResearchAgentService extends EventEmitter {
  private agents: Map<string, ResearchAgent> = new Map();

  /**
   * Start a new research agent
   */
  async startAgent(
    projectId: string,
    projectPath: string,
    agentType: ResearchAgentType,
    task: string,
    model: string,
    attachments?: ResearchAgentAttachment[]
  ): Promise<string> {
    // Generate unique agent ID
    const agentId = this.generateAgentId();

    // Create abort controller
    const abortController = new AbortController();

    // Create agent instance
    const agent: ResearchAgent = {
      id: agentId,
      projectId,
      agentType,
      task,
      model,
      sessionId: null,
      status: 'starting',
      currentActivity: null,
      startTime: Date.now(),
      endTime: null,
      result: null,
      briefDescription: null,
      summary: null,
      actions: null,
      findings: null,
      fullHistory: null,
      abortController,
      query: null,
    };

    this.agents.set(agentId, agent);

    // Save to database
    databaseService.createResearchAgent(agent);

    // Emit status change
    this.emitAgentUpdate(agentId);

    // Start processing in background
    this.processAgent(agentId, projectPath, task, attachments).catch((error) => {
      console.error(`❌ Research agent ${agentId} failed:`, error);
      this.updateAgentStatus(agentId, 'error');
    });

    return agentId;
  }

  /**
   * Process agent with Claude SDK
   */
  private async processAgent(
    agentId: string,
    projectPath: string,
    task: string,
    attachments?: ResearchAgentAttachment[]
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Update status to working
    this.updateAgentStatus(agentId, 'working');

    // Get configuration for this agent type
    const agentConfig = getResearchAgentConfig(agent.agentType);

    // Get system prompt for agent type
    const systemPrompt = getResearchAgentSystemPrompt(agent.agentType);

    // Build SDK options using agent config
    const options = {
      cwd: projectPath,
      permissionMode: agentConfig.permissionMode,
      maxTurns: agentConfig.maxTurns,
      signal: agent.abortController?.signal,
      pathToClaudeCodeExecutable: this.getClaudeExecutablePath(),
      model: agentConfig.model || agent.model, // Use config model if specified, otherwise user's choice
      systemPrompt: systemPrompt,
      settingSources: ['project' as const],
      // Apply tool restrictions from config
      ...(agentConfig.allowedTools && { allowedTools: agentConfig.allowedTools }),
      ...(agentConfig.disallowedTools && { disallowedTools: agentConfig.disallowedTools }),
      ...(agentConfig.maxThinkingTokens && { maxThinkingTokens: agentConfig.maxThinkingTokens }),
      ...(agentConfig.includePartialMessages && { includePartialMessages: agentConfig.includePartialMessages }),
      ...(agentConfig.additionalDirectories && { additionalDirectories: agentConfig.additionalDirectories }),
    };

    try {
      // Build prompt with attachments if provided
      let queryPrompt: string | AsyncIterable<SDKUserMessage>;

      if (attachments && attachments.length > 0) {
        // Build multimodal content
        const content: Array<any> = [];

        // Add images
        for (const attachment of attachments) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.mediaType,
              data: attachment.data,
            },
          });
        }

        // Add text prompt
        content.push({
          type: 'text',
          text: task,
        });

        // Create async generator for multimodal input
        queryPrompt = (async function* () {
          const userMessage = {
            type: 'user' as const,
            message: { role: 'user' as const, content },
            parent_tool_use_id: null,
          } as SDKUserMessage;
          yield userMessage;
        })();
      } else {
        // Simple text prompt
        queryPrompt = task;
      }

      // Start query
      const claudeQuery = query({ prompt: queryPrompt, options });
      agent.query = claudeQuery;

      // Process messages
      const messages: any[] = [];

      for await (const msg of claudeQuery) {
        // Store session ID
        if (msg.session_id && !agent.sessionId) {
          agent.sessionId = msg.session_id;
          databaseService.updateResearchAgentSessionId(agentId, msg.session_id);
        }

        // Store message
        messages.push(msg);

        // Track current activity from tool usage
        this.updateAgentActivity(agentId, msg);

        // Emit event for real-time updates
        this.emit('research-agent-event', {
          agentId,
          projectId: agent.projectId,
          type: msg.type,
          message: msg,
        });

        // Check for completion
        if (msg.type === 'result') {
          // Extract brief description, summary, actions, and findings from messages
          const { briefDescription, summary, actions, findings, fullText } = this.extractAgentResults(messages);

          // Update agent
          agent.result = fullText;
          agent.briefDescription = briefDescription;
          agent.summary = summary;
          agent.actions = actions;
          agent.findings = findings;
          agent.fullHistory = JSON.stringify(messages);
          agent.endTime = Date.now();

          // Save to database
          databaseService.updateResearchAgentResult(agentId, {
            result: fullText,
            briefDescription,
            summary,
            actions: actions ? JSON.stringify(actions) : null,
            findings,
            fullHistory: agent.fullHistory,
            endTime: agent.endTime,
          });

          // Update status to finished
          this.updateAgentStatus(agentId, 'finished');

          // Emit completion
          this.emit('research-agent-complete', {
            agentId,
            projectId: agent.projectId,
          });
        }
      }
    } catch (error: any) {
      // Check if aborted
      if (error.name === 'AbortError') {
        this.updateAgentStatus(agentId, 'stopped');
      } else {
        console.error(`❌ Research agent ${agentId} error:`, error);
        this.updateAgentStatus(agentId, 'error');
      }
    }
  }

  /**
   * Update agent's current activity based on streaming messages
   */
  private updateAgentActivity(agentId: string, msg: any): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    let activity: string | null = null;

    // Parse assistant messages for tool usage
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        // Tool use block
        if (block.type === 'tool_use') {
          activity = this.formatToolActivity(block.name, block.input);
        }
      }
    }

    // Parse streaming events for tool usage
    if (msg.type === 'stream_event' && msg.event) {
      const event = msg.event;

      // Tool use started
      if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
        activity = this.formatToolActivity(event.content_block.name, null);
      }
    }

    // Update activity if found
    if (activity && activity !== agent.currentActivity) {
      agent.currentActivity = activity;

      // Emit update so frontend can show it
      this.emitAgentUpdate(agentId);
    }
  }

  /**
   * Format tool usage into readable activity string
   */
  private formatToolActivity(toolName: string, input: any): string {
    const toolLabels: Record<string, string> = {
      'Read': 'Reading file',
      'Grep': 'Searching code',
      'Glob': 'Finding files',
      'WebFetch': 'Fetching documentation',
      'WebSearch': 'Searching web',
      'TodoWrite': 'Planning tasks',
      'Task': 'Launching subagent',
      'ExitPlanMode': 'Finalizing analysis',
    };

    const label = toolLabels[toolName] || `Using ${toolName}`;

    // Add context from input if available
    if (input) {
      if (input.file_path) {
        const fileName = input.file_path.split('/').pop();
        return `${label}: ${fileName}`;
      }
      if (input.pattern) {
        return `${label}: ${input.pattern}`;
      }
      if (input.query) {
        return `${label}: ${input.query.substring(0, 40)}...`;
      }
      if (input.url) {
        return `${label}: ${new URL(input.url).hostname}`;
      }
    }

    return label;
  }

  /**
   * Extract brief description, summary, actions, and findings from agent messages
   */
  private extractAgentResults(messages: any[]): {
    briefDescription: string | null;
    summary: string | null;
    actions: any[] | null;
    findings: string | null;
    fullText: string;
  } {
    let briefDescription: string | null = null;
    let summary: string | null = null;
    let actions: any[] | null = null;
    let findings: string | null = null;
    let fullTextParts: string[] = [];

    // Iterate through messages and extract text
    for (const msg of messages) {
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          if (block.type === 'text' && block.text) {
            fullTextParts.push(block.text);

            // Try to extract <BRIEF_DESCRIPTION> tag
            const briefMatch = block.text.match(/<BRIEF_DESCRIPTION>([\s\S]*?)<\/BRIEF_DESCRIPTION>/);
            if (briefMatch) {
              briefDescription = briefMatch[1].trim();
            }

            // Try to extract <SUMMARY> tag
            const summaryMatch = block.text.match(/<SUMMARY>([\s\S]*?)<\/SUMMARY>/);
            if (summaryMatch) {
              summary = summaryMatch[1].trim();
            }

            // Try to extract <ACTIONS> tag (JSON array)
            const actionsMatch = block.text.match(/<ACTIONS>([\s\S]*?)<\/ACTIONS>/);
            if (actionsMatch) {
              try {
                actions = JSON.parse(actionsMatch[1].trim());
              } catch (e) {
                console.warn('❌ Failed to parse <ACTIONS> JSON:', e);
              }
            }

            // Try to extract <FINDINGS> tag (markdown)
            const findingsMatch = block.text.match(/<FINDINGS>([\s\S]*?)<\/FINDINGS>/);
            if (findingsMatch) {
              findings = findingsMatch[1].trim();
            }
          }
        }
      }
    }

    const fullText = fullTextParts.join('\n');

    // If no findings but we expected them (no actions), use fullText as fallback
    if (!findings && !actions && fullText.length > 0) {
      findings = fullText;
    }

    return {
      briefDescription,
      summary,
      actions,
      findings,
      fullText,
    };
  }

  /**
   * Stop an agent
   */
  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    // Abort the query
    agent.abortController?.abort();

    // Update status
    this.updateAgentStatus(agentId, 'stopped');
  }

  /**
   * Get all agents for a project
   */
  getAgentsForProject(projectId: string): ResearchAgent[] {
    const agents: ResearchAgent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.projectId === projectId) {
        agents.push(agent);
      }
    }
    return agents;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): ResearchAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Update agent status
   */
  private updateAgentStatus(agentId: string, status: ResearchAgentStatus): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.status = status;

    // Save to database
    databaseService.updateResearchAgentStatus(agentId, status);

    // Emit update
    this.emitAgentUpdate(agentId);
  }

  /**
   * Emit agent update
   */
  private emitAgentUpdate(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    this.emit('research-agent-status', {
      agentId,
      projectId: agent.projectId,
      status: agent.status,
      agent: this.getAgentData(agent),
    });
  }

  /**
   * Get serializable agent data
   */
  private getAgentData(agent: ResearchAgent): any {
    return {
      id: agent.id,
      projectId: agent.projectId,
      agentType: agent.agentType,
      task: agent.task,
      model: agent.model,
      status: agent.status,
      currentActivity: agent.currentActivity,
      startTime: agent.startTime,
      endTime: agent.endTime,
      result: agent.result,
      briefDescription: agent.briefDescription,
      summary: agent.summary,
      actions: agent.actions,
      findings: agent.findings,
    };
  }

  /**
   * Generate unique agent ID
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get path to Claude Code CLI executable
   * @private
   */
  private getClaudeExecutablePath(): string {
    try {
      // Try to find claude in PATH
      const path = execSync('which claude', { encoding: 'utf-8' }).trim();
      if (path) {
        return path;
      }
    } catch (error) {
      // which failed, try common paths
    }

    // Common installation paths
    const commonPaths = [
      '/opt/homebrew/bin/claude', // Homebrew on Apple Silicon
      '/usr/local/bin/claude',    // Homebrew on Intel Mac
      process.env.HOME + '/.local/bin/claude', // npm global install
      '/usr/bin/claude',           // System install
    ];

    for (const path of commonPaths) {
      try {
        if (existsSync(path)) {
          return path;
        }
      } catch (error) {
        // Continue checking
      }
    }

    // Default to 'claude' and hope it's in PATH
    return 'claude';
  }

  /**
   * Load agents from database on startup
   */
  loadAgentsForProject(projectId: string): void {
    const dbAgents = databaseService.getResearchAgentsForProject(projectId);

    for (const dbAgent of dbAgents) {
      // Only load agents that are not already in memory
      if (!this.agents.has(dbAgent.id)) {
        // Convert database agent to in-memory agent
        const agent: ResearchAgent = {
          id: dbAgent.id,
          projectId: dbAgent.projectId,
          agentType: dbAgent.agentType as ResearchAgentType,
          task: dbAgent.task,
          model: dbAgent.model,
          sessionId: dbAgent.sessionId,
          status: dbAgent.status as ResearchAgentStatus,
          currentActivity: null, // Activity only tracked for running agents
          startTime: dbAgent.startTime,
          endTime: dbAgent.endTime,
          result: dbAgent.result,
          briefDescription: dbAgent.briefDescription,
          summary: dbAgent.summary,
          actions: dbAgent.actions ? JSON.parse(dbAgent.actions) : null,
          findings: dbAgent.findings,
          fullHistory: dbAgent.fullHistory,
          abortController: null, // Don't restore abort controller
          query: null, // Don't restore query
        };

        this.agents.set(agent.id, agent);
      }
    }
  }
}

// Export singleton instance
export const researchAgentService = new ResearchAgentService();
