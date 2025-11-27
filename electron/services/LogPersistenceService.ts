import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { ProcessOutput } from './ProcessManager';
import { databaseService } from './DatabaseService';
import { pathValidator } from '../utils/PathValidator';

/**
 * Console message interface from PreviewService
 */
interface PreviewConsoleMessage {
  level: number; // 0=verbose, 1=info, 2=warning, 3=error
  message: string;
  line: number;
  sourceId: string;
}

/**
 * LogPersistenceService
 *
 * Captures logs from frontend (browser console) and backend (dev server)
 * and persists them to markdown files in real-time for Claude feedback loop.
 */
class LogPersistenceService extends EventEmitter {
  private readonly MAX_LOG_SIZE = 500 * 1024; // 500KB per log file
  private readonly TRUNCATE_TO_SIZE = 250 * 1024; // Keep last 250KB when truncating
  private writeQueues: Map<string, NodeJS.Timeout> = new Map();
  private pendingWrites: Map<string, string[]> = new Map();

  /**
   * Initialize log persistence for a project
   * Creates log directory structure if it doesn't exist
   */
  initializeProject(projectId: string): void {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        console.warn(`⚠️ [LogPersistence] Project ${projectId} not found`);
        return;
      }

      const validatedPath = pathValidator.validateProjectPath(project.path, project.userId);
      const logsDir = path.join(validatedPath, '.codedeck', 'logs');

      // Create logs directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Initialize empty log files if they don't exist
      const devtoolsLog = path.join(logsDir, 'devtools.md');
      const backendLog = path.join(logsDir, 'backend.md');

      if (!fs.existsSync(devtoolsLog)) {
        fs.writeFileSync(devtoolsLog, '', 'utf-8');
      }

      if (!fs.existsSync(backendLog)) {
        fs.writeFileSync(backendLog, '', 'utf-8');
      }

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to initialize project ${projectId}:`, error);
    }
  }

  /**
   * Handle process output from ProcessManager (backend/serverless logs)
   */
  handleProcessOutput(projectId: string, output: ProcessOutput): void {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) return;

      const validatedPath = pathValidator.validateProjectPath(project.path, project.userId);
      const backendLogPath = path.join(validatedPath, '.codedeck', 'logs', 'backend.md');

      // Raw log entry - no decoration
      const logEntry = output.message;

      // Queue write
      this.queueWrite(backendLogPath, logEntry);

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to handle process output:`, error);
    }
  }

  /**
   * Handle console messages from PreviewService (frontend logs)
   */
  handlePreviewConsole(projectId: string, consoleMsg: PreviewConsoleMessage): void {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) return;

      const validatedPath = pathValidator.validateProjectPath(project.path, project.userId);
      const devtoolsLogPath = path.join(validatedPath, '.codedeck', 'logs', 'devtools.md');

      // Raw log entry - no decoration
      const logEntry = consoleMsg.message + '\n';

      // Queue write
      this.queueWrite(devtoolsLogPath, logEntry);

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to handle preview console:`, error);
    }
  }

  /**
   * Clear logs for a project
   */
  clearLogs(projectId: string): void {
    try {
      const project = databaseService.getProjectById(projectId);
      if (!project) return;

      const validatedPath = pathValidator.validateProjectPath(project.path, project.userId);
      const logsDir = path.join(validatedPath, '.codedeck', 'logs');

      const devtoolsLog = path.join(logsDir, 'devtools.md');
      const backendLog = path.join(logsDir, 'backend.md');

      // Clear log files
      if (fs.existsSync(devtoolsLog)) {
        fs.writeFileSync(devtoolsLog, '', 'utf-8');
      }

      if (fs.existsSync(backendLog)) {
        fs.writeFileSync(backendLog, '', 'utf-8');
      }

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to clear logs:`, error);
    }
  }

  /**
   * Queue write operation to batch multiple logs together
   * This prevents excessive disk I/O from rapid log events
   */
  private queueWrite(filePath: string, logEntry: string): void {
    // Add to pending writes
    if (!this.pendingWrites.has(filePath)) {
      this.pendingWrites.set(filePath, []);
    }
    this.pendingWrites.get(filePath)!.push(logEntry);

    // Clear existing timer
    if (this.writeQueues.has(filePath)) {
      clearTimeout(this.writeQueues.get(filePath)!);
    }

    // Set new timer to batch writes (100ms)
    const timer = setTimeout(() => {
      this.flushWrites(filePath);
    }, 100);

    this.writeQueues.set(filePath, timer);
  }

  /**
   * Flush pending writes to disk
   */
  private flushWrites(filePath: string): void {
    const entries = this.pendingWrites.get(filePath);
    if (!entries || entries.length === 0) return;

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // If file doesn't exist, create it empty
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '', 'utf-8');
      }

      // Check file size before writing
      const stats = fs.statSync(filePath);
      if (stats.size > this.MAX_LOG_SIZE) {
        // Truncate file - keep only last portion
        this.truncateLogFile(filePath);
      }

      // Append all pending entries
      const content = entries.join('');
      fs.appendFileSync(filePath, content, 'utf-8');

      // Clear pending writes
      this.pendingWrites.set(filePath, []);
      this.writeQueues.delete(filePath);

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to write to ${filePath}:`, error);
    }
  }

  /**
   * Truncate log file to keep only recent logs
   */
  private truncateLogFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Keep only the last TRUNCATE_TO_SIZE bytes
      const bytesToKeep = Math.min(content.length, this.TRUNCATE_TO_SIZE);
      const truncatedContent = content.slice(-bytesToKeep);

      // Find first newline to avoid cutting mid-line
      const firstNewline = truncatedContent.indexOf('\n');
      const cleanContent = firstNewline > 0 ? truncatedContent.slice(firstNewline + 1) : truncatedContent;

      // Overwrite file with truncated content
      fs.writeFileSync(filePath, cleanContent, 'utf-8');

    } catch (error) {
      console.error(`❌ [LogPersistence] Failed to truncate log file:`, error);
    }
  }

  /**
   * Cleanup on app exit - flush any pending writes
   */
  cleanup(): void {
    // Flush all pending writes
    for (const filePath of this.pendingWrites.keys()) {
      this.flushWrites(filePath);
    }

    // Clear all timers
    for (const timer of this.writeQueues.values()) {
      clearTimeout(timer);
    }

    this.writeQueues.clear();
    this.pendingWrites.clear();
  }
}

export const logPersistenceService = new LogPersistenceService();
