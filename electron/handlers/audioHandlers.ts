import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';

// Use createRequire for CommonJS module in ESM context
const require = createRequire(import.meta.url);
const ffmpegPath: string = require('ffmpeg-static');

/**
 * Audio Handlers
 *
 * Handles audio operations like cropping/trimming audio files
 * Uses bundled ffmpeg-static for cross-platform support
 */
export function registerAudioHandlers(): void {
  /**
   * Crop audio file using ffmpeg
   * Trims audio from startTime to endTime and overwrites the original file
   */
  ipcMain.handle('audio:crop', async (
    _event,
    options: {
      inputPath: string;
      startTime: number;
      endTime: number;
      format: string;
    }
  ) => {
    try {
      const { inputPath, startTime, endTime } = options;

      // Validate inputs
      if (!inputPath || typeof inputPath !== 'string') {
        throw new Error('Invalid input path');
      }

      if (typeof startTime !== 'number' || typeof endTime !== 'number') {
        throw new Error('Invalid time values');
      }

      if (startTime < 0 || endTime <= startTime) {
        throw new Error('Invalid time range');
      }

      // Check if file exists
      await fs.access(inputPath);

      // Calculate duration
      const duration = endTime - startTime;

      // Create temp output path
      const ext = path.extname(inputPath);
      const dir = path.dirname(inputPath);
      const basename = path.basename(inputPath, ext);
      const tempOutputPath = path.join(dir, `${basename}_trimmed${ext}`);

      // Get ffmpeg path from ffmpeg-static
      const ffmpeg = ffmpegPath as string;
      if (!ffmpeg) {
        throw new Error('FFmpeg binary not found');
      }

      // Run ffmpeg to crop the audio
      await new Promise<void>((resolve, reject) => {
        const args = [
          '-y', // Overwrite output file
          '-i', inputPath,
          '-ss', startTime.toFixed(3),
          '-t', duration.toFixed(3),
          '-c', 'copy', // Copy codec (no re-encoding, faster)
          tempOutputPath
        ];

        console.log(`[AudioHandlers] Running ffmpeg: ${ffmpeg} ${args.join(' ')}`);

        const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });

        let stderr = '';
        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('error', (err) => {
          reject(new Error(`Failed to start FFmpeg: ${err.message}`));
        });

        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });
      });

      // Replace original file with trimmed version
      await fs.unlink(inputPath);
      await fs.rename(tempOutputPath, inputPath);

      console.log(`✅ [AudioHandlers] Audio cropped successfully: ${inputPath}`);
      return { success: true, path: inputPath };

    } catch (error) {
      console.error('❌ [AudioHandlers] Failed to crop audio:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to crop audio',
      };
    }
  });
}
