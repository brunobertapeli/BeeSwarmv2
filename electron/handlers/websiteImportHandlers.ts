import { ipcMain, app } from 'electron';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { getCurrentUserId } from '../main';

interface ImageData {
  id: string;
  role: 'logo' | 'hero' | 'icon' | 'illustration' | 'photo' | 'background' | 'other';
  url: string;
  alt: string;
  localPath: string;
}

interface SectionData {
  id: string;
  type: string;
  order: number;
  content: {
    heading?: string;
    subheading?: string;
    paragraphs: string[];
    lists: string[];
    cta?: { text: string; url: string };
  };
  images: ImageData[];
}

interface ManifestData {
  config?: {
    importType: 'template' | 'screenshot' | 'ai';
  };
  metadata: {
    sourceUrl: string;
    analyzedAt: string;
    title: string;
    description: string;
  };
  sections: SectionData[];
  navigation: {
    items: Array<{ label: string; url: string }>;
  };
  footer: {
    content: string;
    links: Array<{ label: string; url: string }>;
  };
}

/**
 * Register website import IPC handlers
 */
export function registerWebsiteImportHandlers(): void {
  // Check if a project is a website import and if migration is completed
  ipcMain.handle('website-import:check-status', async (_event, projectId: string) => {
    try {
      const { databaseService } = await import('../services/DatabaseService');
      const project = databaseService.getProjectById(projectId);

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      const manifestPath = path.join(project.path, 'website-import', 'manifest.json');
      const migrationCompletePath = path.join(project.path, 'website-import', '.migration-completed');

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

      // Check if migration is completed
      const migrationCompleted = fs.existsSync(migrationCompletePath);

      console.log(`📦 [WEBSITE IMPORT] Status check for ${projectId}:`);
      console.log(`   - Is Import: true`);
      console.log(`   - Import Type: ${importType}`);
      console.log(`   - Migration Completed: ${migrationCompleted}`);

      return {
        success: true,
        isImport: true,
        importType,
        migrationCompleted,
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
      const { databaseService } = await import('../services/DatabaseService');
      const project = databaseService.getProjectById(projectId);

      if (!project) {
        return {
          success: false,
          error: 'Project not found'
        };
      }

      const migrationCompletePath = path.join(project.path, 'website-import', '.migration-completed');

      // Create the flag file
      fs.writeFileSync(migrationCompletePath, new Date().toISOString());

      console.log('✅ [WEBSITE IMPORT] Migration marked as complete for:', projectId);

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
        console.log('🗑️ [WEBSITE IMPORT] Cleaned up temp directory:', tempProjectId);
        return { success: true };
      } else {
        console.log('⚠️ [WEBSITE IMPORT] Temp directory not found:', tempProjectId);
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

    console.log('🌐 [WEBSITE IMPORT] Starting analysis');
    console.log('🌐 [WEBSITE IMPORT] URL:', url);
    console.log('🌐 [WEBSITE IMPORT] Temp Project ID:', tempProjectId);

    // Create temp directory
    const tempDir = path.join(
      app.getPath('home'),
      'Documents',
      'CodeDeck',
      userId,
      'temp',
      tempProjectId
    );

    try {
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('📁 [WEBSITE IMPORT] Created temp directory:', tempDir);
      }

      // Create images subdirectory
      const imagesDir = path.join(tempDir, 'images');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
      }

      console.log('🚀 [WEBSITE IMPORT] Launching Puppeteer...');
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1920, height: 1080 });

      console.log('📄 [WEBSITE IMPORT] Navigating to website...');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

      console.log('🔍 [WEBSITE IMPORT] Extracting content...');

      // Extract page metadata
      const metadata = await page.evaluate(() => {
        return {
          title: document.title || '',
          description: document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
        };
      });

      console.log('📝 [WEBSITE IMPORT] Extracted metadata:', metadata);

      // Extract all images
      console.log('🖼️ [WEBSITE IMPORT] Extracting images...');
      const images = await page.evaluate((baseUrl: string) => {
        const imageElements = Array.from(document.querySelectorAll('img'));
        const extractedImages: Array<{ url: string; alt: string; role: string }> = [];

        imageElements.forEach((img, index) => {
          let src = img.src || img.getAttribute('data-src') || '';

          // Skip data URLs and empty sources
          if (!src || src.startsWith('data:')) return;

          // Convert relative URLs to absolute
          if (src.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            src = urlObj.origin + src;
          }

          // Determine role based on context
          let role = 'other';
          const alt = img.alt || '';
          const className = img.className.toLowerCase();
          const parentElement = img.parentElement;

          if (className.includes('logo') || alt.toLowerCase().includes('logo')) {
            role = 'logo';
          } else if (className.includes('hero') || parentElement?.className.toLowerCase().includes('hero')) {
            role = 'hero';
          } else if (className.includes('icon') || img.width < 100 || img.height < 100) {
            role = 'icon';
          } else if (className.includes('background')) {
            role = 'background';
          }

          extractedImages.push({
            url: src,
            alt: alt,
            role: role
          });
        });

        return extractedImages;
      }, url);

      console.log(`🖼️ [WEBSITE IMPORT] Found ${images.length} images`);

      // Download images
      console.log('⬇️ [WEBSITE IMPORT] Downloading images...');
      const downloadedImages: ImageData[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        try {
          const imageUrl = new URL(image.url);
          const ext = path.extname(imageUrl.pathname) || '.jpg';
          const filename = `image-${i + 1}${ext}`;
          const localPath = path.join(imagesDir, filename);

          // Download image
          const response = await axios.get(image.url, {
            responseType: 'arraybuffer',
            timeout: 10000,
            maxRedirects: 5
          });

          fs.writeFileSync(localPath, response.data);

          downloadedImages.push({
            id: `img-${i + 1}`,
            role: image.role as any,
            url: image.url,
            alt: image.alt,
            localPath: `images/${filename}`
          });

          console.log(`✅ [WEBSITE IMPORT] Downloaded: ${filename}`);
        } catch (error) {
          console.warn(`⚠️ [WEBSITE IMPORT] Failed to download image: ${image.url}`, error);
        }
      }

      console.log(`✅ [WEBSITE IMPORT] Downloaded ${downloadedImages.length}/${images.length} images`);

      // Extract sections and content
      console.log('📋 [WEBSITE IMPORT] Extracting sections...');
      const sections = await page.evaluate(() => {
        const extractedSections: any[] = [];

        // Find main content sections
        const sectionElements = Array.from(document.querySelectorAll('section, [class*="section"], main > div, article'));

        sectionElements.forEach((section, index) => {
          // Extract headings
          const h1 = section.querySelector('h1, .h1, [class*="heading-1"]')?.textContent?.trim();
          const h2 = section.querySelector('h2, .h2, [class*="heading-2"]')?.textContent?.trim();
          const heading = h1 || h2;

          // Extract subheading
          const h3 = section.querySelector('h3, .h3, [class*="subheading"]')?.textContent?.trim();

          // Extract paragraphs
          const paragraphs = Array.from(section.querySelectorAll('p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 20);

          // Extract lists
          const lists = Array.from(section.querySelectorAll('li'))
            .map(li => li.textContent?.trim())
            .filter(text => text && text.length > 0);

          // Extract CTA button
          const button = section.querySelector('button, a[class*="button"], a[class*="btn"], .cta');
          const cta = button ? {
            text: button.textContent?.trim() || '',
            url: (button as HTMLAnchorElement).href || ''
          } : undefined;

          // Determine section type based on content and position
          let type = 'content';
          const sectionClass = section.className.toLowerCase();

          if (index === 0 || sectionClass.includes('hero') || sectionClass.includes('banner')) {
            type = 'hero';
          } else if (sectionClass.includes('feature')) {
            type = 'features';
          } else if (sectionClass.includes('testimonial') || sectionClass.includes('review')) {
            type = 'testimonials';
          } else if (sectionClass.includes('pricing') || sectionClass.includes('plan')) {
            type = 'pricing';
          } else if (sectionClass.includes('cta') || sectionClass.includes('call-to-action')) {
            type = 'cta';
          } else if (sectionClass.includes('gallery')) {
            type = 'gallery';
          }

          // Only include sections with meaningful content
          if (heading || paragraphs.length > 0 || lists.length > 0) {
            extractedSections.push({
              id: `section-${index + 1}`,
              type: type,
              order: index + 1,
              content: {
                heading: heading,
                subheading: h3,
                paragraphs: paragraphs,
                lists: lists,
                cta: cta
              }
            });
          }
        });

        return extractedSections;
      });

      console.log(`📋 [WEBSITE IMPORT] Extracted ${sections.length} sections`);

      // Extract navigation
      console.log('🧭 [WEBSITE IMPORT] Extracting navigation...');
      const navigation = await page.evaluate(() => {
        const nav = document.querySelector('nav, header nav, [role="navigation"]');
        const items: Array<{ label: string; url: string }> = [];

        if (nav) {
          const links = Array.from(nav.querySelectorAll('a'));
          links.forEach(link => {
            const label = link.textContent?.trim();
            const url = link.href;
            if (label && url) {
              items.push({ label, url });
            }
          });
        }

        return { items };
      });

      console.log(`🧭 [WEBSITE IMPORT] Extracted ${navigation.items.length} navigation items`);

      // Extract footer
      console.log('🦶 [WEBSITE IMPORT] Extracting footer...');
      const footer = await page.evaluate(() => {
        const footerEl = document.querySelector('footer, [role="contentinfo"]');
        const links: Array<{ label: string; url: string }> = [];
        let content = '';

        if (footerEl) {
          content = footerEl.textContent?.trim() || '';
          const footerLinks = Array.from(footerEl.querySelectorAll('a'));
          footerLinks.forEach(link => {
            const label = link.textContent?.trim();
            const url = link.href;
            if (label && url) {
              links.push({ label, url });
            }
          });
        }

        return { content, links };
      });

      console.log('✅ [WEBSITE IMPORT] Footer extracted');

      // Assign images to sections (distribute downloaded images across sections)
      const sectionsWithImages = sections.map((section, index) => {
        // Assign relevant images to each section
        const sectionImages = downloadedImages.filter(img => {
          if (section.type === 'hero' && img.role === 'hero') return true;
          if (section.type === 'hero' && img.role === 'logo' && index === 0) return true;
          return false;
        });

        return {
          ...section,
          images: sectionImages
        };
      });

      // Add remaining images to an "other" section or distribute them
      const assignedImageIds = new Set(sectionsWithImages.flatMap(s => s.images.map(img => img.id)));
      const unassignedImages = downloadedImages.filter(img => !assignedImageIds.has(img.id));

      if (unassignedImages.length > 0 && sectionsWithImages.length > 0) {
        // Distribute unassigned images across sections
        unassignedImages.forEach((img, idx) => {
          const sectionIdx = idx % sectionsWithImages.length;
          sectionsWithImages[sectionIdx].images.push(img);
        });
      }

      // Create manifest
      const manifest: ManifestData = {
        metadata: {
          sourceUrl: url,
          analyzedAt: new Date().toISOString(),
          title: metadata.title,
          description: metadata.description
        },
        sections: sectionsWithImages,
        navigation: navigation,
        footer: footer
      };

      // Save manifest
      const manifestPath = path.join(tempDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('💾 [WEBSITE IMPORT] Saved manifest.json');

      // Close browser
      await browser.close();
      console.log('✅ [WEBSITE IMPORT] Analysis complete!');

      return {
        success: true,
        tempProjectId: tempProjectId,
        tempDir: tempDir,
        stats: {
          sections: sections.length,
          images: downloadedImages.length,
          navigationItems: navigation.items.length
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
}
