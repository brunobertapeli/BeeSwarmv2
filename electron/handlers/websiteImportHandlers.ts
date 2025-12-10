import { ipcMain, app } from 'electron';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { getCurrentUserId } from '../main';
import { databaseService } from '../services/DatabaseService';

// ============================================================================
// TYPES FOR COMPLETE WEBSITE EXTRACTION
// ============================================================================

interface ExtractedAsset {
  type: 'image' | 'font' | 'svg' | 'video';
  originalUrl: string;
  localPath: string;
  filename: string;
}

interface ExtractedElement {
  tagName: string;
  id?: string;
  classes: string[];
  // Bounding box
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // Key computed styles
  styles: {
    display: string;
    position: string;
    flexDirection?: string;
    justifyContent?: string;
    alignItems?: string;
    gap?: string;
    padding: string;
    margin: string;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    lineHeight: string;
    textAlign: string;
    borderRadius: string;
    border: string;
    boxShadow: string;
    opacity: string;
    transform: string;
    transition: string;
    animation: string;
    backgroundImage: string;
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
  };
  // Content
  textContent?: string;
  innerHTML?: string;
  // Attributes
  attributes: Record<string, string>;
  // Children count for structure
  childCount: number;
  // For images
  src?: string;
  alt?: string;
  // For links
  href?: string;
  // For animations (Framer Motion, etc.)
  animationData?: {
    framerMotion?: boolean;
    gsap?: boolean;
    cssAnimation?: string;
    cssTransition?: string;
  };
}

interface CloneManifest {
  version: '2.0';
  config?: {
    importType: 'template' | 'screenshot' | 'ai' | 'clone';
  };
  metadata: {
    sourceUrl: string;
    analyzedAt: string;
    title: string;
    description: string;
    favicon?: string;
    viewport: { width: number; height: number };
    fullPageHeight: number;
  };
  // Color palette extracted from the page
  colorPalette: {
    primary: string[];
    background: string[];
    text: string[];
    accent: string[];
  };
  // Typography
  typography: {
    fonts: string[];
    googleFonts: string[];
    headingSizes: string[];
    bodySizes: string[];
  };
  // Assets
  assets: {
    images: ExtractedAsset[];
    fonts: ExtractedAsset[];
    svgs: ExtractedAsset[];
  };
  // Structure info
  structure: {
    hasHeader: boolean;
    hasFooter: boolean;
    hasNavigation: boolean;
    sectionCount: number;
    layoutType: 'single-column' | 'multi-column' | 'grid' | 'complex';
  };
}

/**
 * Register website import IPC handlers
 */
export function registerWebsiteImportHandlers(): void {
  // Check if a project is a website import and if migration is completed
  ipcMain.handle('website-import:check-status', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      const manifestPath = path.join(project.path, 'website-import', 'manifest.json');

      // Check if manifest exists
      if (!fs.existsSync(manifestPath)) {
        return {
          success: true,
          isImport: false
        };
      }

      // Read manifest to get importType
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const importType = manifestContent.config?.importType || null;

      // Check if auto-prompt was sent (from database, not file)
      const autoPromptSent = project.websiteImportAutoPromptSent !== null;


      return {
        success: true,
        isImport: true,
        importType,
        migrationCompleted: autoPromptSent, // Keep same property name for compatibility
        manifest: manifestContent
      };
    } catch (error) {
      console.error('❌ [WEBSITE IMPORT] Error checking status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Mark migration as completed
  ipcMain.handle('website-import:mark-complete', async (_event, projectId: string) => {
    try {
      const project = databaseService.getProjectById(projectId);

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      // Mark in database (atomic, no race conditions)
      databaseService.markWebsiteImportAutoPromptSent(projectId);

      return {
        success: true
      };
    } catch (error) {
      console.error('❌ [WEBSITE IMPORT] Error marking migration complete:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Clean up temp import data
  ipcMain.handle('website-import:cleanup', async (_event, tempProjectId: string) => {
    try {
      const userId = getCurrentUserId() || 'unknown';
      const tempDir = path.join(
        app.getPath('home'),
        'Documents',
        'CodeDeck',
        userId,
        'temp',
        tempProjectId
      );

      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        return { success: true };
      } else {
        return { success: true }; // Not an error if already cleaned
      }
    } catch (error) {
      console.error('❌ [WEBSITE IMPORT] Cleanup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cleanup failed'
      };
    }
  });

  ipcMain.handle('website-import:analyze', async (_event, url: string) => {
    const userId = getCurrentUserId() || 'unknown';
    const tempProjectId = `website-import-${Date.now()}`;

    // Create temp directory structure
    const tempDir = path.join(
      app.getPath('home'),
      'Documents',
      'CodeDeck',
      userId,
      'temp',
      tempProjectId
    );

    try {
      // Create directory structure
      const dirs = ['images', 'fonts', 'svgs', 'source'];
      fs.mkdirSync(tempDir, { recursive: true });
      dirs.forEach(dir => fs.mkdirSync(path.join(tempDir, dir), { recursive: true }));

      console.log('🌐 [WEBSITE IMPORT] Starting comprehensive extraction for:', url);

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Collect network requests for assets
      const networkAssets: { url: string; type: string }[] = [];
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'font', 'stylesheet'].includes(resourceType)) {
          networkAssets.push({ url: request.url(), type: resourceType });
        }
        request.continue();
      });

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Wait for any lazy-loaded content and animations to settle
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2000)));

      // ========================================================================
      // 1. CAPTURE FULL-PAGE SCREENSHOT
      // ========================================================================
      console.log('📸 [WEBSITE IMPORT] Capturing screenshot...');
      const fullPageHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      try {
        const screenshotBuffer = await page.screenshot({
          fullPage: true,
          type: 'png'
        });
        fs.writeFileSync(path.join(tempDir, 'website-screenshot.png'), screenshotBuffer);
      } catch (screenshotError) {
        console.warn('⚠️ [WEBSITE IMPORT] Screenshot failed:', screenshotError);
      }

      // ========================================================================
      // 2. EXTRACT FULL HTML SOURCE (cleaned and formatted)
      // ========================================================================
      console.log('📄 [WEBSITE IMPORT] Extracting HTML source...');

      const htmlSource = await page.evaluate(() => {
        // Clone the document to avoid modifying the original
        const clone = document.documentElement.cloneNode(true) as HTMLElement;

        // Remove script tags (we don't need JS)
        clone.querySelectorAll('script').forEach(el => el.remove());

        // Remove noscript tags
        clone.querySelectorAll('noscript').forEach(el => el.remove());

        // Remove comments
        const removeComments = (node: Node) => {
          const children = Array.from(node.childNodes);
          children.forEach(child => {
            if (child.nodeType === 8) { // Comment node
              child.remove();
            } else if (child.hasChildNodes()) {
              removeComments(child);
            }
          });
        };
        removeComments(clone);

        return '<!DOCTYPE html>\n' + clone.outerHTML;
      });

      fs.writeFileSync(path.join(tempDir, 'source', 'index.html'), htmlSource);

      // ========================================================================
      // 3. EXTRACT ALL CSS (inline + external stylesheets)
      // ========================================================================
      console.log('🎨 [WEBSITE IMPORT] Extracting CSS...');

      const allStyles = await page.evaluate(() => {
        const styles: string[] = [];

        // Get all stylesheets
        Array.from(document.styleSheets).forEach((sheet, index) => {
          try {
            const rules = Array.from(sheet.cssRules || []);
            const css = rules.map(rule => rule.cssText).join('\n');
            if (css.trim()) {
              styles.push(`/* === Stylesheet ${index + 1} === */\n${css}`);
            }
          } catch (e) {
            // CORS-blocked stylesheets - try to get href
            if (sheet.href) {
              styles.push(`/* External stylesheet (CORS blocked): ${sheet.href} */`);
            }
          }
        });

        // Get inline styles from style tags
        document.querySelectorAll('style').forEach((styleTag, index) => {
          if (styleTag.textContent?.trim()) {
            styles.push(`/* === Inline Style ${index + 1} === */\n${styleTag.textContent}`);
          }
        });

        return styles.join('\n\n');
      });

      fs.writeFileSync(path.join(tempDir, 'source', 'styles.css'), allStyles);

      // ========================================================================
      // 4. EXTRACT ELEMENT TREE WITH COMPUTED STYLES
      // ========================================================================
      console.log('🏗️ [WEBSITE IMPORT] Extracting element structure...');

      const elementTree = await page.evaluate(() => {
        const extractElement = (el: Element, depth: number = 0): any => {
          if (depth > 15) return null; // Limit depth

          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          // Skip invisible elements
          if (rect.width === 0 && rect.height === 0) return null;

          // Get meaningful attributes
          const attrs: Record<string, string> = {};
          ['id', 'class', 'href', 'src', 'alt', 'type', 'placeholder', 'aria-label', 'role',
           'data-framer-appear-id', 'data-framer-component-type', 'data-aos', 'data-animate'
          ].forEach(attr => {
            const val = el.getAttribute(attr);
            if (val) attrs[attr] = val;
          });

          // Check for animations (handle SVG className which is SVGAnimatedString)
          const classNameStr = typeof el.className === 'string' ? el.className : ((el.className as any)?.baseVal || '');
          const hasFramerMotion = el.hasAttribute('data-framer-appear-id') ||
                                  classNameStr.includes('framer') ||
                                  el.hasAttribute('data-framer-component-type');
          const hasAOS = el.hasAttribute('data-aos');
          const cssAnimation = style.animation !== 'none' ? style.animation : undefined;
          const cssTransition = style.transition !== 'all 0s ease 0s' ? style.transition : undefined;

          const elementData: any = {
            tag: el.tagName.toLowerCase(),
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            },
            styles: {
              display: style.display,
              position: style.position,
              flexDirection: style.flexDirection !== 'row' ? style.flexDirection : undefined,
              justifyContent: style.justifyContent !== 'normal' ? style.justifyContent : undefined,
              alignItems: style.alignItems !== 'normal' ? style.alignItems : undefined,
              gap: style.gap !== 'normal' ? style.gap : undefined,
              padding: style.padding !== '0px' ? style.padding : undefined,
              margin: style.margin !== '0px' ? style.margin : undefined,
              backgroundColor: style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : undefined,
              color: style.color,
              fontSize: style.fontSize,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight !== '400' ? style.fontWeight : undefined,
              lineHeight: style.lineHeight,
              textAlign: style.textAlign !== 'start' ? style.textAlign : undefined,
              borderRadius: style.borderRadius !== '0px' ? style.borderRadius : undefined,
              border: style.border !== '0px none rgb(0, 0, 0)' ? style.border : undefined,
              boxShadow: style.boxShadow !== 'none' ? style.boxShadow : undefined,
              opacity: style.opacity !== '1' ? style.opacity : undefined,
              transform: style.transform !== 'none' ? style.transform : undefined,
              backgroundImage: style.backgroundImage !== 'none' ? style.backgroundImage : undefined,
              gridTemplateColumns: style.gridTemplateColumns !== 'none' ? style.gridTemplateColumns : undefined,
            },
            attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
          };

          // Add animation data if present
          if (hasFramerMotion || hasAOS || cssAnimation || cssTransition) {
            elementData.animation = {
              framerMotion: hasFramerMotion || undefined,
              aos: hasAOS ? el.getAttribute('data-aos') : undefined,
              css: cssAnimation,
              transition: cssTransition
            };
          }

          // Get text content for leaf nodes
          if (el.children.length === 0 && el.textContent?.trim()) {
            elementData.text = el.textContent.trim().slice(0, 500); // Limit text length
          }

          // For images, include src
          if (el.tagName === 'IMG') {
            elementData.src = (el as HTMLImageElement).src;
            elementData.alt = (el as HTMLImageElement).alt;
          }

          // For links, include href
          if (el.tagName === 'A') {
            elementData.href = (el as HTMLAnchorElement).href;
          }

          // For SVGs, get the content
          if (el.tagName === 'SVG' || el.tagName === 'svg') {
            elementData.svg = el.outerHTML;
          }

          // Process children
          const children = Array.from(el.children)
            .map(child => extractElement(child, depth + 1))
            .filter(Boolean);

          if (children.length > 0) {
            elementData.children = children;
          }

          return elementData;
        };

        return extractElement(document.body);
      });

      fs.writeFileSync(
        path.join(tempDir, 'source', 'elements.json'),
        JSON.stringify(elementTree, null, 2)
      );

      // ========================================================================
      // 5. EXTRACT COLOR PALETTE & TYPOGRAPHY
      // ========================================================================
      console.log('🎨 [WEBSITE IMPORT] Analyzing design tokens...');

      const designTokens = await page.evaluate(() => {
        const colors = new Set<string>();
        const bgColors = new Set<string>();
        const fonts = new Set<string>();
        const fontSizes = new Set<string>();

        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);

          // Collect colors
          if (style.color && style.color !== 'rgba(0, 0, 0, 0)') {
            colors.add(style.color);
          }
          if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            bgColors.add(style.backgroundColor);
          }

          // Collect fonts
          if (style.fontFamily) {
            fonts.add(style.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
          }

          // Collect font sizes
          if (style.fontSize) {
            fontSizes.add(style.fontSize);
          }
        });

        // Extract Google Fonts from link tags
        const googleFonts: string[] = [];
        document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
          googleFonts.push((link as HTMLLinkElement).href);
        });

        return {
          colors: Array.from(colors).slice(0, 20),
          bgColors: Array.from(bgColors).slice(0, 20),
          fonts: Array.from(fonts).slice(0, 10),
          fontSizes: Array.from(fontSizes).sort(),
          googleFonts
        };
      });

      fs.writeFileSync(
        path.join(tempDir, 'source', 'design-tokens.json'),
        JSON.stringify(designTokens, null, 2)
      );

      // ========================================================================
      // 6. DOWNLOAD IMAGES
      // ========================================================================
      console.log('🖼️ [WEBSITE IMPORT] Downloading images...');

      const imageUrls = await page.evaluate((baseUrl: string) => {
        const images: { url: string; alt: string }[] = [];

        document.querySelectorAll('img').forEach(img => {
          let src = img.src || img.getAttribute('data-src') || '';
          if (!src || src.startsWith('data:')) return;

          // Convert relative to absolute
          if (src.startsWith('/')) {
            src = new URL(baseUrl).origin + src;
          }

          images.push({ url: src, alt: img.alt || '' });
        });

        // Also get background images
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bgImage = style.backgroundImage;
          if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
            const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (match && match[1] && !match[1].startsWith('data:')) {
              let imgUrl = match[1];
              if (imgUrl.startsWith('/')) {
                imgUrl = new URL(baseUrl).origin + imgUrl;
              }
              images.push({ url: imgUrl, alt: 'background' });
            }
          }
        });

        // Deduplicate
        const seen = new Set<string>();
        return images.filter(img => {
          if (seen.has(img.url)) return false;
          seen.add(img.url);
          return true;
        });
      }, url);

      const downloadedAssets: ExtractedAsset[] = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const img = imageUrls[i];
        try {
          const imgUrl = new URL(img.url);
          let ext = path.extname(imgUrl.pathname) || '.jpg';
          if (ext.includes('?')) ext = ext.split('?')[0];
          const filename = `image-${i + 1}${ext}`;
          const localPath = path.join(tempDir, 'images', filename);

          const response = await axios.get(img.url, {
            responseType: 'arraybuffer',
            timeout: 15000,
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });

          fs.writeFileSync(localPath, response.data);
          downloadedAssets.push({
            type: 'image',
            originalUrl: img.url,
            localPath: `images/${filename}`,
            filename
          });
        } catch (e) {
          console.warn(`⚠️ Failed to download: ${img.url}`);
        }
      }

      // ========================================================================
      // 7. EXTRACT SVGs INLINE
      // ========================================================================
      console.log('🔷 [WEBSITE IMPORT] Extracting SVGs...');

      const svgs = await page.evaluate(() => {
        const svgList: { html: string; id?: string }[] = [];
        document.querySelectorAll('svg').forEach((svg, i) => {
          svgList.push({
            html: svg.outerHTML,
            id: svg.id || `svg-${i + 1}`
          });
        });
        return svgList;
      });

      svgs.forEach((svg, i) => {
        const filename = `${svg.id || `svg-${i + 1}`}.svg`;
        fs.writeFileSync(path.join(tempDir, 'svgs', filename), svg.html);
        downloadedAssets.push({
          type: 'svg',
          originalUrl: '',
          localPath: `svgs/${filename}`,
          filename
        });
      });

      // ========================================================================
      // 8. EXTRACT METADATA
      // ========================================================================
      const metadata = await page.evaluate(() => {
        return {
          title: document.title || '',
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
          favicon: document.querySelector('link[rel*="icon"]')?.getAttribute('href') || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''
        };
      });

      // ========================================================================
      // 9. CREATE COMPREHENSIVE MANIFEST
      // ========================================================================
      console.log('📋 [WEBSITE IMPORT] Creating manifest...');

      const manifest: CloneManifest = {
        version: '2.0',
        metadata: {
          sourceUrl: url,
          analyzedAt: new Date().toISOString(),
          title: metadata.title,
          description: metadata.description,
          favicon: metadata.favicon,
          viewport: { width: 1920, height: 1080 },
          fullPageHeight
        },
        colorPalette: {
          primary: designTokens.colors.slice(0, 5),
          background: designTokens.bgColors.slice(0, 5),
          text: designTokens.colors.slice(0, 3),
          accent: designTokens.colors.slice(5, 8)
        },
        typography: {
          fonts: designTokens.fonts,
          googleFonts: designTokens.googleFonts,
          headingSizes: designTokens.fontSizes.filter(s => parseInt(s) >= 24),
          bodySizes: designTokens.fontSizes.filter(s => parseInt(s) < 24)
        },
        assets: {
          images: downloadedAssets.filter(a => a.type === 'image'),
          fonts: [],
          svgs: downloadedAssets.filter(a => a.type === 'svg')
        },
        structure: {
          hasHeader: !!elementTree?.children?.find((c: any) => c.tag === 'header'),
          hasFooter: !!elementTree?.children?.find((c: any) => c.tag === 'footer'),
          hasNavigation: !!elementTree?.children?.find((c: any) => c.tag === 'nav'),
          sectionCount: elementTree?.children?.filter((c: any) => c.tag === 'section').length || 0,
          layoutType: 'complex'
        }
      };

      fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      // ========================================================================
      // 10. CREATE CLONE INSTRUCTIONS FILE FOR AI
      // ========================================================================
      const cloneInstructions = `# Website Clone Data

## Source: ${url}
## Analyzed: ${new Date().toISOString()}

## Files Structure:
- \`manifest.json\` - Overview, colors, fonts, structure info
- \`website-screenshot.png\` - Full-page screenshot for visual reference
- \`source/index.html\` - Clean HTML source
- \`source/styles.css\` - All CSS rules extracted
- \`source/elements.json\` - Complete element tree with computed styles, positions, and animations
- \`source/design-tokens.json\` - Colors, fonts, sizes used
- \`images/\` - All downloaded images
- \`svgs/\` - All SVG icons/graphics

## How to Clone:
1. Look at \`website-screenshot.png\` for the exact visual target
2. Use \`source/elements.json\` to understand the exact layout, spacing, and styles
3. Reference \`source/styles.css\` for CSS patterns and animations
4. Use images from \`images/\` folder (update paths in your code)
5. Use \`source/design-tokens.json\` for consistent colors and typography

## Key Design Tokens:
- Fonts: ${designTokens.fonts.join(', ')}
- Google Fonts: ${designTokens.googleFonts.length > 0 ? 'Yes' : 'No'}
- Total Images: ${downloadedAssets.filter(a => a.type === 'image').length}
- Total SVGs: ${svgs.length}

## Notes:
- Element positions in elements.json are pixel values at 1920x1080 viewport
- Animation data includes Framer Motion, AOS, and CSS animations
- Some external stylesheets may be CORS-blocked (noted in styles.css)
`;

      fs.writeFileSync(path.join(tempDir, 'CLONE_README.md'), cloneInstructions);

      await browser.close();

      console.log('✅ [WEBSITE IMPORT] Extraction complete!');

      return {
        success: true,
        tempProjectId,
        tempDir,
        stats: {
          sections: manifest.structure.sectionCount,
          images: downloadedAssets.filter(a => a.type === 'image').length,
          svgs: svgs.length,
          hasAnimations: true,
          fullPageHeight
        }
      };

    } catch (error) {
      console.error('❌ [WEBSITE IMPORT] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  });

  // Get import addendum prompt from file
  ipcMain.handle('prompts:get-import-addendum', async (_event, importType: string) => {
    try {
      const promptFiles: Record<string, string> = {
        'clone': 'clone-website.txt',
        'screenshot': 'screenshot-website.txt',
        'ai': 'ai-redesign-website.txt',
        'template': 'ai-redesign-website.txt' // fallback
      };

      const promptFile = promptFiles[importType] || promptFiles['ai'];

      // Try multiple paths (for dev and production)
      const appPath = app.getAppPath();
      const possiblePaths = [
        path.join(appPath, 'electron/prompts', promptFile),
        path.join(appPath, 'dist-electron/prompts', promptFile),
        path.join(appPath, '../electron/prompts', promptFile),
        path.join(process.cwd(), 'electron/prompts', promptFile)
      ];

      for (const promptPath of possiblePaths) {
        if (fs.existsSync(promptPath)) {
          const content = fs.readFileSync(promptPath, 'utf-8');
          return { success: true, content };
        }
      }

      // File not found - return empty (user will create them)
      return {
        success: true,
        content: '' // Empty string - prompts don't exist yet
      };
    } catch (error) {
      console.error('❌ [PROMPTS] Error loading import addendum:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}
