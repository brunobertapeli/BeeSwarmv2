import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { databaseService } from '../services/DatabaseService.js';

/**
 * Image Handlers
 *
 * Handles image operations like saving/replacing images
 */
export function registerImageHandlers(): void {
  /**
   * Save/replace image file
   * Replaces an existing image file with new image data
   */
  ipcMain.handle('image:replace', async (_event, projectId: string, imagePath: string, imageData: string) => {
    try {
      console.log('📸 [ImageHandlers] Replacing image:', imagePath, 'for project:', projectId);

      // Validate inputs
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID');
      }

      if (!imagePath || typeof imagePath !== 'string') {
        throw new Error('Invalid image path');
      }

      // Validate image data (should be base64 data URL)
      if (!imageData || !imageData.startsWith('data:image/')) {
        throw new Error('Invalid image data format');
      }

      // Get project from database to get the project directory
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Remove leading slash from URL path
      const urlPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

      // Common static asset directories in web projects
      const commonStaticDirs = [
        'public',
        'frontend/public',
        'client/public',
        'src/public',
        'static',
        'frontend/static',
        'src/assets',
        'assets',
        'dist',
        'build',
        'www',
      ];

      // Search for the actual file in common static directories
      let absoluteImagePath: string | null = null;

      for (const staticDir of commonStaticDirs) {
        const candidatePath = path.join(project.path, staticDir, urlPath);
        try {
          // Check if file exists
          await fs.access(candidatePath);
          absoluteImagePath = candidatePath;
          console.log('✅ [ImageHandlers] Found image at:', absoluteImagePath);
          break;
        } catch {
          // File doesn't exist in this location, continue searching
        }
      }

      // If not found in common dirs, try direct path as fallback
      if (!absoluteImagePath) {
        absoluteImagePath = path.join(project.path, urlPath);
        console.log('⚠️ [ImageHandlers] Image not found in common directories, using direct path:', absoluteImagePath);
      }

      // Extract base64 data
      const base64Data = imageData.split(',')[1];
      if (!base64Data) {
        throw new Error('Could not extract base64 data');
      }

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Ensure directory exists
      const dir = path.dirname(absoluteImagePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file (replace existing)
      await fs.writeFile(absoluteImagePath, buffer);

      console.log('✅ [ImageHandlers] Image replaced successfully');
      return { success: true, path: absoluteImagePath };
    } catch (error) {
      console.error('❌ [ImageHandlers] Failed to replace image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace image',
      };
    }
  });
}
