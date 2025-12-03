import { BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { processManager } from './ProcessManager';
import { databaseService } from './DatabaseService';
import { pathValidator } from '../utils/PathValidator';

/**
 * ScreenshotToolService
 *
 * Captures full-page screenshots for Claude's <printscreen_tool> XML tag.
 * Creates a hidden browser window, navigates to the specified route,
 * captures a full-page screenshot using CDP, and saves it to .codedeck/screenshot.png
 */
class ScreenshotToolService extends EventEmitter {
  private isCapturing: Map<string, boolean> = new Map();

  /**
   * Capture a screenshot of a specific route
   * @param projectId - Project identifier
   * @param route - Route to capture (e.g., "/dashboard", "/")
   * @param fullPage - If true, captures full page; if false (default), captures viewport only
   * @returns Promise<string> - Path to the saved screenshot
   */
  async capture(projectId: string, route: string = '/', fullPage: boolean = false): Promise<string | null> {
    // Prevent concurrent captures for the same project
    if (this.isCapturing.get(projectId)) {
      console.warn(`[ScreenshotTool] Already capturing for project ${projectId}`);
      return null;
    }

    this.isCapturing.set(projectId, true);

    let hiddenWindow: BrowserWindow | null = null;

    try {
      // Get project info
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        console.error(`[ScreenshotTool] Project not found: ${projectId}`);
        return null;
      }

      // Validate project path
      const validatedPath = pathValidator.validateProjectPath(project.path, project.userId);

      // Get dev server port
      const port = processManager.getPort(projectId);
      if (!port) {
        console.error(`[ScreenshotTool] No dev server running for project: ${projectId}`);
        return null;
      }

      // Ensure route starts with /
      const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
      const url = `http://localhost:${port}${normalizedRoute}`;

      // Create hidden browser window
      hiddenWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          offscreen: true,
        },
      });

      // Navigate to the URL
      await hiddenWindow.loadURL(url);

      // Wait for page to fully render (give React/Vue time to hydrate)
      await this.waitForPageReady(hiddenWindow);

      // Capture screenshot using CDP
      const screenshot = await this.captureScreenshot(hiddenWindow, fullPage);

      if (!screenshot) {
        console.error(`[ScreenshotTool] Failed to capture screenshot`);
        return null;
      }

      // Save to .codedeck/<route>.png
      const screenshotPath = await this.saveScreenshot(validatedPath, screenshot, normalizedRoute);

      this.emit('screenshot-captured', { projectId, path: screenshotPath, route });

      return screenshotPath;

    } catch (error) {
      console.error(`[ScreenshotTool] Error capturing screenshot:`, error);
      return null;
    } finally {
      // Clean up
      if (hiddenWindow && !hiddenWindow.isDestroyed()) {
        hiddenWindow.close();
      }
      this.isCapturing.set(projectId, false);
    }
  }

  /**
   * Wait for page to be fully loaded and rendered
   */
  private async waitForPageReady(window: BrowserWindow): Promise<void> {
    // loadURL() already waits for load, just add small delay for SPA hydration
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Capture screenshot using Chrome DevTools Protocol
   * @param fullPage - If true, captures entire page; if false, captures viewport only
   */
  private async captureScreenshot(window: BrowserWindow, fullPage: boolean): Promise<Buffer | null> {
    try {
      const webContents = window.webContents;

      // Attach debugger to use CDP
      webContents.debugger.attach('1.3');

      try {
        if (fullPage) {
          // Full page mode: get page dimensions and expand viewport
          const layoutResult = await webContents.debugger.sendCommand(
            'Page.getLayoutMetrics'
          );

          const contentSize = (layoutResult as any).contentSize || (layoutResult as any).cssContentSize;
          if (!contentSize) {
            console.error(`[ScreenshotTool] No contentSize in layout metrics`);
            return null;
          }

          const { width, height } = contentSize;

          // Set viewport to full page size (with max limits to prevent memory issues)
          const maxWidth = Math.min(width, 1920);
          const maxHeight = Math.min(height, 10000); // Cap at 10000px height

          await webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
            width: Math.ceil(maxWidth),
            height: Math.ceil(maxHeight),
            deviceScaleFactor: 1,
            mobile: false,
          });
        }

        // Capture screenshot with CDP
        const { data } = await webContents.debugger.sendCommand('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: fullPage,
          fromSurface: true,
        }) as { data: string };

        // Convert base64 to buffer
        return Buffer.from(data, 'base64');

      } finally {
        // Always detach debugger
        try {
          webContents.debugger.detach();
        } catch (e) {
          // Ignore detach errors
        }
      }

    } catch (error) {
      console.error(`[ScreenshotTool] CDP capture failed:`, error);

      // Fallback to simple capturePage
      try {
        const image = await window.webContents.capturePage();
        return image.toPNG();
      } catch (fallbackError) {
        console.error(`[ScreenshotTool] Fallback capture also failed:`, fallbackError);
        return null;
      }
    }
  }

  /**
   * Convert route to filename (e.g., "/pricing" → "pricing.png", "/" → "index.png")
   */
  private routeToFilename(route: string): string {
    // Remove leading/trailing slashes and replace remaining slashes with dashes
    let name = route.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
    // If empty (root route), use "index"
    if (!name) name = 'index';
    // Sanitize: only allow alphanumeric, dashes, underscores
    name = name.replace(/[^a-zA-Z0-9\-_]/g, '-');
    return `${name}.png`;
  }

  /**
   * Save screenshot to .codedeck/<route>.png
   */
  private async saveScreenshot(projectPath: string, screenshot: Buffer, route: string): Promise<string> {
    const codedeckDir = path.join(projectPath, '.codedeck');
    const filename = this.routeToFilename(route);
    const screenshotPath = path.join(codedeckDir, filename);

    // Ensure .codedeck directory exists
    if (!fs.existsSync(codedeckDir)) {
      fs.mkdirSync(codedeckDir, { recursive: true });
    }

    // Write screenshot (overwrites existing)
    fs.writeFileSync(screenshotPath, screenshot);

    return screenshotPath;
  }

  /**
   * Check if a capture is in progress for a project
   */
  isCapturingScreenshot(projectId: string): boolean {
    return this.isCapturing.get(projectId) || false;
  }
}

// Export singleton instance
export const screenshotToolService = new ScreenshotToolService();
