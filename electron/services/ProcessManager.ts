import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import stripAnsi from 'strip-ansi';
import { processPersistence } from './ProcessPersistence';
import path from 'path';
import fs from 'fs';
import { app, safeStorage } from 'electron';
import {
  DeploymentStrategy,
  DeploymentStrategyFactory,
  PortAllocation,
  ProcessConfig,
} from './deployment';
import { bundledBinaries } from './BundledBinaries';

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
 * Individual process info
 */
interface ProcessInfo {
  process: ChildProcess;
  config: ProcessConfig;
  state: ProcessState;
  output: ProcessOutput[];
  crashCount: number;
  lastCrashTime?: Date;
  healthStatus?: HealthCheckStatus;
}

/**
 * Process group - contains all processes for a project
 */
interface ProcessGroup {
  projectId: string;
  strategy: DeploymentStrategy;
  processes: Map<string, ProcessInfo>; // keyed by process id ('netlify', 'frontend', 'backend')
  ports: PortAllocation[];
  aggregatedState: ProcessState;
  aggregatedOutput: ProcessOutput[];
}

/**
 * ProcessManager Service
 *
 * Manages the lifecycle of dev server processes for projects.
 * Supports single-process (Netlify) and multi-process (Railway) deployments.
 */
class ProcessManager extends EventEmitter {
  private processGroups: Map<string, ProcessGroup> = new Map();
  private pendingStarts: Map<string, Promise<number>> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private currentProjectId: string | null = null;
  private readonly MAX_OUTPUT_LINES = 500;
  private readonly MAX_CRASHES = 3;
  private readonly CRASH_WINDOW_MS = 5 * 60 * 1000;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 60s - reduced for performance
  private readonly HEALTH_CHECK_TIMEOUT = 5000;
  private readonly MAX_HEALTH_FAILURES = 3;

  /**
   * Get decrypted Netlify token for authenticating netlify dev
   * This allows netlify dev to work with linked sites
   */
  private getNetlifyToken(): string | null {
    try {
      const tokensFilePath = path.join(app.getPath('userData'), 'deployment-tokens.json');
      if (!fs.existsSync(tokensFilePath)) {
        return null;
      }

      const tokens = JSON.parse(fs.readFileSync(tokensFilePath, 'utf-8'));
      const tokenData = tokens['netlify'];
      if (!tokenData) {
        return null;
      }

      // Decrypt the token
      if (tokenData.isFallback) {
        return Buffer.from(tokenData.encrypted, 'base64').toString('utf-8');
      } else {
        try {
          const buffer = Buffer.from(tokenData.encrypted, 'base64');
          return safeStorage.decryptString(buffer);
        } catch (error) {
          console.error('Failed to decrypt Netlify token:', error);
          return null;
        }
      }
    } catch (error) {
      console.error('Error reading Netlify token:', error);
      return null;
    }
  }

  /**
   * Start dev server(s) for a project
   * @param projectId - Unique project identifier
   * @param projectPath - Absolute path to project root
   * @param deployServices - Array of deployment services (e.g., ['netlify'] or ['railway'])
   * @returns Primary port number for preview
   */
  async startDevServer(
    projectId: string,
    projectPath: string,
    deployServices: string[] = ['netlify']
  ): Promise<number> {
    // Prevent race conditions
    const pendingStart = this.pendingStarts.get(projectId);
    if (pendingStart) {
      return pendingStart;
    }

    // Check if already running
    const existing = this.processGroups.get(projectId);
    if (
      existing &&
      (existing.aggregatedState === ProcessState.RUNNING ||
        existing.aggregatedState === ProcessState.STARTING)
    ) {
      return existing.strategy.getPreviewPort(existing.ports);
    }

    // Create start promise
    const startPromise = this.performStart(projectId, projectPath, deployServices);
    this.pendingStarts.set(projectId, startPromise);

    try {
      const port = await startPromise;
      return port;
    } finally {
      this.pendingStarts.delete(projectId);
    }
  }

  /**
   * Internal method that performs the actual start
   */
  private async performStart(
    projectId: string,
    projectPath: string,
    deployServices: string[]
  ): Promise<number> {
    // Stop existing if any
    const existing = this.processGroups.get(projectId);
    if (existing) {
      await this.stopDevServer(projectId, true);
    }

    // Get strategy
    const strategy = DeploymentStrategyFactory.create(deployServices);

    // Allocate ports
    const ports = await strategy.allocatePorts(projectId);

    // Update project configs with allocated ports (ensures .env files have correct ports)
    strategy.updateProjectConfigs(projectPath, ports);

    // Get process configs
    const processConfigs = strategy.getProcessConfigs(projectPath, ports);

    // Create process group
    const group: ProcessGroup = {
      projectId,
      strategy,
      processes: new Map(),
      ports,
      aggregatedState: ProcessState.STARTING,
      aggregatedOutput: [],
    };

    this.processGroups.set(projectId, group);
    this.emit('process-status-changed', projectId, ProcessState.STARTING);

    // Spawn all processes
    for (const config of processConfigs) {
      await this.spawnProcess(projectId, group, config);
    }

    // Wait for all processes to be ready
    await this.waitForAllProcessesReady(projectId, 30000);

    return strategy.getPreviewPort(ports);
  }

  /**
   * Spawn a single process within a group
   */
  private async spawnProcess(
    projectId: string,
    group: ProcessGroup,
    config: ProcessConfig
  ): Promise<void> {
    // Use bundled Node/npm binaries
    const bundledEnv = bundledBinaries.getEnvWithBundledPath();

    // Build environment with optional Netlify token
    const processEnv: Record<string, string | undefined> = {
      ...bundledEnv,
      ...config.env,
    };

    // Inject Netlify auth token for netlify dev to work with linked sites
    if (config.id === 'netlify') {
      const netlifyToken = this.getNetlifyToken();
      if (netlifyToken) {
        processEnv.NETLIFY_AUTH_TOKEN = netlifyToken;
      }
    }

    // Transform npm/npx commands to use bundled binaries
    let spawnCommand = config.command;
    let spawnArgs = config.args;

    if (config.command === 'npm') {
      const npmConfig = bundledBinaries.getNpmSpawnConfig(config.args);
      spawnCommand = npmConfig.command;
      spawnArgs = npmConfig.args;
    } else if (config.command === 'npx') {
      const npxConfig = bundledBinaries.getNpxSpawnConfig(config.args);
      spawnCommand = npxConfig.command;
      spawnArgs = npxConfig.args;
    }

    const childProcess = spawn(spawnCommand, spawnArgs, {
      cwd: config.cwd,
      shell: process.platform === 'win32',
      env: processEnv,
    });

    const processInfo: ProcessInfo = {
      process: childProcess,
      config,
      state: ProcessState.STARTING,
      output: [],
      crashCount: 0,
    };

    group.processes.set(config.id, processInfo);

    // Save PID
    if (childProcess.pid) {
      processPersistence.savePID(`${projectId}-${config.id}`, childProcess.pid, config.port);
    }

    // Handle stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.handleOutput(projectId, config.id, 'stdout', message);
    });

    // Handle stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const message = data.toString();
      this.handleOutput(projectId, config.id, 'stderr', message);
    });

    // Handle exit
    childProcess.on('exit', (code, signal) => {
      this.handleProcessExit(projectId, config.id, code, signal);
    });

    // Handle error
    childProcess.on('error', (error) => {
      this.handleProcessError(projectId, config.id, error);
    });
  }

  /**
   * Wait for all processes to be ready
   */
  private async waitForAllProcessesReady(projectId: string, timeoutMs: number): Promise<void> {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const healthConfig = group.strategy.getHealthCheckConfig(group.ports);
    const startTime = Date.now();

    // Wait for all endpoints to respond
    for (const endpoint of healthConfig.endpoints) {
      if (!endpoint.required) continue;

      let ready = false;
      while (!ready && Date.now() - startTime < timeoutMs) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(endpoint.url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (response) {
            ready = true;
            // Update individual process state
            const processInfo = Array.from(group.processes.values()).find(
              (p) => p.config.port === this.extractPortFromUrl(endpoint.url)
            );
            if (processInfo) {
              processInfo.state = ProcessState.RUNNING;
            }
          }
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      if (!ready && endpoint.required) {
        // Mark as error if required endpoint failed
        group.aggregatedState = ProcessState.ERROR;
        this.emit('process-status-changed', projectId, ProcessState.ERROR);
        this.emit('process-error', projectId, `${endpoint.label} server failed to respond`);
        return;
      }
    }

    // All processes ready
    group.aggregatedState = ProcessState.RUNNING;
    this.emit('process-status-changed', projectId, ProcessState.RUNNING);
    this.emit('process-ready', projectId, group.strategy.getPreviewPort(group.ports));

    // Start health checks
    this.startHealthCheck(projectId);
  }

  private extractPortFromUrl(url: string): number {
    const match = url.match(/:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Stop all dev servers for a project
   */
  async stopDevServer(projectId: string, force: boolean = false): Promise<void> {
    if (!force && this.currentProjectId === projectId) {
      console.warn('⚠️  Prevented stopping server for active project:', projectId);
      return;
    }

    const group = this.processGroups.get(projectId);
    if (!group || group.aggregatedState === ProcessState.STOPPED) {
      return;
    }

    group.aggregatedState = ProcessState.STOPPING;
    this.emit('process-status-changed', projectId, ProcessState.STOPPING);

    // Stop health checks
    this.stopHealthCheck(projectId);

    // Kill all processes
    const killPromises = Array.from(group.processes.entries()).map(
      ([processId, processInfo]) =>
        new Promise<void>((resolve) => {
          const childProcess = processInfo.process;

          const killTimeout = setTimeout(() => {
            if (childProcess && !childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 5000);

          childProcess.once('exit', () => {
            clearTimeout(killTimeout);
            processPersistence.removePID(`${projectId}-${processId}`);
            resolve();
          });

          if (childProcess && !childProcess.killed) {
            childProcess.kill('SIGTERM');
          } else {
            clearTimeout(killTimeout);
            resolve();
          }
        })
    );

    await Promise.all(killPromises);

    // Release ports
    group.strategy.releasePorts(projectId);

    // Cleanup
    group.aggregatedState = ProcessState.STOPPED;
    this.emit('process-status-changed', projectId, ProcessState.STOPPED);
    this.processGroups.delete(projectId);
  }

  /**
   * Restart dev server
   */
  async restartDevServer(
    projectId: string,
    projectPath: string,
    deployServices: string[] = ['netlify']
  ): Promise<number> {
    await this.stopDevServer(projectId, true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return this.startDevServer(projectId, projectPath, deployServices);
  }

  /**
   * Get current process status
   */
  getProcessStatus(projectId: string): ProcessState {
    const group = this.processGroups.get(projectId);
    return group ? group.aggregatedState : ProcessState.STOPPED;
  }

  /**
   * Get process output
   */
  getProcessOutput(projectId: string, limit?: number): ProcessOutput[] {
    const group = this.processGroups.get(projectId);
    if (!group) return [];

    const output = group.aggregatedOutput;
    if (limit && limit < output.length) {
      return output.slice(-limit);
    }
    return output;
  }

  /**
   * Get primary port for a project
   */
  getPort(projectId: string): number | undefined {
    const group = this.processGroups.get(projectId);
    if (!group) return undefined;
    return group.strategy.getPreviewPort(group.ports);
  }

  /**
   * Stop all processes
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.processGroups.keys()).map((projectId) =>
      this.stopDevServer(projectId, true)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Handle process output with label prefix
   */
  private handleOutput(
    projectId: string,
    processId: string,
    type: 'stdout' | 'stderr',
    message: string
  ): void {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const processInfo = group.processes.get(processId);
    if (!processInfo) return;

    // Add label prefix if present
    const label = processInfo.config.label;
    const prefixedMessage = label ? `${label} ${message}` : message;
    const prefixedRaw = label ? `${label} ${message}` : message;

    const outputLine: ProcessOutput = {
      timestamp: new Date(),
      type,
      message: stripAnsi(prefixedMessage),
      raw: prefixedRaw,
    };

    // Add to process-specific output
    processInfo.output.push(outputLine);
    if (processInfo.output.length > this.MAX_OUTPUT_LINES) {
      processInfo.output = processInfo.output.slice(-this.MAX_OUTPUT_LINES);
    }

    // Add to aggregated output
    group.aggregatedOutput.push(outputLine);
    if (group.aggregatedOutput.length > this.MAX_OUTPUT_LINES) {
      group.aggregatedOutput = group.aggregatedOutput.slice(-this.MAX_OUTPUT_LINES);
    }

    // Emit to renderer
    this.emit('process-output', projectId, outputLine);

    // Detect errors
    this.detectErrors(projectId, outputLine.message);
  }

  /**
   * Detect critical errors
   */
  private detectErrors(projectId: string, message: string): void {
    const criticalErrorPatterns = [
      /EADDRINUSE/i,
      /ECONNREFUSED/i,
      /EACCES/i,
      /Command failed/i,
    ];

    const hasCriticalError = criticalErrorPatterns.some((pattern) => pattern.test(message));

    if (hasCriticalError) {
      this.emit('process-error', projectId, message);
    }
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(
    projectId: string,
    processId: string,
    code: number | null,
    signal: string | null
  ): void {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const processInfo = group.processes.get(processId);
    if (!processInfo) return;

    // Check if stopping normally
    if (group.aggregatedState === ProcessState.STOPPING) {
      processInfo.state = ProcessState.STOPPED;
      return;
    }

    // Crash handling
    processInfo.state = ProcessState.CRASHED;

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

    // Update aggregated state
    this.updateAggregatedState(projectId);

    this.emit('process-crashed', projectId, {
      processId,
      code,
      signal,
      crashCount: processInfo.crashCount,
    });

    if (processInfo.crashCount >= this.MAX_CRASHES) {
      this.emit(
        'process-error',
        projectId,
        `${processInfo.config.label || processId} crashed too many times`
      );
    }
  }

  /**
   * Handle process error
   */
  private handleProcessError(projectId: string, processId: string, error: Error): void {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const processInfo = group.processes.get(processId);
    if (!processInfo) return;

    processInfo.state = ProcessState.ERROR;
    this.updateAggregatedState(projectId);

    this.emit(
      'process-error',
      projectId,
      `${processInfo.config.label || processId}: ${error.message}`
    );
  }

  /**
   * Update aggregated state based on individual process states
   */
  private updateAggregatedState(projectId: string): void {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const states = Array.from(group.processes.values()).map((p) => p.state);

    // If any process is in error or crashed, the group is in that state
    if (states.includes(ProcessState.ERROR)) {
      group.aggregatedState = ProcessState.ERROR;
    } else if (states.includes(ProcessState.CRASHED)) {
      group.aggregatedState = ProcessState.CRASHED;
    } else if (states.every((s) => s === ProcessState.RUNNING)) {
      group.aggregatedState = ProcessState.RUNNING;
    } else if (states.every((s) => s === ProcessState.STOPPED)) {
      group.aggregatedState = ProcessState.STOPPED;
    } else if (states.includes(ProcessState.STARTING)) {
      group.aggregatedState = ProcessState.STARTING;
    }

    this.emit('process-status-changed', projectId, group.aggregatedState);
  }

  /**
   * Start health checks for all processes
   */
  private startHealthCheck(projectId: string): void {
    this.stopHealthCheck(projectId);

    const group = this.processGroups.get(projectId);
    if (!group) return;

    // Initialize health status for all processes
    for (const processInfo of group.processes.values()) {
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
    }

    // Start periodic check
    const interval = setInterval(async () => {
      await this.performHealthCheck(projectId);
    }, this.HEALTH_CHECK_INTERVAL);

    this.healthCheckIntervals.set(projectId, interval);
  }

  /**
   * Stop health checks
   */
  private stopHealthCheck(projectId: string): void {
    const interval = this.healthCheckIntervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(projectId);
    }
  }

  /**
   * Perform health check on all endpoints
   */
  private async performHealthCheck(projectId: string): Promise<void> {
    const group = this.processGroups.get(projectId);
    if (!group) return;

    const healthConfig = group.strategy.getHealthCheckConfig(group.ports);
    let allHealthy = true;

    for (const endpoint of healthConfig.endpoints) {
      const port = this.extractPortFromUrl(endpoint.url);
      const processInfo = Array.from(group.processes.values()).find(
        (p) => p.config.port === port
      );

      if (!processInfo?.healthStatus) continue;

      const checks = processInfo.healthStatus.checks;

      // Check process alive
      try {
        if (processInfo.process && !processInfo.process.killed) {
          process.kill(processInfo.process.pid!, 0);
          checks.processAlive = { status: 'pass', message: 'Process running' };
        } else {
          checks.processAlive = { status: 'fail', message: 'Process not running' };
          allHealthy = false;
        }
      } catch {
        checks.processAlive = { status: 'fail', message: 'Process terminated' };
        allHealthy = false;
      }

      // Check HTTP responding
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);

        const response = await fetch(endpoint.url, {
          signal: controller.signal,
          method: 'HEAD',
        });

        clearTimeout(timeoutId);

        if (response) {
          checks.httpResponding = { status: 'pass', message: `Responding (${response.status})` };
        } else {
          checks.httpResponding = { status: 'fail', message: 'No response' };
          allHealthy = false;
        }
      } catch (error: any) {
        checks.httpResponding = {
          status: 'fail',
          message: error.name === 'AbortError' ? 'Timeout' : error.message,
        };
        allHealthy = false;
      }

      checks.portListening = { status: 'pass', message: `Port ${port} allocated` };
      processInfo.healthStatus.lastChecked = new Date();

      if (!allHealthy) {
        processInfo.healthStatus.consecutiveFailures++;
        if (processInfo.healthStatus.consecutiveFailures >= this.MAX_HEALTH_FAILURES) {
          processInfo.healthStatus.healthy = false;
          this.emit('process-health-critical', projectId, processInfo.healthStatus);
        }
      } else {
        processInfo.healthStatus.consecutiveFailures = 0;
        processInfo.healthStatus.healthy = true;
      }

      this.emit('process-health-changed', projectId, processInfo.healthStatus);
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(projectId: string): HealthCheckStatus | undefined {
    const group = this.processGroups.get(projectId);
    if (!group) return undefined;

    // Return first process health status (simplified)
    const firstProcess = group.processes.values().next().value;
    return firstProcess?.healthStatus;
  }

  /**
   * Trigger manual health check
   */
  async triggerHealthCheck(projectId: string): Promise<HealthCheckStatus | undefined> {
    const group = this.processGroups.get(projectId);
    if (!group || group.aggregatedState !== ProcessState.RUNNING) {
      return undefined;
    }

    await this.performHealthCheck(projectId);
    return this.getHealthStatus(projectId);
  }

  /**
   * Set currently active project
   */
  setCurrentProject(projectId: string | null): void {
    this.currentProjectId = projectId;
  }

  /**
   * Get all port allocations for a project
   */
  getPortAllocations(projectId: string): PortAllocation[] | undefined {
    const group = this.processGroups.get(projectId);
    return group?.ports;
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
