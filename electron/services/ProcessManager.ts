import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';
import { portService } from './PortService';
import { processPersistence } from './ProcessPersistence';
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
   * Includes automatic retry on port conflicts
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @returns Port number where server is running
   */
  async startDevServer(projectId: string, projectPath: string): Promise<number> {
    // CRITICAL FIX: Check if already running OR starting
    // Prevents race condition where rapid clicks trigger multiple starts
    const existing = this.processes.get(projectId);
    if (existing && (existing.state === ProcessState.RUNNING || existing.state === ProcessState.STARTING)) {
      console.log(`⚠️ Dev server for ${projectId} is already ${existing.state}, returning existing port`);
      return existing.port;
    }

    // Stop existing process if any (crashed or error state)
    if (existing) {
      console.log(`🔄 Cleaning up previous dev server (state: ${existing.state})`);
      await this.stopDevServer(projectId);
    }

    // Retry logic for port conflicts
    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const port = await this.attemptStartServer(projectId, projectPath);

        // Wait briefly to detect immediate failures (like EADDRINUSE)
        await this.waitForStartOrError(projectId, 3000);

        const processInfo = this.processes.get(projectId);
        if (!processInfo) {
          throw new Error('Process info lost during startup');
        }

        // Check if we hit a port conflict
        if (processInfo.state === ProcessState.ERROR) {
          const hasPortError = processInfo.output.some(line =>
            /EADDRINUSE/.test(line.message)
          );

          if (hasPortError && attempt < maxAttempts) {
            portService.releasePort(projectId);
            this.processes.delete(projectId);
            await new Promise(resolve => setTimeout(resolve, 500));
            continue; // Retry with new port
          }

          throw new Error('Failed to start server');
        }

        console.log(`✅ Server start initiated successfully on port ${port}`);
        return port;
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          portService.releasePort(projectId);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // All attempts failed
    const errorMessage = `Failed to start server after ${maxAttempts} attempts. ${lastError?.message || 'Unknown error'}`;
    this.emit('process-error', projectId, errorMessage);
    throw new Error(errorMessage);
  }

  /**
   * Internal method to attempt starting the server once
   * @returns Port number where server was started
   */
  private async attemptStartServer(projectId: string, projectPath: string): Promise<number> {
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

    // Spawn netlify dev
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

    processInfo.process = childProcess;

    // Save PID to persistence file for orphan cleanup
    if (childProcess.pid) {
      processPersistence.savePID(projectId, childProcess.pid, port);
    }

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.handleOutput(projectId, 'stdout', message);
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.handleOutput(projectId, 'stderr', message);
    });

    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      this.handleProcessExit(projectId, code, signal);
    });

    // Handle process error
    childProcess.on('error', (error) => {
      this.handleProcessError(projectId, error);
    });

    return port;
  }

  /**
   * Wait for server to start or encounter an error
   * Returns early if error detected
   */
  private async waitForStartOrError(projectId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const processInfo = this.processes.get(projectId);

        // Process gone or in error state
        if (!processInfo || processInfo.state === ProcessState.ERROR) {
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Server is running
        if (processInfo.state === ProcessState.RUNNING) {
          clearInterval(checkInterval);
          resolve();
          return;
        }

        // Timeout reached
        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
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
        processPersistence.removePID(projectId);
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
   * When Netlify Dev reports ready, start HTTP health checks
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
      // Don't mark as running yet - start HTTP health check instead
      this.verifyServerWithHttpCheck(projectId, processInfo.port);
    }
  }

  /**
   * Verify server is actually ready by making HTTP requests
   * This is more reliable than text parsing
   */
  private async verifyServerWithHttpCheck(projectId: string, port: number): Promise<void> {
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    const maxAttempts = 30; // 30 seconds total
    const delayMs = 1000; // 1 second between attempts
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        // Check if process still exists
        if (!this.processes.get(projectId)) {
          return;
        }

        // Try to fetch from the server
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`http://localhost:${port}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Any response (even 404) means server is up
        if (response) {
          const currentProcessInfo = this.processes.get(projectId);
          if (currentProcessInfo) {
            currentProcessInfo.state = ProcessState.RUNNING;
            this.emit('process-status-changed', projectId, ProcessState.RUNNING);
            this.emit('process-ready', projectId, port);
          }
          return;
        }
      } catch (error) {
        // Expected during startup - server not ready yet
        attempt++;

        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // Health check failed after all attempts
    const currentProcessInfo = this.processes.get(projectId);
    if (currentProcessInfo) {
      currentProcessInfo.state = ProcessState.ERROR;
      this.emit('process-status-changed', projectId, ProcessState.ERROR);
      this.emit('process-error', projectId, 'Server failed to respond to HTTP requests');
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
      processPersistence.removePID(projectId);
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
      processPersistence.removePID(projectId);
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
