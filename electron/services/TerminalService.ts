import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';

/**
 * Terminal output line interface
 */
export interface TerminalOutput {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
}

/**
 * Terminal session info
 */
interface TerminalSession {
  ptyProcess: pty.IPty;
  projectPath: string;
  output: TerminalOutput[];
  buffer: string; // Buffer for incomplete lines
}

/**
 * TerminalService
 *
 * Manages interactive PTY sessions for user commands.
 * Each project gets its own background shell where users can run commands.
 * Sessions are destroyed when project closes (no persistence).
 */
class TerminalService extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly MAX_OUTPUT_LINES = 1000; // Keep last 1000 lines per session

  /**
   * Create a new terminal session for a project
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root (used as cwd)
   */
  createSession(projectId: string, projectPath: string): void {
    // Close existing session if any
    if (this.sessions.has(projectId)) {
      this.destroySession(projectId);
    }

    console.log(`📟 Creating terminal session for project: ${projectId}`);
    console.log(`📁 Working directory: ${projectPath}`);

    // Determine shell based on platform
    const shell = this.getDefaultShell();
    const shellArgs = this.getShellArgs();

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        FORCE_COLOR: '1', // Force color output
      },
    });

    // Create session object
    const session: TerminalSession = {
      ptyProcess,
      projectPath,
      output: [],
      buffer: '', // Initialize empty buffer
    };

    this.sessions.set(projectId, session);

    // Handle PTY output (both stdout and stderr come through onData)
    ptyProcess.onData((data: string) => {
      this.handleOutput(projectId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`📟 Terminal session exited for ${projectId}: code=${exitCode}, signal=${signal}`);
      this.emit('terminal-exit', { projectId, exitCode, signal });

      // Remove session
      this.sessions.delete(projectId);
    });

    console.log(`✅ Terminal session created for ${projectId}`);
  }

  /**
   * Write input to the terminal (user command)
   * @param projectId - Project identifier
   * @param input - Command string (should include \n for execution)
   */
  writeInput(projectId: string, input: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      console.error(`❌ No terminal session found for project: ${projectId}`);
      return;
    }

    console.log(`📝 Writing to terminal [${projectId}]: ${input.trim()}`);
    session.ptyProcess.write(input);
  }

  /**
   * Resize terminal viewport
   * @param projectId - Project identifier
   * @param cols - Number of columns
   * @param rows - Number of rows
   */
  resize(projectId: string, cols: number, rows: number): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      console.error(`❌ No terminal session found for project: ${projectId}`);
      return;
    }

    session.ptyProcess.resize(cols, rows);
  }

  /**
   * Get terminal output history
   * @param projectId - Project identifier
   * @param limit - Max number of lines to return
   */
  getHistory(projectId: string, limit?: number): TerminalOutput[] {
    const session = this.sessions.get(projectId);
    if (!session) {
      return [];
    }

    if (limit) {
      return session.output.slice(-limit);
    }

    return [...session.output];
  }

  /**
   * Clear terminal output buffer
   * @param projectId - Project identifier
   */
  clearHistory(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    session.output = [];
    this.emit('terminal-cleared', { projectId });
  }

  /**
   * Destroy terminal session
   * @param projectId - Project identifier
   */
  destroySession(projectId: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    console.log(`🗑️ Destroying terminal session for project: ${projectId}`);

    try {
      session.ptyProcess.kill();
    } catch (error) {
      console.error(`❌ Error killing PTY process for ${projectId}:`, error);
    }

    this.sessions.delete(projectId);
  }

  /**
   * Destroy all terminal sessions (app shutdown)
   */
  destroyAllSessions(): void {
    console.log(`🗑️ Destroying all terminal sessions (${this.sessions.size} active)`);

    for (const projectId of this.sessions.keys()) {
      this.destroySession(projectId);
    }
  }

  /**
   * Check if session exists for project
   */
  hasSession(projectId: string): boolean {
    return this.sessions.has(projectId);
  }

  /**
   * Handle output from PTY
   * @private
   */
  private handleOutput(projectId: string, data: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    // Add data to buffer
    session.buffer += data;

    // Split by newlines and process complete lines
    const lines = session.buffer.split('\n');

    // Keep the last incomplete line in the buffer
    session.buffer = lines.pop() || '';

    // Process complete lines
    for (const line of lines) {
      if (line.length === 0) continue; // Skip empty lines

      const output: TerminalOutput = {
        timestamp: new Date(),
        type: 'stdout', // PTY combines stdout/stderr
        message: line + '\n', // Add back the newline
      };

      // Add to history buffer
      session.output.push(output);

      // Trim history buffer if too large
      if (session.output.length > this.MAX_OUTPUT_LINES) {
        session.output = session.output.slice(-this.MAX_OUTPUT_LINES);
      }

      // Emit complete line to renderer
      this.emit('terminal-output', { projectId, output });
    }

    // If buffer gets too large without a newline (e.g., long line or streaming data),
    // flush it anyway to prevent memory issues
    if (session.buffer.length > 10000) {
      const output: TerminalOutput = {
        timestamp: new Date(),
        type: 'stdout',
        message: session.buffer,
      };

      session.output.push(output);
      this.emit('terminal-output', { projectId, output });
      session.buffer = '';
    }
  }

  /**
   * Get default shell for current platform
   * @private
   */
  private getDefaultShell(): string {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: prefer PowerShell, fallback to cmd
      return process.env.SHELL || 'powershell.exe';
    } else {
      // Unix-like: prefer user's shell, fallback to bash
      return process.env.SHELL || '/bin/bash';
    }
  }

  /**
   * Get shell arguments for current platform
   * @private
   */
  private getShellArgs(): string[] {
    const platform = os.platform();

    if (platform === 'win32') {
      // Windows: no special args needed
      return [];
    } else {
      // Unix-like: login shell to load user's profile
      return ['-l'];
    }
  }
}

// Export singleton instance
export const terminalService = new TerminalService();
