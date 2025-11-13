import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';
import { portService } from './PortService';
import { processPersistence } from './ProcessPersistence';
import path from 'path';
import os from 'os';

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
 * Health check status
 */
export interface HealthCheckStatus {
  healthy: boolean;
  checks: {
    httpResponding: { status: 'pass' | 'fail' | 'pending'; message: string };
    processAlive: { status: 'pass' | 'fail'; message: string };
    portListening: { status: 'pass' | 'fail'; message: string };
  };
  lastChecked: Date;
  consecutiveFailures: number;
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
  healthStatus?: HealthCheckStatus;
}

/**
 * ProcessManager Service
 *
 * Manages the lifecycle of netlify dev processes for projects.
 * Handles spawning, monitoring, restarting, and output streaming.
 */
class ProcessManager extends EventEmitter {
  private processes: Map<string, ProcessInfo> = new Map();
  private pendingStarts: Map<string, Promise<number>> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private currentProjectId: string | null = null; // Track currently active project
  private readonly MAX_OUTPUT_LINES = 500; // Keep last 500 lines
  private readonly MAX_CRASHES = 3;
  private readonly CRASH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly HEALTH_CHECK_TIMEOUT = 5000; // 5 second timeout
  private readonly MAX_HEALTH_FAILURES = 3; // 3 consecutive failures = unhealthy

  /**
   * Start netlify dev server for a project
   * Includes automatic retry on port conflicts
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @returns Port number where server is running
   */
  async startDevServer(projectId: string, projectPath: string): Promise<number> {
    // CRITICAL FIX: Prevent race conditions from multiple simultaneous start calls
    // If already starting, wait for that operation to complete
    const pendingStart = this.pendingStarts.get(projectId);
    if (pendingStart) {
      return pendingStart;
    }

    // Check if already running OR starting
    const existing = this.processes.get(projectId);
    if (existing && (existing.state === ProcessState.RUNNING || existing.state === ProcessState.STARTING)) {
      return existing.port;
    }

    // Create a promise for this start operation
    const startPromise = this.performStart(projectId, projectPath);
    this.pendingStarts.set(projectId, startPromise);

    try {
      const port = await startPromise;
      return port;
    } finally {
      this.pendingStarts.delete(projectId);
    }
  }

  /**
   * Internal method that performs the actual start operation
   * Separated to allow proper promise tracking
   */
  private async performStart(projectId: string, projectPath: string): Promise<number> {
    // Stop existing process if any (crashed or error state)
    const existing = this.processes.get(projectId);
    if (existing) {
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

    // Setup environment with nvm Node path
    const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
    const nvmNodePath = path.join(nvmDir, 'versions', 'node', 'v20.19.5', 'bin');

    // Spawn netlify dev
    const childProcess = spawn('npx', ['netlify', 'dev', '--port', port.toString()], {
      cwd: projectPath,
      shell: true,
      env: {
        ...process.env,
        PATH: `${nvmNodePath}:${process.env.PATH}`,
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
   * @param force - If true, bypasses the active project check (used for deletion)
   */
  async stopDevServer(projectId: string, force: boolean = false): Promise<void> {
    // Guard: Never stop the currently active project's server (unless forced)
    if (!force && this.currentProjectId === projectId) {
      console.warn('⚠️  Prevented stopping server for active project:', projectId);
      return;
    }

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

        // Stop health check when process stops
        this.stopHealthCheck(projectId);

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

            // Start periodic health check now that server is confirmed running
            this.startHealthCheck(projectId, port);
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

  /**
   * Start periodic health check for a running project
   * @param projectId - Project identifier
   * @param port - Port number to check
   */
  private startHealthCheck(projectId: string, port: number): void {
    // Stop any existing health check for this project
    this.stopHealthCheck(projectId);

    // Initialize health status
    const processInfo = this.processes.get(projectId);
    if (!processInfo) return;

    processInfo.healthStatus = {
      healthy: true,
      checks: {
        httpResponding: { status: 'pass', message: 'Server responding' },
        processAlive: { status: 'pass', message: 'Process running' },
        portListening: { status: 'pass', message: 'Port listening' },
      },
      lastChecked: new Date(),
      consecutiveFailures: 0,
    };

    // Emit initial health status
    this.emit('process-health-changed', projectId, processInfo.healthStatus);

    // Start periodic check
    const interval = setInterval(async () => {
      await this.performHealthCheck(projectId, port);
    }, this.HEALTH_CHECK_INTERVAL);

    this.healthCheckIntervals.set(projectId, interval);
  }

  /**
   * Stop health check for a project
   * @param projectId - Project identifier
   */
  private stopHealthCheck(projectId: string): void {
    const interval = this.healthCheckIntervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(projectId);
    }
  }

  /**
   * Perform a single health check
   * @param projectId - Project identifier
   * @param port - Port number to check
   */
  private async performHealthCheck(projectId: string, port: number): Promise<void> {
    const processInfo = this.processes.get(projectId);
    if (!processInfo || !processInfo.healthStatus) return;

    const checks = processInfo.healthStatus.checks;
    let allHealthy = true;

    // Check 1: Process still alive
    try {
      if (processInfo.process && !processInfo.process.killed) {
        // Try to check if process is still alive (sending signal 0 doesn't kill it)
        process.kill(processInfo.process.pid!, 0);
        checks.processAlive = { status: 'pass', message: 'Process running' };
      } else {
        checks.processAlive = { status: 'fail', message: 'Process not running' };
        allHealthy = false;
      }
    } catch (error) {
      checks.processAlive = { status: 'fail', message: 'Process terminated' };
      allHealthy = false;
    }

    // Check 2: Port listening (simple TCP check would go here, but HTTP check covers this)
    checks.portListening = { status: 'pass', message: `Port ${port} allocated` };

    // Check 3: HTTP responding
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);

      const response = await fetch(`http://localhost:${port}`, {
        signal: controller.signal,
        method: 'HEAD', // Lightweight request
      });

      clearTimeout(timeoutId);

      if (response) {
        checks.httpResponding = { status: 'pass', message: `Server responding (${response.status})` };
      } else {
        checks.httpResponding = { status: 'fail', message: 'No response from server' };
        allHealthy = false;
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        checks.httpResponding = { status: 'fail', message: 'Request timeout (5s)' };
      } else {
        checks.httpResponding = { status: 'fail', message: `Connection failed: ${error.message}` };
      }
      allHealthy = false;
    }

    // Update health status
    processInfo.healthStatus.lastChecked = new Date();

    if (!allHealthy) {
      processInfo.healthStatus.consecutiveFailures++;

      // After MAX_HEALTH_FAILURES consecutive failures, mark as unhealthy
      if (processInfo.healthStatus.consecutiveFailures >= this.MAX_HEALTH_FAILURES) {
        processInfo.healthStatus.healthy = false;

        // Emit error and transition to ERROR state
        this.emit('process-health-critical', projectId, processInfo.healthStatus);
        processInfo.state = ProcessState.ERROR;
        this.emit('process-status-changed', projectId, ProcessState.ERROR);

        // Stop health check since we're in ERROR state
        this.stopHealthCheck(projectId);
      }
    } else {
      // Reset failure count on success
      processInfo.healthStatus.consecutiveFailures = 0;
      processInfo.healthStatus.healthy = true;
    }

    // Emit health status update
    this.emit('process-health-changed', projectId, processInfo.healthStatus);
  }

  /**
   * Get current health status for a project
   * @param projectId - Project identifier
   * @returns Health status or undefined if not available
   */
  getHealthStatus(projectId: string): HealthCheckStatus | undefined {
    const processInfo = this.processes.get(projectId);
    return processInfo?.healthStatus;
  }

  /**
   * Manually trigger a health check for a project
   * @param projectId - Project identifier
   */
  async triggerHealthCheck(projectId: string): Promise<HealthCheckStatus | undefined> {
    const processInfo = this.processes.get(projectId);
    if (!processInfo || processInfo.state !== ProcessState.RUNNING) {
      return undefined;
    }

    await this.performHealthCheck(projectId, processInfo.port);
    return processInfo.healthStatus;
  }

  /**
   * Set the currently active project
   * Used to prevent accidental stopping of the active project's server
   * @param projectId - The project ID that is now active (or null if none)
   */
  setCurrentProject(projectId: string | null): void {
    this.currentProjectId = projectId;
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
