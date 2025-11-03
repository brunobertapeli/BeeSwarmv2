import { EventEmitter } from 'events';
import { ProcessOutput } from './ProcessManager';
import { TerminalOutput } from './TerminalService';

/**
 * Terminal line source type
 */
export type TerminalSource = 'dev-server' | 'shell' | 'npm' | 'git' | 'claude' | 'user' | 'system';

/**
 * Unified terminal line interface
 */
export interface TerminalLine {
  timestamp: Date;
  source: TerminalSource;
  type: 'stdout' | 'stderr';
  message: string;
  raw?: string; // Original with ANSI colors (if available)
}

/**
 * Project terminal buffer
 */
interface ProjectBuffer {
  lines: TerminalLine[];
}

/**
 * TerminalAggregator Service
 *
 * Combines output from multiple sources into a single unified terminal stream:
 * - ProcessManager (dev server logs)
 * - TerminalService (user shell commands)
 * - npm/git operations
 * - Claude Code iterations (future)
 *
 * Maintains chronological order and emits unified stream to renderer.
 */
class TerminalAggregator extends EventEmitter {
  private buffers: Map<string, ProjectBuffer> = new Map();
  private readonly MAX_LINES = 1000; // Keep last 1000 lines per project

  /**
   * Add a line from the dev server (ProcessManager)
   */
  addDevServerLine(projectId: string, output: ProcessOutput): void {
    const line: TerminalLine = {
      timestamp: output.timestamp,
      source: 'dev-server',
      type: output.type,
      message: output.message,
      raw: output.raw,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a line from the user shell (TerminalService)
   */
  addShellLine(projectId: string, output: TerminalOutput): void {
    const line: TerminalLine = {
      timestamp: output.timestamp,
      source: 'shell',
      type: output.type,
      message: output.message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a line from npm operations
   */
  addNpmLine(projectId: string, message: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    const line: TerminalLine = {
      timestamp: new Date(),
      source: 'npm',
      type,
      message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a line from git operations
   */
  addGitLine(projectId: string, message: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    const line: TerminalLine = {
      timestamp: new Date(),
      source: 'git',
      type,
      message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a line from Claude Code
   */
  addClaudeLine(projectId: string, message: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    const line: TerminalLine = {
      timestamp: new Date(),
      source: 'claude',
      type,
      message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a line from user (user prompts/messages)
   */
  addUserLine(projectId: string, message: string, type: 'stdout' | 'stderr' = 'stdout'): void {
    const line: TerminalLine = {
      timestamp: new Date(),
      source: 'user',
      type,
      message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Add a system message (info, warnings, etc.)
   */
  addSystemLine(projectId: string, message: string): void {
    const line: TerminalLine = {
      timestamp: new Date(),
      source: 'system',
      type: 'stdout',
      message,
    };

    this.addLine(projectId, line);
  }

  /**
   * Get all lines for a project
   */
  getLines(projectId: string, limit?: number): TerminalLine[] {
    const buffer = this.getOrCreateBuffer(projectId);

    if (limit) {
      return buffer.lines.slice(-limit);
    }

    return [...buffer.lines];
  }

  /**
   * Clear terminal buffer for a project
   */
  clearBuffer(projectId: string): void {
    const buffer = this.buffers.get(projectId);
    if (!buffer) {
      return;
    }

    buffer.lines = [];
    this.emit('terminal-cleared', { projectId });
  }

  /**
   * Delete buffer for a project (when project closes)
   */
  deleteBuffer(projectId: string): void {
    this.buffers.delete(projectId);
  }

  /**
   * Check if buffer exists for project
   */
  hasBuffer(projectId: string): boolean {
    return this.buffers.has(projectId);
  }

  /**
   * Get buffer size
   */
  getBufferSize(projectId: string): number {
    const buffer = this.buffers.get(projectId);
    return buffer ? buffer.lines.length : 0;
  }

  /**
   * Add a line to the buffer and emit event
   * @private
   */
  private addLine(projectId: string, line: TerminalLine): void {
    const buffer = this.getOrCreateBuffer(projectId);

    // Add line to buffer
    buffer.lines.push(line);

    // Trim buffer if too large
    if (buffer.lines.length > this.MAX_LINES) {
      buffer.lines = buffer.lines.slice(-this.MAX_LINES);
    }

    // Emit event to renderer
    this.emit('terminal-line', { projectId, line });
  }

  /**
   * Get or create buffer for project
   * @private
   */
  private getOrCreateBuffer(projectId: string): ProjectBuffer {
    let buffer = this.buffers.get(projectId);

    if (!buffer) {
      buffer = { lines: [] };
      this.buffers.set(projectId, buffer);
    }

    return buffer;
  }

  /**
   * Format source tag for display
   */
  static formatSourceTag(source: TerminalSource): string {
    const tags: Record<TerminalSource, string> = {
      'dev-server': '[Dev Server]',
      'shell': '[Shell]',
      'npm': '[NPM]',
      'git': '[Git]',
      'claude': '[Claude]',
      'user': '[User]',
      'system': '[System]',
    };

    return tags[source] || `[${source}]`;
  }

  /**
   * Get ANSI color code for source type
   */
  static getSourceColor(source: TerminalSource): string {
    const colors: Record<TerminalSource, string> = {
      'dev-server': '\x1b[36m', // Cyan
      'shell': '\x1b[32m',      // Green
      'npm': '\x1b[33m',        // Yellow
      'git': '\x1b[35m',        // Magenta
      'claude': '\x1b[38;5;130m', // Brownish (Claude brand color)
      'user': '\x1b[38;5;141m',   // Purple
      'system': '\x1b[90m',     // Gray
    };

    return colors[source] || '\x1b[37m'; // White fallback
  }
}

// Export singleton instance
export const terminalAggregator = new TerminalAggregator();
