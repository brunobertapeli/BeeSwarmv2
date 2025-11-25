import { EventEmitter } from 'events';
import { query, type SDKMessage, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { databaseService } from './DatabaseService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Attachment for multimodal inputs
 */
export interface ClaudeAttachment {
  type: 'image' | 'document';
  data: string; // base64 encoded
  mediaType: string; // e.g., 'image/jpeg', 'image/png', 'application/pdf'
  name?: string;
}

/**
 * Claude Code session status
 */
export type ClaudeStatus = 'idle' | 'starting' | 'running' | 'completed' | 'error';

/**
 * Parsed Claude Code event (for compatibility with existing handlers)
 */
export interface ClaudeEvent {
  raw: string;
  type?: string;
  status?: string;
  isComplete: boolean;
  isError: boolean;
  message?: any; // SDKMessage content
}

/**
 * Context information tracked per session
 */
export interface ClaudeContext {
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheCreation: number;
  };
  baseline: {
    systemPrompt: number; // System prompt tokens (e.g., 2.6k)
    systemTools: number; // System tools tokens (e.g., 13.3k)
    memoryFiles: number; // Memory files tokens (e.g., 45)
    messages: number; // Initial messages overhead (e.g., 8)
  };
  cost: number; // Total cost in USD
  turns: number; // Number of turns
  model: string; // Current model
  contextWindow: number; // Context window size
}

/**
 * Claude session info
 */
interface ClaudeSession {
  projectPath: string;
  sessionId: string | null; // Claude session ID for resume
  status: ClaudeStatus;
  abortController: AbortController | null; // For cancellation
  query: Query | null; // Active query object for control methods
  context: ClaudeContext; // Context tracking
}

/**
 * ClaudeService
 *
 * Manages Claude Code sessions using the Claude Agent SDK.
 * Each project gets one session that can be resumed across multiple messages.
 * Uses SDK query() function with async generators for structured responses.
 */
class ClaudeService extends EventEmitter {
  private sessions: Map<string, ClaudeSession> = new Map();
  private systemPrompt: string | null = null;

  /**
   * Load system prompt from file
   * This is the general prompt that applies to all projects
   * Individual projects can extend this with their .claude/CLAUDE.md files
   */

  private loadSystemPrompt(): string {
    if (this.systemPrompt) {
      return this.systemPrompt;
    }

    try {
      // Try multiple locations for the system prompt
      const candidates = [
        // 1. Production: Copied to dist-electron/prompts
        path.join(__dirname, 'prompts/system-prompt.txt'),
        // 2. Dev: Relative to source file (electron/services/../prompts)
        path.join(__dirname, '../prompts/system-prompt.txt'),
        // 3. Dev fallback: Relative to dist-electron root (dist-electron/../electron/prompts)
        path.join(__dirname, '../electron/prompts/system-prompt.txt')
      ];

      for (const promptPath of candidates) {
        if (existsSync(promptPath)) {
          this.systemPrompt = readFileSync(promptPath, 'utf-8');
          return this.systemPrompt;
        }
      }

      console.warn('⚠️ System prompt file not found. Checked:', candidates);
      return '';
    } catch (error) {
      console.warn('⚠️ Failed to load system prompt, using empty prompt:', error);
      return '';
    }
  }

  /**
   * Start or resume Claude Code session for a project
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @param prompt - Prompt to send
   * @param model - Optional model to use (defaults to claude-sonnet-4-5)
   * @param attachments - Optional file/image attachments
   * @param thinkingEnabled - Optional flag to enable extended thinking
   * @param planMode - Optional flag to enable plan mode (Claude explores and asks questions before executing)
   */
  async startSession(projectId: string, projectPath: string, prompt: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean): Promise<void> {
    const existingSession = this.sessions.get(projectId);

    // CRITICAL FIX: Validate that project path matches existing session
    // If path changed (project renamed/moved), destroy stale session
    if (existingSession && existingSession.projectPath !== projectPath) {
      console.warn(`⚠️ Project path mismatch detected for ${projectId}`);
      console.warn(`   Expected: ${existingSession.projectPath}`);
      console.warn(`   Got: ${projectPath}`);
      console.warn(`   Destroying stale session and starting fresh...`);

      existingSession.abortController?.abort();
      this.sessions.delete(projectId);

      // Clear saved session ID from database (prevents resume with wrong path)
      databaseService.saveClaudeSessionId(projectId, null);

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    // If session exists and is still running, abort it first
    else if (existingSession && (existingSession.status === 'starting' || existingSession.status === 'running')) {
      existingSession.abortController?.abort();
      // Increased wait time from 100ms to 500ms for better cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // If no model specified, check if there's a stored preference
    // Priority: explicit model parameter > existing session model > default
    const effectiveModel = model || existingSession?.context?.model || 'claude-sonnet-4-5-20250929';


    if (planMode) {
    }

    // Get session ID from database OR existing session for resume
    // CRITICAL: Only resume if the working directory matches!
    let sessionId: string | null = null;

    // First try to get from database (persists across app restarts)
    const savedSessionId = databaseService.getClaudeSessionId(projectId);
    if (savedSessionId) {
      // CRITICAL FIX: Validate project path hasn't changed
      // Database stores session ID but doesn't track path changes
      // We must trust the passed projectPath as source of truth
      const project = databaseService.getProjectById(projectId);
      if (project && project.path === projectPath) {
        sessionId = savedSessionId;
      } else {
        console.warn(`⚠️ Project path changed, clearing saved session ID`);
        databaseService.saveClaudeSessionId(projectId, null);
        sessionId = null;
      }
    }
    // Fallback to existing session in memory
    else if (existingSession?.sessionId) {
      if (existingSession.projectPath === projectPath) {
        sessionId = existingSession.sessionId;
      } else {
        console.warn(`⚠️ Session path mismatch, starting fresh session`);
        sessionId = null;
      }
    }

    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Load context from database if available (for app restart persistence)
    const savedContext = databaseService.getClaudeContext(projectId);

    // Default baseline tokens (~30% of 200k context window = 61k tokens)
    // Based on typical Claude Code session overhead
    const defaultBaseline = {
      systemPrompt: 2600,   // System prompt: 2.6k tokens (1.3%)
      systemTools: 13300,   // System tools: 13.3k tokens (6.6%)
      memoryFiles: 45,      // Memory files: 45 tokens (0.0%)
      messages: 8           // Initial messages: 8 tokens (0.0%)
    };


    const initialContext = existingSession?.context || savedContext || {
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      baseline: defaultBaseline,
      cost: 0,
      turns: 0,
      model: effectiveModel,
      contextWindow: 200000
    };

    // Create or update session object
    const session: ClaudeSession = {
      projectPath,
      sessionId,
      status: 'starting',
      abortController,
      query: null, // Will be set when query starts
      context: initialContext
    };

    this.sessions.set(projectId, session);

    // Emit status change
    this.emitStatusChange(projectId, 'starting');

    // Save initial context to database and emit update
    // This ensures UI shows 30% baseline immediately on session start
    databaseService.saveClaudeContext(projectId, session.context);
    this.emit('claude-context-updated', { projectId, context: session.context });

    // Load system prompt (general instructions for all projects)
    // const systemPromptText = this.loadSystemPrompt();

    // Build SDK options
    const permissionMode = planMode ? ('plan' as const) : ('bypassPermissions' as const);


    const options = {
      cwd: projectPath, // Current working directory
      permissionMode, // Plan mode for exploration, bypass for execution
      maxTurns: 50, // Increased to allow more tool usage with thinking
      abortController, // SDK uses abortController, not signal
      pathToClaudeCodeExecutable: this.getClaudeExecutablePath(), // Path to claude CLI
      model: effectiveModel, // Always set model
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append: this.loadSystemPrompt() // Append custom system prompt
      },
      settingSources: ['project' as const], // Load .claude/CLAUDE.md files from projects
      ...(sessionId && { resume: sessionId }), // Resume if we have session ID
      ...(thinkingEnabled && { maxThinkingTokens: 16000 }), // Enable extended thinking (16k tokens)
    };

    if (thinkingEnabled) {
    }

    try {
      // Update status to running
      this.updateStatus(projectId, 'running');

      // Build prompt - either simple string or rich content with attachments
      let queryPrompt: string | AsyncIterable<SDKUserMessage>;

      // Use prompt as-is - SDK handles plan mode automatically
      let finalPrompt = prompt;

      if (attachments && attachments.length > 0) {

        // Build content array with attachments + text
        const content: Array<any> = [];

        // Add attachments first
        for (const attachment of attachments) {
          if (attachment.type === 'image') {
            const imageContent = {
              type: 'image',
              source: {
                type: 'base64',
                media_type: attachment.mediaType,
                data: attachment.data
              }
            };
            content.push(imageContent);
          } else if (attachment.type === 'document') {
            const docContent = {
              type: 'document',
              source: {
                type: 'base64',
                media_type: attachment.mediaType,
                data: attachment.data
              }
            };
            content.push(docContent);
          }
        }

        // Add text prompt
        content.push({
          type: 'text',
          text: finalPrompt
        });

        // Create async iterator with single message
        queryPrompt = (async function* () {
          const userMessage = {
            type: 'user' as const,
            message: {
              role: 'user' as const,
              content: content
            },
            parent_tool_use_id: null
          } as SDKUserMessage;

          yield userMessage;
        })();
      } else {
        // Simple string prompt (backward compatibility)
        queryPrompt = finalPrompt;
      }

      // Execute query with async generator and store Query object
      const claudeQuery = query({ prompt: queryPrompt, options });

      // Store query object in session for control methods
      const currentSession = this.sessions.get(projectId);
      if (currentSession) {
        currentSession.query = claudeQuery;
      }

      // Note: Model is set via options.model - SDK doesn't support runtime model changes
      // The model will be used for all turns in this query

      for await (const msg of claudeQuery) {

        // Save session ID for future resumption (both memory and database)
        if (msg.session_id) {
          const session = this.sessions.get(projectId);
          if (session && session.sessionId !== msg.session_id) {
            session.sessionId = msg.session_id;
            // Persist to database for cross-restart resume
            databaseService.saveClaudeSessionId(projectId, msg.session_id);
          }
        }

        // Update context from system init message
        if (msg.type === 'system' && msg.subtype === 'init') {
          const session = this.sessions.get(projectId);
          if (session) {
            session.context.model = msg.model || session.context.model;
            this.emit('claude-context-updated', { projectId, context: session.context });
          }
        }

        // Update context from result message
        if (msg.type === 'result') {
          const session = this.sessions.get(projectId);
          if (session) {
            // SUM token counts across all turns (each result message contains tokens for THAT turn only)
            if (msg.usage) {
              session.context.tokens.input += msg.usage.input_tokens || 0;
              session.context.tokens.output += msg.usage.output_tokens || 0;
              session.context.tokens.cacheRead += msg.usage.cache_read_input_tokens || 0;
              session.context.tokens.cacheCreation += msg.usage.cache_creation_input_tokens || 0;
            }

            // SUM cost and turns (SDK gives us per-turn values, not cumulative)
            session.context.cost += msg.total_cost_usd || 0;
            session.context.turns += 1; // Increment by 1 for this turn

            // Note: SDK's SDKResultMessage doesn't include modelUsage
            // Context window is kept at default (200k) or could be determined by model name

            // Save context to database for persistence across app restarts
            databaseService.saveClaudeContext(projectId, session.context);

            // Emit context update event
            this.emit('claude-context-updated', { projectId, context: session.context });
          }
        }

        // Process the message
        this.handleMessage(projectId, msg);

        // Check for completion
        if (msg.type === 'result') {
          this.updateStatus(projectId, 'completed');
          this.emit('claude-complete', { projectId });
          break;
        }
      }

    } catch (error: any) {
      // Check if it was aborted by user - this is expected behavior, not an error
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        // Silent handling - user intentionally stopped the operation
        this.updateStatus(projectId, 'idle');
      } else {
        // Actual error - log and emit
        console.error(`❌ Claude session error for ${projectId}:`, error);
        this.updateStatus(projectId, 'error');
        this.emit('claude-error', { projectId, error: error.message || String(error) });
      }
    }
  }

  /**
   * Send a prompt to Claude using session resume pattern
   * @param projectId - Project identifier
   * @param projectPath - Absolute path to project root
   * @param prompt - User prompt/message
   * @param model - Optional model to use for new sessions
   * @param attachments - Optional file/image attachments
   * @param thinkingEnabled - Optional flag to enable extended thinking
   * @param planMode - Optional flag to enable plan mode
   */
  async sendPrompt(projectId: string, projectPath: string, prompt: string, model?: string, attachments?: ClaudeAttachment[], thinkingEnabled?: boolean, planMode?: boolean): Promise<void> {

    // Use startSession which handles resume automatically
    await this.startSession(projectId, projectPath, prompt, model, attachments, thinkingEnabled, planMode);
  }

  /**
   * Clear session and start fresh (removes session ID and resets context to baseline)
   * @param projectId - Project identifier
   */
  clearSession(projectId: string): void {

    const session = this.sessions.get(projectId);

    // Default baseline tokens
    const defaultBaseline = {
      systemPrompt: 2600,   // System prompt: 2.6k tokens (1.3%)
      systemTools: 13300,   // System tools: 13.3k tokens (6.6%)
      memoryFiles: 45,      // Memory files: 45 tokens (0.0%)
      messages: 8           // Initial messages: 8 tokens (0.0%)
    };

    // Reset context to baseline only (clear conversation tokens)
    const clearedContext: ClaudeContext = {
      tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      baseline: session?.context.baseline || defaultBaseline,
      cost: 0,
      turns: 0,
      model: session?.context.model || 'claude-sonnet-4-5-20250929', // Default to Sonnet if no session
      contextWindow: session?.context.contextWindow || 200000
    };

    // Save cleared context to database
    databaseService.saveClaudeContext(projectId, clearedContext);

    // Emit context update with baseline only
    this.emit('claude-context-updated', { projectId, context: clearedContext });

    // IMPORTANT: Clear session ID from database ALWAYS (not just if session exists in memory)
    databaseService.saveClaudeSessionId(projectId, null);

    // If there's an active session in memory, clean it up
    if (session) {
      session.sessionId = null;
      session.abortController?.abort();
      this.sessions.delete(projectId);
    }

    this.emitStatusChange(projectId, 'idle');
  }

  /**
   * Get context information for a project
   * @param projectId - Project identifier
   */
  getContext(projectId: string): ClaudeContext | null {
    // Default baseline tokens (~30% of 200k context window = 61k tokens)
    const defaultBaseline = {
      systemPrompt: 2600,   // System prompt: 2.6k tokens (1.3%)
      systemTools: 13300,   // System tools: 13.3k tokens (6.6%)
      memoryFiles: 45,      // Memory files: 45 tokens (0.0%)
      messages: 8           // Initial messages: 8 tokens (0.0%)
    };

    // First try to get from active session
    const session = this.sessions.get(projectId);
    if (session?.context) {
      // Ensure baseline exists (for backwards compatibility)
      if (!session.context.baseline) {
        session.context.baseline = defaultBaseline;
      }
      return session.context;
    }

    // If no active session, try to load from database (for app restart)
    const savedContext = databaseService.getClaudeContext(projectId);
    if (savedContext) {
      // Ensure baseline exists (for backwards compatibility)
      if (!savedContext.baseline) {
        savedContext.baseline = defaultBaseline;
      }
      return savedContext;
    }

    return null;
  }

  /**
   * Change model for active session
   * Note: SDK doesn't support runtime model changes. The model preference is stored
   * and will be applied on the next query() call.
   * @param projectId - Project identifier
   * @param modelName - Model to switch to (e.g., 'sonnet', 'opus', 'haiku')
   */
  async changeModel(projectId: string, modelName: string): Promise<void> {
    // Default baseline tokens
    const defaultBaseline = {
      systemPrompt: 2600,
      systemTools: 13300,
      memoryFiles: 45,
      messages: 8
    };

    const session = this.sessions.get(projectId);

    // Update the stored model preference - it will be used on next query
    if (session) {
      session.context.model = modelName;
      // Save updated context to database
      databaseService.saveClaudeContext(projectId, session.context);
      this.emit('claude-model-changed', { projectId, model: modelName });
      this.emit('claude-context-updated', { projectId, context: session.context });
    } else {
      // Load existing context from database or create minimal context
      const existingContext = databaseService.getClaudeContext(projectId);
      const context = existingContext ? {
        ...existingContext,
        model: modelName // Update model in existing context
      } : {
        // Create minimal session to store the preference (new project)
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        baseline: defaultBaseline,
        cost: 0,
        turns: 0,
        model: modelName,
        contextWindow: 200000
      };

      this.sessions.set(projectId, {
        projectPath: '',
        sessionId: null,
        status: 'idle',
        abortController: null,
        query: null,
        context
      });

      // Save updated context to database
      databaseService.saveClaudeContext(projectId, context);

      this.emit('claude-model-changed', { projectId, model: modelName });
      this.emit('claude-context-updated', { projectId, context });
    }
  }

  /**
   * Get available models
   * Returns static list of current Claude models with friendly names
   */
  async getAvailableModels(): Promise<Array<{ value: string; displayName: string; description: string }>> {
    // Return static list of current models
    // Using full model IDs for Claude 4.x series with correct snapshot dates
    return [
      { value: 'claude-sonnet-4-5-20250929', displayName: 'Sonnet 4.5', description: 'Smartest model for daily use' },
      { value: 'claude-opus-4-1-20250805', displayName: 'Opus 4.1', description: 'Reaches usage limits faster' },
      { value: 'claude-haiku-4-5-20251001', displayName: 'Haiku 4.5', description: 'Fastest model for simple tasks' }
    ];
  }

  /**
   * Interrupt current generation (stop mid-execution)
   * Preserves session and allows resuming conversation
   * Note: SDK's interrupt() is only available in streaming input mode.
   * For simple string prompts, we rely on AbortController.
   * @param projectId - Project identifier
   */
  interrupt(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    try {
      // Abort via AbortController - this is the primary cancellation mechanism
      // SDK's interrupt() only works with streaming input mode (AsyncIterable<SDKUserMessage>)
      session.abortController?.abort();
    } catch (error) {
      console.error(`❌ Error interrupting Claude session for ${projectId}:`, error);
    }

    // Mark as idle so UI knows it stopped
    this.emitStatusChange(projectId, 'idle');

    // Session remains intact - conversation can continue
  }

  /**
   * Destroy Claude session (abort current operation)
   * NOTE: This only clears in-memory session, preserving database session ID for resume on app restart
   * @param projectId - Project identifier
   */
  destroySession(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    try {
      session.abortController?.abort();
    } catch (error) {
      console.error(`❌ Error aborting Claude session for ${projectId}:`, error);
    }

    // IMPORTANT: Don't delete session immediately!
    // The session needs to remain in memory so that when Claude finishes,
    // it can still update token counts in the result handler.
    // The session will be cleaned up when:
    // 1. A new session starts for this project (overrides old one)
    // 2. App quits (destroyAllSessions)
    // 3. User explicitly clears context (clearSession)

    // Just mark it as idle so UI knows it's not running
    this.emitStatusChange(projectId, 'idle');

    // NOTE: We intentionally DO NOT clear the database session ID here
    // This allows the session to resume when the app restarts or project is reopened
    // Use clearSession() if you want to permanently clear the conversation history
  }

  /**
   * Get current session status
   * @param projectId - Project identifier
   */
  getStatus(projectId: string): ClaudeStatus {
    const session = this.sessions.get(projectId);
    return session?.status || 'idle';
  }

  /**
   * Get session ID (for persistence)
   * @param projectId - Project identifier
   */
  getSessionId(projectId: string): string | null {
    const session = this.sessions.get(projectId);
    return session?.sessionId || null;
  }

  /**
   * Check if session exists and is running
   */
  isRunning(projectId: string): boolean {
    const session = this.sessions.get(projectId);
    return session?.status === 'running';
  }

  /**
   * Get session info (for validation in handlers)
   * @param projectId - Project identifier
   */
  getSession(projectId: string): ClaudeSession | undefined {
    return this.sessions.get(projectId);
  }

  /**
   * Destroy all Claude sessions (app shutdown)
   */
  destroyAllSessions(): void {
    for (const projectId of this.sessions.keys()) {
      this.destroySession(projectId);
    }
  }

  /**
   * Handle SDK message
   * @private
   */
  private handleMessage(projectId: string, msg: SDKMessage): void {
    // Create event for compatibility with existing handlers
    const event: ClaudeEvent = {
      raw: JSON.stringify(msg),
      type: msg.type,
      isComplete: msg.type === 'result',
      isError: false,
      message: msg,
    };

    // Emit the event for handlers to process
    this.emit('claude-event', { projectId, event });

    // Handle specific message types - minimal logging
    // Most message types are handled silently to reduce console noise
  }

  /**
   * Update session status and emit event
   * @private
   */
  private updateStatus(projectId: string, status: ClaudeStatus): void {
    const session = this.sessions.get(projectId);
    if (session) {
      session.status = status;
      this.emitStatusChange(projectId, status);
    }
  }

  /**
   * Emit status change event
   * @private
   */
  private emitStatusChange(projectId: string, status: ClaudeStatus): void {
    this.emit('claude-status', { projectId, status });
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
}

// Export singleton instance
export const claudeService = new ClaudeService();
