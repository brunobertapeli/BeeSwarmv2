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
  lastCommand: string; // Track last command to filter echo
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

  // Interactive terminal sessions (multiple per project)
  private interactiveSessions: Map<string, pty.IPty> = new Map();

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

    // Determine shell based on platform
    const shell = this.getDefaultShell();
    const shellArgs = this.getShellArgs();

    // Spawn PTY process
    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: 'dumb', // Use dumb terminal to avoid special formatting
      cols: 200,    // Wide columns to prevent wrapping
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'dumb',  // Dumb terminal = no fancy features
        PS1: '$ ',     // Simple prompt
        PROMPT: '$ ',  // For some shells
        // Disable Oh My Zsh/Starship/Powerlevel10k themes
        ZSH_THEME: '',
        STARSHIP_CONFIG: '',
        POWERLEVEL9K_DISABLE_CONFIGURATION_WIZARD: 'true',
      },
    });

    // Create session object
    const session: TerminalSession = {
      ptyProcess,
      projectPath,
      output: [],
      buffer: '', // Initialize empty buffer
      lastCommand: '', // Initialize empty last command
    };

    this.sessions.set(projectId, session);

    // Handle PTY output (both stdout and stderr come through onData)
    ptyProcess.onData((data: string) => {
      this.handleOutput(projectId, data);
    });

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('terminal-exit', { projectId, exitCode, signal });

      // Remove session
      this.sessions.delete(projectId);
    });
  }

  /**
   * Write input to the terminal (user command)
   * @param projectId - Project identifier
   * @param input - Command string (should include \n for execution)
   */
  writeInput(projectId: string, input: string): void {
    const session = this.sessions.get(projectId);
    if (!session) {
      return;
    }

    // Store the command (without newline) to filter echo
    session.lastCommand = input.trim();

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

      // Remove ALL ANSI/control sequences comprehensively:
      // 1. CSI sequences: ESC [ ... (letter or special char)
      // 2. OSC sequences: ESC ] ... (terminated by BEL or ST)
      // 3. Other escape sequences
      let cleaned = line
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')  // Standard CSI sequences
        .replace(/\x1b\[[0-9;?]*[hl]/g, '')      // Mode sequences like [?2004h
        .replace(/\x1b\][^\x07]*\x07/g, '')      // OSC sequences ending with BEL
        .replace(/\x1b\][^\x1b]*\x1b\\/g, '')    // OSC sequences ending with ST
        .replace(/\x1b[=>]/g, '')                 // Keypad mode sequences
        .replace(/\x1b\([0B]/g, '')               // Character set sequences
        .replace(/\r/g, '')                       // Carriage returns
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '') // Other control chars (except \n)

      // Trim to check content
      const trimmed = cleaned.trim();

      // Skip if:
      // 1. Empty after cleaning
      // 2. Only prompt characters (%, $, >, #)
      // 3. Lines that look like prompt remnants (% followed by spaces and $, or just % with lots of spaces)
      // 4. Lines that are mostly whitespace with just a few chars at the start/end
      // 5. Line matches the last command sent (command echo)
      if (
        trimmed.length === 0 ||
        /^[%$>#]+$/.test(trimmed) ||
        /^%\s+\$/.test(trimmed) ||
        (trimmed.startsWith('%') && trimmed.length < 5) ||
        (trimmed.startsWith('$') && trimmed.length < 3) ||
        (session.lastCommand && trimmed === session.lastCommand)
      ) {
        continue;
      }

      const output: TerminalOutput = {
        timestamp: new Date(),
        type: 'stdout', // PTY combines stdout/stderr
        message: cleaned + '\n', // Use cleaned version
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
      // Unix-like: -f to prevent loading config files (no .zshrc, .bashrc, etc.)
      // This prevents fancy prompts from Oh My Zsh, Starship, etc.
      return ['-f'];
    }
  }

  /**
   * Create interactive terminal session (for raw terminal tabs)
   * @param projectId - Project identifier
   * @param terminalId - Unique terminal tab identifier
   * @param projectPath - Project directory path
   */
  createInteractiveSession(projectId: string, terminalId: string, projectPath: string): void {
    const sessionKey = `${projectId}:${terminalId}`;

    // Close existing session if any
    if (this.interactiveSessions.has(sessionKey)) {
      this.destroyInteractiveSession(projectId, terminalId);
    }

    const shell = this.getDefaultShell();

    // Spawn PTY with normal shell (not -f flag, so user gets their full environment)
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectPath,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    this.interactiveSessions.set(sessionKey, ptyProcess);

    // Forward output to renderer
    ptyProcess.onData((data: string) => {
      this.emit('interactive-output', { projectId, terminalId, data });
    });

    // Handle exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('interactive-exit', { projectId, terminalId, exitCode, signal });
      this.interactiveSessions.delete(sessionKey);
    });
  }

  /**
   * Write input to interactive terminal
   * @param projectId - Project identifier
   * @param terminalId - Terminal tab identifier
   * @param input - User input
   */
  writeInteractiveInput(projectId: string, terminalId: string, input: string): void {
    const sessionKey = `${projectId}:${terminalId}`;
    const ptyProcess = this.interactiveSessions.get(sessionKey);

    if (!ptyProcess) {
      return;
    }

    ptyProcess.write(input);
  }

  /**
   * Resize interactive terminal
   * @param projectId - Project identifier
   * @param terminalId - Terminal tab identifier
   * @param cols - Number of columns
   * @param rows - Number of rows
   */
  resizeInteractive(projectId: string, terminalId: string, cols: number, rows: number): void {
    const sessionKey = `${projectId}:${terminalId}`;
    const ptyProcess = this.interactiveSessions.get(sessionKey);

    if (!ptyProcess) {
      return;
    }

    ptyProcess.resize(cols, rows);
  }

  /**
   * Destroy interactive terminal session
   * @param projectId - Project identifier
   * @param terminalId - Terminal tab identifier
   */
  destroyInteractiveSession(projectId: string, terminalId: string): void {
    const sessionKey = `${projectId}:${terminalId}`;
    const ptyProcess = this.interactiveSessions.get(sessionKey);

    if (!ptyProcess) {
      return;
    }

    try {
      ptyProcess.kill();
    } catch (error) {
      console.error(`❌ Error killing interactive PTY ${sessionKey}:`, error);
    }

    this.interactiveSessions.delete(sessionKey);
  }

  /**
   * Destroy all interactive sessions for a project
   * @param projectId - Project identifier
   */
  destroyAllInteractiveSessions(projectId: string): void {
    const keysToDelete: string[] = [];

    this.interactiveSessions.forEach((_, key) => {
      if (key.startsWith(`${projectId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      const [, terminalId] = key.split(':');
      this.destroyInteractiveSession(projectId, terminalId);
    });
  }
}

// Export singleton instance
export const terminalService = new TerminalService();
