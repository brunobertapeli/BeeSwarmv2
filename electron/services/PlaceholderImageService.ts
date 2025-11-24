import * as path from 'path';
import { promises as fs } from 'fs';
import { createCanvas } from 'canvas';

/**
 * Manifest entry for a pending image
 */
interface ImageManifestEntry {
  name: string;
  path: string;
  dimensions: string; // e.g., "800x600"
  status: 'pending' | 'generated';
}

/**
 * PlaceholderImageService
 *
 * Generates placeholder images for Claude-created image references.
 * Scans /images/manifest.json and creates gray placeholder images with dimensions text.
 */
class PlaceholderImageService {
  /**
   * Generate placeholder images from manifest.json in a project
   * @param projectPath - Absolute path to project directory
   * @param imagesPath - Relative path to images directory (e.g., "frontend/public/assets/images")
   * @returns Number of placeholders generated
   */
  async generatePlaceholders(projectPath: string, imagesPath?: string): Promise<number> {
    try {
      console.log('📸 [PlaceholderImageService] Scanning for manifest.json in:', projectPath);

      let manifestPath: string | null = null;
      let manifestDir: string | null = null;

      // If imagesPath is provided, use it directly
      if (imagesPath) {
        const candidatePath = path.join(projectPath, imagesPath, 'manifest.json');
        try {
          await fs.access(candidatePath);
          manifestPath = candidatePath;
          manifestDir = path.dirname(candidatePath);
          console.log('✅ [PlaceholderImageService] Found manifest at:', manifestPath);
        } catch {
          console.log('ℹ️ [PlaceholderImageService] No manifest.json found at template path, skipping placeholder generation');
          return 0;
        }
      } else {
        console.log('⚠️ [PlaceholderImageService] No imagesPath provided, skipping placeholder generation');
        return 0;
      }

      // Read and parse manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');

      // Handle empty or whitespace-only files
      if (!manifestContent || manifestContent.trim().length === 0) {
        console.log('ℹ️ [PlaceholderImageService] Manifest file is empty, skipping');
        return 0;
      }

      // Parse JSON with error handling
      let manifest: ImageManifestEntry[];
      try {
        manifest = JSON.parse(manifestContent);
      } catch (parseError) {
        console.warn('⚠️ [PlaceholderImageService] Invalid JSON in manifest.json, skipping');
        return 0;
      }

      if (!Array.isArray(manifest) || manifest.length === 0) {
        console.log('ℹ️ [PlaceholderImageService] Manifest is empty, skipping');
        return 0;
      }

      console.log(`📋 [PlaceholderImageService] Found ${manifest.length} images in manifest`);

      let generatedCount = 0;

      // Generate placeholder for each pending entry
      for (const entry of manifest) {
        if (entry.status === 'pending') {
          try {
            // Parse dimensions
            const [widthStr, heightStr] = entry.dimensions.split('x');
            const width = parseInt(widthStr, 10);
            const height = parseInt(heightStr, 10);

            if (isNaN(width) || isNaN(height)) {
              console.warn(`⚠️ [PlaceholderImageService] Invalid dimensions for ${entry.name}: ${entry.dimensions}`);
              continue;
            }

            // Resolve image path relative to manifest directory
            // Remove leading slash from entry.path if present
            const relativePath = entry.path.startsWith('/') ? entry.path.slice(1) : entry.path;
            const imagePath = path.join(manifestDir, relativePath);

            // Check if image already exists
            try {
              await fs.access(imagePath);
              console.log(`✓ [PlaceholderImageService] Image already exists, skipping: ${entry.name}`);
              continue;
            } catch {
              // Image doesn't exist, generate it
            }

            // Ensure directory exists
            const imageDir = path.dirname(imagePath);
            await fs.mkdir(imageDir, { recursive: true });

            // Generate placeholder
            await this.createPlaceholderImage(imagePath, width, height, entry.dimensions);

            // Verify file was actually written to disk
            let retries = 0;
            const maxRetries = 5;
            while (retries < maxRetries) {
              try {
                await fs.access(imagePath);
                // File exists, break out of retry loop
                break;
              } catch {
                // File doesn't exist yet, wait and retry
                retries++;
                if (retries < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 50)); // Wait 50ms
                } else {
                  throw new Error(`File verification failed after ${maxRetries} retries: ${imagePath}`);
                }
              }
            }

            generatedCount++;
            console.log(`✅ [PlaceholderImageService] Generated: ${entry.name}`);
          } catch (error) {
            console.error(`❌ [PlaceholderImageService] Failed to generate ${entry.name}:`, error);
          }
        }
      }

      // Update manifest statuses
      const updatedManifest = manifest.map(entry => ({
        ...entry,
        status: 'generated' as const
      }));
      await fs.writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');

      // Add a small safety delay to ensure all filesystem operations are complete
      // This prevents race conditions where dev server restarts before files are fully flushed
      if (generatedCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Wait 200ms
        console.log(`✅ [PlaceholderImageService] Generated ${generatedCount} placeholder(s) and verified`);
      }

      return generatedCount;
    } catch (error) {
      console.error('❌ [PlaceholderImageService] Error generating placeholders:', error);
      throw error;
    }
  }

  /**
   * Create a single placeholder image
   * @param outputPath - Where to save the image
   * @param width - Image width
   * @param height - Image height
   * @param dimensionsText - Text to display (e.g., "800x600")
   */
  private async createPlaceholderImage(
    outputPath: string,
    width: number,
    height: number,
    dimensionsText: string
  ): Promise<void> {
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background with light gray (#E5E7EB)
    ctx.fillStyle = '#E5E7EB';
    ctx.fillRect(0, 0, width, height);

    // Prepare text
    const text = `Placeholder ${dimensionsText}`;

    // Calculate font size based on image dimensions
    // Use 1/20th of the smaller dimension, with min 12px and max 48px
    const minDimension = Math.min(width, height);
    const fontSize = Math.max(12, Math.min(48, minDimension / 20));

    // Set text style
    ctx.fillStyle = '#6B7280'; // Dark gray
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw text centered
    ctx.fillText(text, width / 2, height / 2);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    // Save as PNG with explicit file handle to ensure proper flush
    const buffer = canvas.toBuffer('image/png');

    // Use file handle for more reliable writes
    let fileHandle;
    try {
      fileHandle = await fs.open(outputPath, 'w');
      await fileHandle.write(buffer);
      // Explicitly sync to disk
      await fileHandle.sync();
    } finally {
      if (fileHandle) {
        await fileHandle.close();
      }
    }
  }
}

// Export singleton instance
export const placeholderImageService = new PlaceholderImageService();
