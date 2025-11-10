import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

/**
 * KeywordService
 *
 * Loads and manages tech keywords for educational tooltips.
 * Keywords are loaded fresh on each app start from keywords.json.
 */
class KeywordService {
  private keywords: Map<string, string> = new Map();

  /**
   * Load keywords from JSON file
   */
  loadKeywords(): void {
    try {
      // Determine keywords path based on environment
      const isDev = !app.isPackaged;
      const keywordsPath = isDev
        ? path.join(process.cwd(), 'keywords.json')
        : path.join(process.resourcesPath, 'keywords.json');


      // Check if file exists
      if (!fs.existsSync(keywordsPath)) {
        console.warn('⚠️ Keywords file not found at:', keywordsPath);
        return;
      }

      // Read and parse keywords
      const data = fs.readFileSync(keywordsPath, 'utf-8');
      const keywordsObj = JSON.parse(data);

      // Store in Map with lowercase keys for case-insensitive lookup
      this.keywords.clear();
      for (const [keyword, description] of Object.entries(keywordsObj)) {
        this.keywords.set(keyword.toLowerCase(), description as string);
      }

    } catch (error) {
      console.error('❌ Failed to load keywords:', error);
    }
  }

  /**
   * Get all keywords as an object (for IPC)
   */
  getKeywords(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [keyword, description] of this.keywords.entries()) {
      result[keyword] = description;
    }
    return result;
  }

  /**
   * Get keyword count
   */
  getCount(): number {
    return this.keywords.size;
  }
}

// Export singleton
export const keywordService = new KeywordService();
