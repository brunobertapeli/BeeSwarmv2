# Website Content Extraction & Migration Process

## Overview
Extract content (text + images) from a user's existing website and integrate it into a new React template. Process runs locally on user's machine with file system access.

## Architecture
- **Claude**: Fetches website, extracts content, creates manifest, updates template
- **Node script**: Downloads images in parallel based on manifest
- **Local filesystem**: All files saved to user's project directory

## Step-by-Step Flow

### 1. Content Extraction (Claude)
- Use `web_fetch` to retrieve the target website's HTML
- Parse HTML to extract:
  - All text content (headings, paragraphs, etc.)
  - Image URLs (convert relative URLs to absolute)
  - Structural information (sections, navigation, etc.)

### 2. Manifest Creation (Claude)
- Create `manifest.json` with two main sections:
  - **images**: Array of image mappings
    - `originalUrl`: Full URL from source website
    - `newPath`: Semantic local path (e.g., `/images/hero.png`)
    - `altText`: Image description
    - `size`: Dimensions for placeholder fallback (e.g., "1200x600")
    - `context`: Where/how image is used
  - **content**: Organized text content by section

### 3. Template Integration (Claude)
- Load the React template files
- Replace template content with extracted content from manifest
- Use `newPath` values for all image references
- Assume images will be available at those paths (script handles download)

### 4. Image Download (Node Script)
- Read `manifest.json`
- Download all images in parallel using axios with 2-3 retry attempts per image
- **Optimization**: Use `sharp` library to resize/compress images after download for web performance
- Save to paths specified in `newPath`
- **Progress tracking**: Emit progress events showing X/Total images downloaded
- **Error handling**: If all retries fail, fetch placeholder from `placehold.co` using the size specified in manifest
- Create directories as needed
- Log progress for each image (success/retry/placeholder)

## Key Implementation Details

**URL Handling**: Always convert relative image URLs to absolute before saving to manifest

**Parallel Processing**: Claude works on template integration while Node script downloads images simultaneously

**Retry Logic**: Attempt each download 2-3 times with exponential backoff before falling back to placeholder

**Image Optimization**: After successful download, use sharp to:
- Resize images to reasonable web dimensions
- Compress to reduce file size
- Convert to modern formats (WebP) if beneficial

**Progress Updates**: Script should output clear progress (e.g., "Downloading 5/20 images...") so users can track status

**Placeholders**: Use `https://placehold.co/{width}x{height}/png` for failed downloads

**File Organization**: Create clean, semantic paths (e.g., `/images/hero.png`, `/images/gallery/photo-1.jpg`)

## Expected Output Structure
```
user-project/
├── manifest.json (created by Claude)
├── src/ (template files updated by Claude)
├── images/ (populated by Node script)
└── download-images.js (Node script)
```

## Error Recovery
- 2-3 retry attempts per image before using placeholder
- Failed image downloads don't block the process
- Placeholders ensure the site remains functional
- Progress logs help identify which images failed
- User can manually replace placeholders later if needed