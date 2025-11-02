import { EventEmitter } from 'events';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

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
 * Claude session info
 */
interface ClaudeSession {
  projectPath: string;
  sessionId: string | null; // Claude session ID for resume
  status: ClaudeStatus;
  abortController: AbortController | null; // For cancellation
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
   */
  async startSession(projectId: string, projectPath: string, prompt: string): Promise<void> {
    const existingSession = this.sessions.get(projectId);

    // If session exists and is still running, abort it first
    if (existingSession && (existingSession.status === 'starting' || existingSession.status === 'running')) {
      console.log(`🔄 Aborting existing Claude session before starting new one: ${projectId}`);
      existingSession.abortController?.abort();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`🤖 Starting Claude Code session for project: ${projectId}`);
    console.log(`📁 Working directory: ${projectPath}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Get session ID from previous session (if exists) for resume
    // BUT: Only resume if the working directory matches!
    let sessionId: string | null = null;
    if (existingSession?.sessionId) {
      if (existingSession.projectPath === projectPath) {
        sessionId = existingSession.sessionId;
        console.log(`🔄 Resuming previous session: ${sessionId}`);
      } else {
        console.log(`⚠️ Working directory changed (${existingSession.projectPath} → ${projectPath}), starting fresh session`);
        sessionId = null;
      }
    }

    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Create or update session object
    const session: ClaudeSession = {
      projectPath,
      sessionId,
      status: 'starting',
      abortController,
    };

    this.sessions.set(projectId, session);

    // Emit status change
    this.emitStatusChange(projectId, 'starting');

    // Build SDK options
    const options = {
      cwd: projectPath, // Current working directory - this is the correct option name
      dataDir: `${projectPath}/.claude-data`, // Isolated data directory per project (prevents session conflicts)
      permissionMode: 'bypassPermissions' as const, // Equivalent to --dangerously-skip-permissions
      maxTurns: 10,
      settingSources: ['user', 'project', 'local'] as const, // Load .claude/CLAUDE.md
      signal: abortController.signal,
      pathToClaudeCodeExecutable: this.getClaudeExecutablePath(), // Path to claude CLI
      ...(sessionId && { resume: sessionId }), // Resume if we have session ID
    };

    try {
      // Update status to running
      this.updateStatus(projectId, 'running');

      console.log(`🚀 Starting SDK query for ${projectId}`);
      console.log(`🔍 SDK Options:`, JSON.stringify({
        cwd: options.cwd,
        dataDir: options.dataDir,
        resume: sessionId || 'none',
        pathToClaudeCodeExecutable: options.pathToClaudeCodeExecutable
      }, null, 2));

      // Extra verification - check if dataDir exists
      if (!existsSync(options.dataDir)) {
        console.log(`📁 DataDir will be created: ${options.dataDir}`);
      } else {
        console.log(`📁 DataDir already exists: ${options.dataDir}`);
      }

      // Execute query with async generator
      for await (const msg of query({ prompt, options })) {
        // Save session ID for future resumption
        if (msg.session_id) {
          const currentSession = this.sessions.get(projectId);
          if (currentSession && currentSession.sessionId !== msg.session_id) {
            currentSession.sessionId = msg.session_id;
            console.log(`💾 Saved Claude session ID: ${msg.session_id}`);
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
        console.log(`⏹️ Claude session aborted for ${projectId}`);
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
   */
  async sendPrompt(projectId: string, projectPath: string, prompt: string): Promise<void> {
    console.log(`📝 Sending prompt to Claude [${projectId}]: ${prompt.substring(0, 100)}...`);

    // Use startSession which handles resume automatically
    await this.startSession(projectId, projectPath, prompt);
  }

  /**
   * Clear session and start fresh (removes session ID)
   * @param projectId - Project identifier
   */
  clearSession(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (session) {
      console.log(`🗑️ Clearing Claude session for project: ${projectId}`);
      session.sessionId = null; // Remove session ID so next start won't resume
      session.abortController?.abort();
      this.sessions.delete(projectId);
      this.emitStatusChange(projectId, 'idle');
    }
  }

  /**
   * Destroy Claude session (abort current operation)
   * @param projectId - Project identifier
   */
  destroySession(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    console.log(`🗑️ Destroying Claude session for project: ${projectId}`);

    try {
      session.abortController?.abort();
    } catch (error) {
      console.error(`❌ Error aborting Claude session for ${projectId}:`, error);
    }

    this.sessions.delete(projectId);
    this.emitStatusChange(projectId, 'idle');
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
   * Destroy all Claude sessions (app shutdown)
   */
  destroyAllSessions(): void {
    console.log(`🗑️ Destroying all Claude sessions (${this.sessions.size} active)`);

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

    // Handle specific message types with better logging
    switch (msg.type) {
      case 'assistant':
        // Assistant response - main content from Claude
        // Extract and log the actual text
        if (msg.message?.content) {
          const content = msg.message.content;
          if (Array.isArray(content)) {
            const textParts = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text);
            if (textParts.length > 0) {
              console.log(`💬 [${projectId}] Claude says:`, textParts.join('\n'));
            }
          }
        }
        break;

      case 'partial':
        // Streaming chunk - skip logging to reduce noise
        break;

      case 'result':
        // Final result
        console.log(`🎯 [${projectId}] Task completed`);
        if (msg.message?.content) {
          console.log(`📋 Result:`, JSON.stringify(msg.message.content, null, 2));
        }
        break;

      case 'system':
        // System message
        console.log(`⚙️ [${projectId}] System:`, msg.message);
        break;

      case 'user':
      case 'user_message_replay':
        // User messages - skip to reduce noise
        break;

      default:
        console.log(`❓ [${projectId}] Unknown message type: ${msg.type}`);
    }
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
    console.log(`📊 Claude status changed for ${projectId}: ${status}`);
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
        console.log(`📍 Found Claude executable at: ${path}`);
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
          console.log(`📍 Found Claude executable at: ${path}`);
          return path;
        }
      } catch (error) {
        // Continue checking
      }
    }

    // Default to 'claude' and hope it's in PATH
    console.warn('⚠️ Claude executable not found in common paths, using "claude" from PATH');
    return 'claude';
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();
