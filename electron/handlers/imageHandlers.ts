import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
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
          break;
        } catch {
          // File doesn't exist in this location, continue searching
        }
      }

      // If not found in common dirs, try direct path as fallback
      if (!absoluteImagePath) {
        absoluteImagePath = path.join(project.path, urlPath);
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

      return { success: true, path: absoluteImagePath };
    } catch (error) {
      console.error('❌ [ImageHandlers] Failed to replace image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace image',
      };
    }
  });

  /**
   * Crop and replace image file using Sharp for high-quality processing
   * Uses Lanczos3 resampling for superior quality compared to Canvas
   */
  ipcMain.handle('image:cropAndReplace', async (
    _event,
    projectId: string,
    imagePath: string,
    sourceImageBase64: string,
    cropData: {
      sourceX: number;
      sourceY: number;
      sourceWidth: number;
      sourceHeight: number;
      targetWidth: number;
      targetHeight: number;
    }
  ) => {
    try {

      // Validate inputs
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID');
      }

      if (!imagePath || typeof imagePath !== 'string') {
        throw new Error('Invalid image path');
      }

      if (!sourceImageBase64 || !sourceImageBase64.startsWith('data:image/')) {
        throw new Error('Invalid source image data format');
      }

      if (!cropData || typeof cropData.sourceX !== 'number') {
        throw new Error('Invalid crop data');
      }

      // Get project from database
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
          await fs.access(candidatePath);
          absoluteImagePath = candidatePath;
          break;
        } catch {
          // File doesn't exist in this location, continue searching
        }
      }

      // If not found in common dirs, try direct path as fallback
      if (!absoluteImagePath) {
        absoluteImagePath = path.join(project.path, urlPath);
      }

      // Extract base64 data from data URL
      const base64Data = sourceImageBase64.split(',')[1];
      if (!base64Data) {
        throw new Error('Could not extract base64 data');
      }

      const inputBuffer = Buffer.from(base64Data, 'base64');

      // Determine output format from original file extension
      const ext = path.extname(imagePath).toLowerCase();

      // Round crop values to integers (Sharp requires integers)
      const extractLeft = Math.max(0, Math.round(cropData.sourceX));
      const extractTop = Math.max(0, Math.round(cropData.sourceY));
      const extractWidth = Math.max(1, Math.round(cropData.sourceWidth));
      const extractHeight = Math.max(1, Math.round(cropData.sourceHeight));

      // Output at 2x for retina display sharpness (industry standard)
      const retinaMultiplier = 2;
      const outputWidth = cropData.targetWidth * retinaMultiplier;
      const outputHeight = cropData.targetHeight * retinaMultiplier;

      // Process with Sharp using Lanczos3 for high-quality resampling
      // Output at 2x size - browser will downscale for crisp retina display
      let pipeline = sharp(inputBuffer)
        .extract({
          left: extractLeft,
          top: extractTop,
          width: extractWidth,
          height: extractHeight
        })
        .resize(outputWidth, outputHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        });

      // Output in the appropriate format based on original file extension
      if (ext === '.jpg' || ext === '.jpeg') {
        pipeline = pipeline.jpeg({ quality: 92 });
      } else if (ext === '.webp') {
        pipeline = pipeline.webp({ quality: 92 });
      } else {
        // Default to PNG (lossless)
        pipeline = pipeline.png();
      }

      const outputBuffer = await pipeline.toBuffer();

      // Ensure directory exists
      const dir = path.dirname(absoluteImagePath);
      await fs.mkdir(dir, { recursive: true });

      // Write the processed image to disk
      await fs.writeFile(absoluteImagePath, outputBuffer);

      return { success: true, path: absoluteImagePath };
    } catch (error) {
      console.error('❌ [ImageHandlers] Failed to crop and replace image:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to crop and replace image',
      };
    }
  });
}
