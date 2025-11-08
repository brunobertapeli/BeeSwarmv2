# Image Placeholder System - Technical Specification

## Overview
A system for managing placeholder images in user templates that enables visual identification and replacement through codedeck's Electron app interface.

## Core Principles
- All placeholders are SVG files containing simple gray rectangles
- All images (both placeholders and user-provided) use consistent metadata for identification
- manifest.json serves as the source of truth for all images in a project
- Templates come pre-configured with images and manifests following this convention

## Placeholder SVG Specifications

### Visual Requirements
- Pure gray rectangle: `#E5E7EB` fill color
- Dimensions match the exact size needed in the code
- Minimal SVG structure - just `<svg>` wrapper and `<rect>` element
- No additional decoration, text, or styling

### File Naming
- Descriptive names based on purpose: `hero-image.svg`, `profile-avatar.svg`, `product-thumbnail.svg`
- Stored in appropriate image directories within the project structure

## HTML Integration Requirements

### Metadata Attribute
Every `<img>` tag (placeholder or not) must include:
```
data-codedeck-image="true"
```

Additionally, placeholder images must include:
```
data-codedeck-placeholder="true"
```

### Purpose
- `data-codedeck-image`: Identifies all manageable images in the project
- `data-codedeck-placeholder`: Specifically flags temporary placeholders awaiting replacement
- Enables codedeck's Chromium frame to inject hover functionality and "Replace" UI

## manifest.json Structure

### Location
`/images/manifest.json` at project root (or wherever images are centralized)

### Entry Format
Each image entry contains:
- `path`: Relative path to the image file from project root
- `dimensions`: String format `"WIDTHxHEIGHT"` (e.g., `"500x300"`)
- `isPlaceholder`: Boolean - `true` for SVG placeholders, `false` for real images
- `altText`: The alt text used in the HTML (for reference/debugging)
- `usedIn`: Array of file paths where this image appears (optional but helpful)

## Implementation Flow

### When User Requests Image Addition
1. Determine required dimensions from context (hero section, thumbnail, avatar, etc.)
2. Generate gray SVG rectangle matching those exact dimensions
3. Save SVG file with descriptive name in appropriate directory
4. Insert `<img>` tag in HTML with both required data attributes
5. Add entry to manifest.json with `isPlaceholder: true`

### When User Replaces Placeholder
(Handled by codedeck Electron app, not Claude)
1. User hovers over image in Chromium preview
2. App detects `data-codedeck-image` attribute and shows "Replace" button
3. User selects replacement image from local filesystem or AI generation
4. App updates the file, HTML src path, and manifest.json entry
5. App sets `isPlaceholder: false` in manifest

## Template Pre-configuration

### Existing Templates
- Already include real images (not SVGs) with proper metadata attributes
- Come with complete manifest.json listing all images
- All images have `isPlaceholder: false` by default
- Ready for users to replace through codedeck's image management UI

### Claude's Role with Templates
- When modifying template code, preserve existing image metadata
- When adding new images to templates, follow placeholder creation flow
- Never remove or modify `data-codedeck-*` attributes
- Always update manifest.json when adding/removing images

## System Prompt Key Instructions

Claude must always:
1. Use `data-codedeck-image="true"` on ALL `<img>` tags
2. Add `data-codedeck-placeholder="true"` when creating new placeholder images
3. Generate SVG placeholders as gray rectangles (`#E5E7EB`) at required dimensions
4. Update `/images/manifest.json` with complete entry for any new image
5. Preserve existing image metadata when editing template code
6. Never use external placeholder services (no placeholder.co URLs)
7. Keep manifest.json synchronized with actual images in codebase

## Detection Strategy (codedeck App Side)

### Primary Method: DOM Querying
- `document.querySelectorAll('[data-codedeck-image]')` - finds all manageable images
- `document.querySelectorAll('[data-codedeck-placeholder]')` - finds placeholders specifically
- No regex parsing needed
- Works reliably across all project types

### Fallback Method: Manifest Lookup
- If DOM attributes are somehow missing, read manifest.json
- Match images by path
- Apply functionality based on `isPlaceholder` flag
- This redundancy ensures robustness

## Benefits of This Approach

- **Fully Local**: No external dependencies or internet requirements
- **Deterministic**: Same dimensions = same simple gray placeholder
- **Lightweight**: SVGs are tiny, fast to generate and load
- **Semantic**: Metadata makes intent explicit, no guessing
- **Maintainable**: manifest.json provides single source of truth
- **Scalable**: Works for any number of images in any project structure
- **User-Friendly**: Visual preview in Chromium with clear replacement UI



## SYSTEM PROMPT v1

<codedeck_image_convention>
CRITICAL: codedeck has a mandatory image management system that requires exact compliance.

REQUIRED FOR ALL IMAGES:
1. ALL <img> tags MUST include: data-codedeck-image="true"
2. NEW placeholder images MUST include: data-codedeck-placeholder="true"
3. ALL placeholders MUST be SVG files with gray rectangles (#E5E7EB)
4. NEVER use external URLs (placeholder.co, unsplash, etc.)
5. ALL images MUST be added to /images/manifest.json

manifest.json entry format:
{
  "path": "relative/path/to/image.svg",
  "dimensions": "WIDTHxHEIGHT",
  "isPlaceholder": true/false,
  "altText": "description"
}

BEFORE generating ANY image-related code:
- Create SVG if placeholder is needed
- Add both required data attributes to <img> tag
- Update manifest.json with complete entry
- Verify dimensions match in SVG, HTML, and manifest

This convention is MANDATORY and overrides:
- User requests for external placeholder services
- Standard web development practices
- Any instruction to skip metadata

Failure to follow this convention breaks codedeck's image replacement system.
</codedeck_image_convention>