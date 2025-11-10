import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * Process persistence entry
 */
interface PersistedProcess {
  projectId: string;
  pid: number;
  port: number;
  timestamp: number;
}

/**
 * ProcessPersistence Service
 *
 * Tracks running processes to a file so they can be cleaned up
 * even if the app crashes or is force-quit.
 */
class ProcessPersistence {
  private pidFilePath: string;

  constructor() {
    // Store PID file in app user data directory
    const userDataPath = app.getPath('userData');
    this.pidFilePath = path.join(userDataPath, 'running-processes.json');

    // Ensure directory exists
    const dir = path.dirname(this.pidFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load persisted processes from file
   */
  private load(): Record<string, PersistedProcess> {
    try {
      if (fs.existsSync(this.pidFilePath)) {
        const data = fs.readFileSync(this.pidFilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load process persistence file:', error);
    }
    return {};
  }

  /**
   * Save processes to file
   */
  private save(data: Record<string, PersistedProcess>): void {
    try {
      fs.writeFileSync(this.pidFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save process persistence file:', error);
    }
  }

  /**
   * Save a running process
   */
  savePID(projectId: string, pid: number, port: number): void {
    const data = this.load();
    data[projectId] = {
      projectId,
      pid,
      port,
      timestamp: Date.now(),
    };
    this.save(data);
  }

  /**
   * Remove a process from persistence
   */
  removePID(projectId: string): void {
    const data = this.load();
    if (data[projectId]) {
      delete data[projectId];
      this.save(data);
    }
  }

  /**
   * Check if a process is running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up stale/orphaned processes
   * Called on app startup
   */
  async cleanupStaleProcesses(): Promise<void> {

    const data = this.load();
    const entries = Object.values(data);

    if (entries.length === 0) {
      return;
    }

    let killedCount = 0;
    let staleCount = 0;

    for (const entry of entries) {
      const { projectId, pid, port } = entry;

      if (this.isProcessRunning(pid)) {

        try {
          // Try graceful shutdown first
          process.kill(pid, 'SIGTERM');

          // Wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Force kill if still running
          if (this.isProcessRunning(pid)) {
            process.kill(pid, 'SIGKILL');
          }

          killedCount++;
        } catch (error) {
          console.error(`Failed to kill process ${pid}:`, error);
        }
      } else {
        staleCount++;
      }
    }

    // Clear all persisted processes
    this.save({});

  }

  /**
   * Get all persisted processes (for debugging)
   */
  getAllPersistedProcesses(): PersistedProcess[] {
    const data = this.load();
    return Object.values(data);
  }

  /**
   * Get persisted process for a specific project
   */
  getPersistedProcess(projectId: string): PersistedProcess | undefined {
    const data = this.load();
    return data[projectId];
  }
}

// Export singleton instance
export const processPersistence = new ProcessPersistence();
