import { EventEmitter } from 'events';
import { query, type SDKMessage, type Query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { databaseService } from './DatabaseService';

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

  /**
   * Start or resume Claude Code session for a project
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @param prompt - Prompt to send
   * @param model - Optional model to use (defaults to claude-sonnet-4-5)
   * @param attachments - Optional file/image attachments
   */
  async startSession(projectId: string, projectPath: string, prompt: string, model?: string, attachments?: ClaudeAttachment[]): Promise<void> {
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

    console.log('🔍 DEBUG - Model selection:');
    console.log('  - Explicit model param:', model);
    console.log('  - Existing session model:', existingSession?.context?.model);
    console.log('  - Effective model:', effectiveModel);

    console.log(`🤖 Starting Claude Code session for project: ${projectId}`);
    console.log(`📁 Working directory: ${projectPath}`);
    console.log(`🎯 Model: ${effectiveModel}${!model && existingSession?.context?.model ? ' (from preference)' : model ? '' : ' (default)'}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

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
        console.log(`📦 Resuming Claude session from database: ${savedSessionId}`);
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
        console.log(`📦 Resuming Claude session from memory: ${sessionId}`);
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

    // Build SDK options
    const options = {
      cwd: projectPath, // Current working directory
      permissionMode: 'bypassPermissions' as const, // Bypass all permission prompts
      maxTurns: 10,
      signal: abortController.signal,
      pathToClaudeCodeExecutable: this.getClaudeExecutablePath(), // Path to claude CLI
      model: effectiveModel, // Always set model
      ...(sessionId && { resume: sessionId }), // Resume if we have session ID
    };

    console.log('🔍 DEBUG - SDK Options:', JSON.stringify(options, null, 2));
    console.log('🔍 DEBUG - Model being sent to SDK:', effectiveModel);

    try {
      // Update status to running
      this.updateStatus(projectId, 'running');

      // Build prompt - either simple string or rich content with attachments
      let queryPrompt: string | AsyncIterable<SDKUserMessage>;

      if (attachments && attachments.length > 0) {
        console.log(`📎 [CLAUDE SERVICE] Processing ${attachments.length} attachment(s)`);

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
            console.log(`🖼️ [CLAUDE SERVICE] Added image to content array:`, {
              name: attachment.name || 'unnamed',
              mediaType: attachment.mediaType,
              dataLength: attachment.data.length,
              dataPreview: attachment.data.substring(0, 50) + '...'
            });
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
            console.log(`📄 [CLAUDE SERVICE] Added document to content array:`, {
              name: attachment.name || 'unnamed',
              mediaType: attachment.mediaType,
              dataLength: attachment.data.length
            });
          }
        }

        // Add text prompt
        content.push({
          type: 'text',
          text: prompt
        });

        console.log(`📎 [CLAUDE SERVICE] Final content array:`, {
          totalItems: content.length,
          types: content.map(c => c.type)
        });

        // Create async iterator with single message
        queryPrompt = (async function*() {
          const userMessage = {
            type: 'user' as const,
            message: {
              role: 'user' as const,
              content: content
            },
            parent_tool_use_id: null
          } as SDKUserMessage;

          console.log('📎 [CLAUDE SERVICE] Yielding user message with attachments (base64 data suppressed for readability)');
          yield userMessage;
        })();
      } else {
        // Simple string prompt (backward compatibility)
        queryPrompt = prompt;
      }

      // Execute query with async generator and store Query object
      const claudeQuery = query({ prompt: queryPrompt, options });

      // Store query object in session for control methods
      const currentSession = this.sessions.get(projectId);
      if (currentSession) {
        currentSession.query = claudeQuery;
      }

      // If resuming and model changed, use setModel() to preserve context
      if (sessionId && existingSession?.context?.model && existingSession.context.model !== effectiveModel) {
        console.log(`🔄 Model change detected: ${existingSession.context.model} → ${effectiveModel}`);
        try {
          console.log('🔄 Attempting to change model via setModel()...');
          await claudeQuery.setModel(effectiveModel);
          console.log('✅ Model changed successfully');
        } catch (error) {
          console.error(`❌ Failed to change model:`, error);
        }
      }

      for await (const msg of claudeQuery) {
        console.log('🔍 DEBUG - Received message type:', msg.type, 'subtype:', msg.subtype);

        // Save session ID for future resumption (both memory and database)
        if (msg.session_id) {
          const session = this.sessions.get(projectId);
          if (session && session.sessionId !== msg.session_id) {
            session.sessionId = msg.session_id;
            console.log(`💾 Saved Claude session ID: ${msg.session_id}`);
            // Persist to database for cross-restart resume
            databaseService.saveClaudeSessionId(projectId, msg.session_id);
          }
        }

        // Update context from system init message
        if (msg.type === 'system' && msg.subtype === 'init') {
          console.log('🔍 DEBUG - System init message received:', JSON.stringify(msg, null, 2));
          console.log('🔍 DEBUG - Model from init message:', msg.model);
          const session = this.sessions.get(projectId);
          if (session) {
            session.context.model = msg.model || session.context.model;
            console.log('🔍 DEBUG - Updated session context model:', session.context.model);
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

            // Update context window from modelUsage
            if (msg.modelUsage) {
              const modelEntries = Object.entries(msg.modelUsage);
              if (modelEntries.length > 0) {
                const [, modelData] = modelEntries[0];
                session.context.contextWindow = (modelData as any).contextWindow || session.context.contextWindow;
              }
            }

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
          console.log(`✅ Claude session completed for ${projectId}`);
          this.updateStatus(projectId, 'completed');
          this.emit('claude-complete', { projectId });
          break;
        }
      }

      console.log(`✅ Claude Code session finished for ${projectId}`);
    } catch (error: any) {
      console.error(`❌ Claude session error for ${projectId}:`, error);

      // Check if it was aborted
      if (error.name === 'AbortError') {
        this.updateStatus(projectId, 'idle');
      } else {
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
   */
  async sendPrompt(projectId: string, projectPath: string, prompt: string, model?: string, attachments?: ClaudeAttachment[]): Promise<void> {
    console.log(`📝 Sending prompt to Claude [${projectId}]: ${prompt.substring(0, 100)}...`);

    // Use startSession which handles resume automatically
    await this.startSession(projectId, projectPath, prompt, model, attachments);
  }

  /**
   * Clear session and start fresh (removes session ID and resets context to baseline)
   * @param projectId - Project identifier
   */
  clearSession(projectId: string): void {
    console.log(`🗑️ Clearing Claude session for project: ${projectId}`);

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
    console.log(`🗑️ Clearing session ID from database for ${projectId}`);
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

    // If no session or session is idle/completed, just update the context
    // The new model will be used on the next message
    if (!session || !session.query || session.status === 'idle' || session.status === 'completed') {
      if (session) {
        session.context.model = modelName;
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
      return;
    }

    // Session is active (running), use setModel()
    try {
      await session.query.setModel(modelName);
      session.context.model = modelName;
      this.emit('claude-model-changed', { projectId, model: modelName });
      this.emit('claude-context-updated', { projectId, context: session.context });
    } catch (error) {
      console.error(`❌ Failed to change model:`, error);
      throw error;
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
   * @param projectId - Project identifier
   */
  interrupt(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      console.log(`⚠️ No active session to interrupt for ${projectId}`);
      return;
    }

    console.log(`🛑 Interrupting Claude generation for ${projectId}`);

    try {
      // Use SDK's interrupt method if available on query object
      if (session.query && typeof (session.query as any).interrupt === 'function') {
        (session.query as any).interrupt();
        console.log(`✅ Called query.interrupt() for ${projectId}`);
      }

      // Also abort via AbortController as fallback
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
