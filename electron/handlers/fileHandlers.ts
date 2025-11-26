import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { databaseService } from '../services/DatabaseService.js';

/**
 * File Handlers
 *
 * Handles file operations like finding and replacing text in project files
 */
export function registerFileHandlers(): void {
  /**
   * Find and replace text using element selector (more precise)
   * This uses the CSS selector and element info to find the exact element in source code
   */
  ipcMain.handle('files:replace-text-by-selector', async (_event, projectId: string, elementInfo: any, originalText: string, newText: string) => {
    try {
      console.log('📝 [FileHandlers] Replacing text by selector in project:', projectId);
      console.log('   Selector:', elementInfo.selector);
      console.log('   Tag:', elementInfo.tag);
      console.log('   Original:', originalText.substring(0, 100));
      console.log('   New:', newText.substring(0, 100));

      // Validate inputs
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID');
      }

      if (!elementInfo || !elementInfo.tag) {
        throw new Error('Invalid element info');
      }

      // Get project from database
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Common source directories to search
      const searchDirs = ['src', 'app', 'pages', 'components', 'views', 'lib', 'public', 'frontend', 'client'];

      // Find files that might contain this element
      // Use a short snippet of the original text to find candidate files
      const searchKey = originalText.substring(0, 30);
      const candidateFiles = await findFilesWithText(project.path, searchKey, searchDirs);

      if (candidateFiles.length === 0) {
        console.warn('⚠️ [FileHandlers] No files found containing the text');
        return { success: false, error: 'Text not found in any project files' };
      }

      console.log(`✅ [FileHandlers] Found ${candidateFiles.length} candidate file(s)`);

      // Now search for the specific element in those files
      let replacedCount = 0;
      const modifiedFiles: string[] = [];

      for (const filePath of candidateFiles) {
        try {
          const absolutePath = path.join(project.path, filePath);
          let content = await fs.readFile(absolutePath, 'utf-8');

          // Look for the element with matching tag and classes
          const replaced = replaceTextInElement(
            content,
            elementInfo,
            originalText,
            newText
          );

          if (replaced.modified) {
            await fs.writeFile(absolutePath, replaced.content, 'utf-8');
            replacedCount++;
            modifiedFiles.push(filePath);
            console.log(`✅ [FileHandlers] Replaced text in: ${filePath}`);
          }
        } catch (error) {
          console.error(`❌ [FileHandlers] Failed to replace text in ${filePath}:`, error);
        }
      }

      if (replacedCount === 0) {
        return { success: false, error: 'Could not find matching element in source files' };
      }

      console.log(`✅ [FileHandlers] Successfully replaced text in ${replacedCount} file(s)`);
      return { success: true, filesModified: replacedCount, modifiedFiles };
    } catch (error) {
      console.error('❌ [FileHandlers] Failed to replace text by selector:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace text',
      };
    }
  });
  /**
   * Find and replace text in project files
   * Uses ripgrep to find files containing the text, then replaces it
   */
  ipcMain.handle('files:replace-text-in-project', async (_event, projectId: string, originalText: string, newText: string) => {
    try {
      console.log('📝 [FileHandlers] Replacing text in project:', projectId);
      console.log('   Original:', originalText.substring(0, 100) + (originalText.length > 100 ? '...' : ''));
      console.log('   New:', newText.substring(0, 100) + (newText.length > 100 ? '...' : ''));

      // Validate inputs
      if (!projectId || typeof projectId !== 'string') {
        throw new Error('Invalid project ID');
      }

      if (!originalText || typeof originalText !== 'string') {
        throw new Error('Invalid original text');
      }

      if (!newText || typeof newText !== 'string') {
        throw new Error('Invalid new text');
      }

      // Get project from database
      const project = databaseService.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Common source directories to search
      const searchDirs = [
        'src',
        'app',
        'pages',
        'components',
        'views',
        'lib',
        'public',
        'frontend',
        'client',
      ];

      // Use first 50 chars as search key to find the file
      // (The full text might be too long and span multiple lines)
      const searchKey = originalText.substring(0, 50);
      console.log('   Search key:', searchKey);

      // Find files containing the search key
      const filesContainingText = await findFilesWithText(project.path, searchKey, searchDirs);

      if (filesContainingText.length === 0) {
        console.warn('⚠️ [FileHandlers] No files found containing the text');
        return {
          success: false,
          error: 'Text not found in any project files',
        };
      }

      console.log(`✅ [FileHandlers] Found ${filesContainingText.length} file(s) containing the text`);

      // Replace text in all matching files
      let replacedCount = 0;
      const modifiedFiles: string[] = [];

      for (const filePath of filesContainingText) {
        try {
          const absolutePath = path.join(project.path, filePath);
          let content = await fs.readFile(absolutePath, 'utf-8');

          // The text from the browser has no whitespace/newlines (textContent collapses them)
          // So we need to find and replace the text even with different whitespace

          // First, try exact match (fastest)
          if (content.includes(originalText)) {
            const newContent = content.replace(new RegExp(escapeRegExp(originalText), 'g'), newText);
            await fs.writeFile(absolutePath, newContent, 'utf-8');
            replacedCount++;
            modifiedFiles.push(filePath);
            console.log(`✅ [FileHandlers] Replaced text in: ${filePath} (exact match)`);
            continue;
          }

          // If exact match fails, try with normalized whitespace
          // Create a regex that allows any whitespace between words
          const searchWords = originalText.split(/\s+/).filter(w => w.length > 0);
          if (searchWords.length > 1) {
            // Build a regex pattern that matches the words with any whitespace between them
            const regexPattern = searchWords.map(word => escapeRegExp(word)).join('\\s+');
            const regex = new RegExp(regexPattern, 'g');

            const match = content.match(regex);
            if (match) {
              // Found a match with different whitespace
              // Replace the matched text (with original whitespace) with newText
              const newContent = content.replace(regex, newText);
              await fs.writeFile(absolutePath, newContent, 'utf-8');
              replacedCount++;
              modifiedFiles.push(filePath);
              console.log(`✅ [FileHandlers] Replaced text in: ${filePath} (normalized whitespace)`);
            }
          }
        } catch (error) {
          console.error(`❌ [FileHandlers] Failed to replace text in ${filePath}:`, error);
          // Continue with other files even if one fails
        }
      }

      if (replacedCount === 0) {
        return {
          success: false,
          error: 'Failed to replace text in any files',
        };
      }

      console.log(`✅ [FileHandlers] Successfully replaced text in ${replacedCount} file(s)`);
      return {
        success: true,
        filesModified: replacedCount,
        modifiedFiles,
      };
    } catch (error) {
      console.error('❌ [FileHandlers] Failed to replace text:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace text',
      };
    }
  });
}

/**
 * Find files containing specific text using native Node.js
 * Returns relative file paths from project root
 */
async function findFilesWithText(projectPath: string, searchText: string, searchDirs: string[]): Promise<string[]> {
  const matchingFiles: string[] = [];
  const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.html', '.css', '.scss', '.json'];

  // Search in specified directories
  for (const dir of searchDirs) {
    const dirPath = path.join(projectPath, dir);
    try {
      await fs.access(dirPath);
      const files = await searchDirectory(dirPath, searchText, validExtensions);
      matchingFiles.push(...files.map(f => path.relative(projectPath, f)));
    } catch {
      // Directory doesn't exist, skip it
    }
  }

  // Also search root-level files
  const rootFiles = await fs.readdir(projectPath);
  for (const file of rootFiles) {
    const filePath = path.join(projectPath, file);
    const stat = await fs.stat(filePath);
    if (stat.isFile() && validExtensions.includes(path.extname(file))) {
      const content = await fs.readFile(filePath, 'utf-8');
      if (content.includes(searchText)) {
        matchingFiles.push(file);
      }
    }
  }

  return matchingFiles;
}

/**
 * Recursively search directory for files containing text
 */
async function searchDirectory(dirPath: string, searchText: string, validExtensions: string[]): Promise<string[]> {
  const matchingFiles: string[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip node_modules and other common ignore directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }
        const subFiles = await searchDirectory(fullPath, searchText, validExtensions);
        matchingFiles.push(...subFiles);
      } else if (entry.isFile() && validExtensions.includes(path.extname(entry.name))) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.includes(searchText)) {
            matchingFiles.push(fullPath);
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn(`⚠️ [FileHandlers] Could not read file: ${fullPath}`);
        }
      }
    }
  } catch (error) {
    console.error(`❌ [FileHandlers] Error searching directory ${dirPath}:`, error);
  }

  return matchingFiles;
}

/**
 * Replace text within a specific element in source code
 * Looks for JSX/HTML elements matching the tag and classes
 */
function replaceTextInElement(
  content: string,
  elementInfo: any,
  originalText: string,
  newText: string
): { content: string; modified: boolean } {
  const { tag, className, id } = elementInfo;

  // Build patterns to match the element
  const patterns: RegExp[] = [];

  // Pattern 1: Match by ID if available (most specific)
  if (id) {
    // <tag id="..." ...>originalText</tag>
    const pattern = new RegExp(
      `(<${tag}[^>]*id=["']${escapeRegExp(id)}["'][^>]*>)\\s*${escapeRegExp(originalText)}\\s*(</${tag}>)`,
      'gi'
    );
    patterns.push(pattern);
  }

  // Pattern 2: Match by className if available
  if (className) {
    // Extract just the first class (most reliable)
    const firstClass = className.trim().split(/\s+/).filter((c: string) => !c.startsWith('edit-mode'))[0];
    if (firstClass) {
      const pattern = new RegExp(
        `(<${tag}[^>]*className=["'][^"']*${escapeRegExp(firstClass)}[^"']*["'][^>]*>)\\s*${escapeRegExp(originalText)}\\s*(</${tag}>)`,
        'gi'
      );
      patterns.push(pattern);
    }
  }

  // Pattern 3: Match by tag with the exact text (less specific, fallback)
  const simplePattern = new RegExp(
    `(<${tag}[^>]*>)\\s*${escapeRegExp(originalText)}\\s*(</${tag}>)`,
    'gi'
  );
  patterns.push(simplePattern);

  // Try each pattern
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      // Reset regex
      pattern.lastIndex = 0;
      const newContent = content.replace(pattern, `$1${newText}$2`);
      if (newContent !== content) {
        return { content: newContent, modified: true };
      }
    }
  }

  return { content, modified: false };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read file as base64
 */
ipcMain.handle('files:read-as-base64', async (_event, filePath: string) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  } catch (error) {
    console.error('❌ Error reading file as base64:', error);
    throw error;
  }
});

/**
 * Save base64 image to file
 */
ipcMain.handle('files:save-base64-image', async (_event, filePath: string, base64Data: string) => {
  try {
    console.log('💾 [FileHandlers] Saving image to:', filePath);

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');

    // Convert base64 to buffer and save
    const buffer = Buffer.from(base64Content, 'base64');
    await fs.writeFile(filePath, buffer);

    console.log('✅ [FileHandlers] Image saved successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ [FileHandlers] Error saving image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save image'
    };
  }
});
