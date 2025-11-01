import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';
import { portService } from './PortService';
import path from 'path';

/**
 * Process state enum
 */
export enum ProcessState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  CRASHED = 'crashed',
  ERROR = 'error',
}

/**
 * Process output line interface
 */
export interface ProcessOutput {
  timestamp: Date;
  type: 'stdout' | 'stderr';
  message: string;
  raw: string; // With ANSI colors
}

/**
 * Process info interface
 */
interface ProcessInfo {
  process: ChildProcess;
  state: ProcessState;
  port: number;
  output: ProcessOutput[];
  crashCount: number;
  lastCrashTime?: Date;
}

/**
 * ProcessManager Service
 *
 * Manages the lifecycle of netlify dev processes for projects.
 * Handles spawning, monitoring, restarting, and output streaming.
 */
class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();
  private readonly MAX_OUTPUT_LINES = 500; // Keep last 500 lines
  private readonly MAX_CRASHES = 3;
  private readonly CRASH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Start netlify dev server for a project
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @returns Port number where server is running
   */
  async startDevServer(projectId: string, projectPath: string): Promise<number> {
    // Check if already running
    const existing = this.processes.get(projectId);
    if (existing && existing.state === ProcessState.RUNNING) {
      return existing.port;
    }

    // Stop existing process if any
    if (existing) {
      await this.stopDevServer(projectId);
    }

    // Find available port
    const port = await portService.findAvailablePort(projectId);

    // Create process info
    const processInfo: ProcessInfo = {
      process: null as any, // Will be set below
      state: ProcessState.STARTING,
      port,
      output: [],
      crashCount: 0,
    };

    this.processes.set(projectId, processInfo);
    this.emit('process-status-changed', projectId, ProcessState.STARTING);

    try {
      // Spawn netlify dev
      console.log(`📡 Spawning netlify dev in: ${projectPath}`);
      console.log(`📡 Command: npx netlify dev --port ${port}`);

      const childProcess = spawn('npx', ['netlify', 'dev', '--port', port.toString()], {
        cwd: projectPath,
        shell: true,
        env: {
          ...process.env,
          FORCE_COLOR: '1', // Preserve ANSI colors
          NODE_ENV: 'development',
          BROWSER: 'none', // Prevent react-scripts from opening browser
        },
      });

      console.log(`📡 Process spawned with PID: ${childProcess.pid}`);
      processInfo.process = childProcess;

      // Handle stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const message = data.toString();
        console.log(`📤 STDOUT: ${message.substring(0, 100)}...`);
        this.handleOutput(projectId, 'stdout', message);
      });

      // Handle stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const message = data.toString();
        console.log(`📤 STDERR: ${message.substring(0, 100)}...`);
        this.handleOutput(projectId, 'stderr', message);
      });

      // Handle process exit
      childProcess.on('exit', (code, signal) => {
        console.log(`🚪 Process exited with code: ${code}, signal: ${signal}`);
        this.handleProcessExit(projectId, code, signal);
      });

      // Handle process error
      childProcess.on('error', (error) => {
        console.log(`❌ Process error: ${error.message}`);
        this.handleProcessError(projectId, error);
      });

      return port;
    } catch (error) {
      processInfo.state = ProcessState.ERROR;
      this.emit('process-status-changed', projectId, ProcessState.ERROR);
      this.emit('process-error', projectId, error);
      throw error;
    }
  }

  /**
   * Stop netlify dev server for a project
   * @param projectId - Unique project identifier
   */
  async stopDevServer(projectId: string): Promise<void> {
    const processInfo = this.processes.get(projectId);
    if (!processInfo || processInfo.state === ProcessState.STOPPED) {
      return;
    }

    processInfo.state = ProcessState.STOPPING;
    this.emit('process-status-changed', projectId, ProcessState.STOPPING);

    return new Promise((resolve) => {
      const childProcess = processInfo.process;

      // Set a timeout for graceful shutdown
      const killTimeout = setTimeout(() => {
        if (childProcess && !childProcess.killed) {
          childProcess.kill('SIGKILL'); // Force kill
        }
      }, 5000);

      childProcess.once('exit', () => {
        clearTimeout(killTimeout);
        processInfo.state = ProcessState.STOPPED;
        this.emit('process-status-changed', projectId, ProcessState.STOPPED);
        portService.releasePort(projectId);
        this.processes.delete(projectId);
        resolve();
      });

      // Try graceful shutdown first
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM');
      } else {
        resolve();
      }
    });
  }

  /**
   * Restart dev server
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   */
  async restartDevServer(projectId: string, projectPath: string): Promise<number> {
    await this.stopDevServer(projectId);
    // Wait a bit before restarting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.startDevServer(projectId, projectPath);
  }

  /**
   * Get current process status
   * @param projectId - Unique project identifier
   */
  getProcessStatus(projectId: string): ProcessState {
    const processInfo = this.processes.get(projectId);
    return processInfo ? processInfo.state : ProcessState.STOPPED;
  }

  /**
   * Get process output (last N lines)
   * @param projectId - Unique project identifier
   * @param limit - Number of lines to return (default: all)
   */
  getProcessOutput(projectId: string, limit?: number): ProcessOutput[] {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) {
      return [];
    }

    const output = processInfo.output;
    if (limit && limit < output.length) {
      return output.slice(-limit);
    }
    return output;
  }

  /**
   * Get assigned port for a project
   * @param projectId - Unique project identifier
   */
  getPort(projectId: string): number | undefined {
    const processInfo = this.processes.get(projectId);
    return processInfo?.port;
  }

  /**
   * Stop all processes (on app quit)
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processes.keys()).map((projectId) =>
      this.stopDevServer(projectId)
    );

    await Promise.all(stopPromises);
    portService.releaseAllPorts();
  }

  /**
   * Handle process output
   */
  private handleOutput(projectId: string, type: 'stdout' | 'stderr', message: string): void {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    // Create output entry
    const outputLine: ProcessOutput = {
      timestamp: new Date(),
      type,
      message: stripAnsi(message), // Plain text for parsing
      raw: message, // With colors for display
    };

    // Add to output buffer
    processInfo.output.push(outputLine);

    // Limit buffer size
    if (processInfo.output.length > this.MAX_OUTPUT_LINES) {
      processInfo.output = processInfo.output.slice(-this.MAX_OUTPUT_LINES);
    }

    // Emit to renderer
    this.emit('process-output', projectId, outputLine);

    // Check if server is ready
    if (processInfo.state === ProcessState.STARTING) {
      this.checkIfServerReady(projectId, outputLine.message);
    }

    // Check for errors
    this.detectErrors(projectId, outputLine.message);
  }

  /**
   * Check if server is ready by parsing output
   */
  private checkIfServerReady(projectId: string, message: string): void {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    // Netlify dev ready patterns - looking for the main Netlify Dev server (port 8888)
    const readyPatterns = [
      /Local dev server ready:/i,           // Netlify Dev main message
      /Server now ready on/i,
      /◈ Server now ready/i,
    ];

    const isReady = readyPatterns.some((pattern) => pattern.test(message));

    if (isReady) {
      processInfo.state = ProcessState.RUNNING;
      this.emit('process-status-changed', projectId, ProcessState.RUNNING);
      this.emit('process-ready', projectId, processInfo.port);
    }
  }

  /**
   * Detect critical errors in output
   * Only emit critical errors that require user attention
   */
  private detectErrors(projectId: string, message: string): void {
    // Only emit critical infrastructure errors, not template/build errors
    const criticalErrorPatterns = [
      /EADDRINUSE/i,        // Port already in use
      /ECONNREFUSED/i,      // Connection refused
      /EACCES/i,            // Permission denied
      /Command failed/i,    // Command execution failed
    ];

    const hasCriticalError = criticalErrorPatterns.some((pattern) => pattern.test(message));

    if (hasCriticalError) {
      this.emit('process-error', projectId, message);
    }

    // Template errors (build failures, missing modules) are only logged to output
    // They don't trigger process-error events
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(projectId: string, code: number | null, signal: string | null): void {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    // Normal exit (user stopped)
    if (processInfo.state === ProcessState.STOPPING) {
      processInfo.state = ProcessState.STOPPED;
      this.emit('process-status-changed', projectId, ProcessState.STOPPED);
      portService.releasePort(projectId);
      this.processes.delete(projectId);
      return;
    }

    // Crash (unexpected exit)
    processInfo.state = ProcessState.CRASHED;
    this.emit('process-status-changed', projectId, ProcessState.CRASHED);

    // Track crashes
    const now = new Date();
    if (
      processInfo.lastCrashTime &&
      now.getTime() - processInfo.lastCrashTime.getTime() < this.CRASH_WINDOW_MS
    ) {
      processInfo.crashCount++;
    } else {
      processInfo.crashCount = 1;
    }
    processInfo.lastCrashTime = now;

    // Emit crash event
    this.emit('process-crashed', projectId, {
      code,
      signal,
      crashCount: processInfo.crashCount,
    });

    // Too many crashes
    if (processInfo.crashCount >= this.MAX_CRASHES) {
      this.emit('process-error', projectId, 'Process crashed too many times. Please check logs.');
      portService.releasePort(projectId);
      this.processes.delete(projectId);
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(projectId: string, error: Error): void {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    processInfo.state = ProcessState.ERROR;
    this.emit('process-status-changed', projectId, ProcessState.ERROR);
    this.emit('process-error', projectId, error.message);
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
