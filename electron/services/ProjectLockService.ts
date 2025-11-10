/**
 * ProjectLockService
 *
 * Provides project-level mutex/locking to prevent race conditions when
 * multiple operations attempt to modify the same project concurrently.
 *
 * Critical for preventing bugs when:
 * - Fast project switching occurs
 * - Claude operations overlap with dev server restarts
 * - Multiple IPC handlers try to modify same project
 *
 * Usage:
 *   await projectLockService.withLock(projectId, async () => {
 *     // Your atomic operation here
 *   });
 */

export class ProjectLockService {
  private locks: Map<string, Promise<void>> = new Map();
  private operationQueue: Map<string, string[]> = new Map(); // For debugging

  /**
   * Execute an operation with exclusive lock on a project
   *
   * @param projectId - The project to lock
   * @param operation - Async operation to execute
   * @param operationName - Optional name for debugging
   * @returns Result of the operation
   */
  async withLock<T>(
    projectId: string,
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<T> {
    // Wait for any existing operation to complete
    const existingLock = this.locks.get(projectId);
    if (existingLock) {
      await existingLock;
    }

    // Create new lock promise
    let release: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(projectId, lock);

    // Track operation for debugging
    const queue = this.operationQueue.get(projectId) || [];
    queue.push(operationName);
    this.operationQueue.set(projectId, queue);


    try {
      const result = await operation();
      return result;
    } catch (error) {
      console.error(`❌ Operation failed for project ${projectId}:`, error);
      throw error;
    } finally {
      // Release the lock
      release!();
      this.locks.delete(projectId);

      // Clean up queue tracking
      const currentQueue = this.operationQueue.get(projectId) || [];
      const index = currentQueue.indexOf(operationName);
      if (index > -1) {
        currentQueue.splice(index, 1);
      }
      if (currentQueue.length === 0) {
        this.operationQueue.delete(projectId);
      }

    }
  }

  /**
   * Check if a project is currently locked
   */
  isLocked(projectId: string): boolean {
    return this.locks.has(projectId);
  }

  /**
   * Get current operation queue for a project (for debugging)
   */
  getOperationQueue(projectId: string): string[] {
    return this.operationQueue.get(projectId) || [];
  }

  /**
   * Force release all locks (use with caution - for cleanup only)
   */
  releaseAllLocks(): void {
    console.warn('⚠️ Force releasing all project locks');
    this.locks.clear();
    this.operationQueue.clear();
  }
}

// Singleton instance
export const projectLockService = new ProjectLockService();
