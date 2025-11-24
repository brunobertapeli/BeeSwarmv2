# Image Editor Modal - Overview

## What is this?

The **Image Editor Modal** is a full-blown image editing component integrated into the BeeSwarm application. It allows users to edit images from their project's assets folder directly within the app, without needing external tools.

## How to Access

1. Open the **Project Assets Widget** (hotkey: `F`)
2. Right-click on any image file
3. Select **"Edit Image"** from the context menu
4. The editor modal opens in full-screen mode

## Current Implementation

### ✅ What's Working

**Core Infrastructure:**
- Full-screen editor modal (95vw × 95vh)
- Fabric.js v6 integration for canvas-based image manipulation
- Image loading and display with automatic centering
- Responsive canvas that adapts to window resizing

**Zoom & Navigation:**
- Zoom In/Out buttons (controls Fabric.js zoom)
- Reset Zoom (returns to default view)
- Fit to Screen (scales image to 90% of canvas)
- Dynamic zoom percentage display
- Scroll wheel zoom (built-in Fabric.js feature)
- Pan/Drag functionality (built-in Fabric.js feature)

**UI Layout:**
- **Left Sidebar**: Editing tools menu with placeholders
  - Resize (blue)
  - Crop (purple)
  - Effects (green)
  - Filters (orange)
  - Adjust (pink)
- **Center Canvas**: Fabric.js canvas with checkerboard transparency pattern
- **Right Sidebar**: History panel (placeholder)
- **Footer**: Cancel and Save Changes buttons

**Integration:**
- Modal freeze when editor opens (browser preview is hidden)
- Proper cleanup when modal closes
- Image data passed as base64 from ProjectAssetsWidget
- Image metadata (dimensions, path, name) available

### 🚧 What Needs Implementation

The foundation is complete, but **all editing features are placeholders**. Here's what needs to be built:

#### 1. Resize Tool
- Input fields for width/height
- Maintain aspect ratio checkbox
- Apply resize using Fabric.js:
  ```typescript
  img.scaleToWidth(newWidth)
  img.scaleToHeight(newHeight)
  canvas.renderAll()
  ```

#### 2. Crop Tool
- Visual crop overlay with draggable handles
- Preset aspect ratios (1:1, 16:9, 4:3, custom)
- Apply crop using Fabric.js:
  ```typescript
  img.set({ cropX: x, cropY: y, width: w, height: h })
  canvas.renderAll()
  ```

#### 3. Effects Tool
- Blur
- Sharpen
- Emboss
- Apply using Fabric.js filters:
  ```typescript
  const filter = new fabric.Image.filters.Blur({ blur: 0.5 })
  img.filters.push(filter)
  img.applyFilters()
  canvas.renderAll()
  ```

#### 4. Filters Tool
- Brightness
- Contrast
- Saturation
- Grayscale
- Sepia
- Invert
- Apply using Fabric.js filters (same as Effects)

#### 5. Adjust Tool
- Brightness slider (-100 to 100)
- Contrast slider (-100 to 100)
- Hue rotation slider (0 to 360)
- Exposure slider

#### 6. Save Functionality
- Export canvas to image data:
  ```typescript
  const dataURL = canvas.toDataURL('image/png')
  ```
- Send to Electron backend to save file
- Refresh browser preview after save
- Close modal

#### 7. History System
- Track all edits in an array
- Undo/Redo buttons
- Display edit history in right sidebar
- Reset to original functionality

## Technical Stack

- **Fabric.js v6**: Canvas manipulation library
  - Docs: https://fabric5.fabricjs.com/docs/
  - Handles: canvas rendering, object manipulation, filters, transformations

- **React Hooks**: State management and lifecycle
  - `useRef`: Canvas and image object references
  - `useState`: Tool selection and canvas ready state
  - `useEffect`: Canvas initialization and cleanup

- **TypeScript**: Type safety for Fabric objects

## File Structure

```
src/components/
  ├── ImageEditorModal.tsx       # Main editor modal component
  └── ProjectAssetsWidget.tsx    # Launches editor via context menu

electron/handlers/
  └── fileHandlers.ts            # Backend file operations (read/save)
```

## Key Code References

### Canvas Initialization (ImageEditorModal.tsx:31-97)
```typescript
const canvas = new fabric.Canvas(canvasRef.current, {
  backgroundColor: '#1a1a1a',
  preserveObjectStacking: true,
})

fabric.FabricImage.fromURL(imageSrc).then((img) => {
  imageObjectRef.current = img
  // Center and scale image
  canvas.add(img)
  canvas.renderAll()
})
```

### Zoom Controls (ImageEditorModal.tsx:131-189)
```typescript
const handleZoomIn = () => {
  const canvas = fabricCanvasRef.current
  if (!canvas) return
  const zoom = canvas.getZoom()
  canvas.setZoom(Math.min(zoom * 1.2, 5))
}
```

### Opening Editor (ProjectAssetsWidget.tsx:301-323)
```typescript
case 'edit-image':
  const fileData = await window.electronAPI?.files?.readFileAsBase64?.(contextMenu.filePath)
  setEditorModal({
    open: true,
    file: contextMenu.file,
    filePath: contextMenu.filePath,
    src: `data:${mimeType};base64,${fileData}`
  })
```

## Next Steps

1. **Implement Resize Tool** - Start with the simplest editing feature
2. **Implement Filters** - Use Fabric.js built-in filters (brightness, contrast, etc.)
3. **Implement Crop Tool** - Add visual crop overlay
4. **Implement Save** - Export canvas and save to disk via Electron
5. **Add History** - Track edits for undo/redo
6. **Polish UI** - Add loading states, error handling, tooltips

## Resources

- **Fabric.js Filters**: https://fabric5.fabricjs.com/docs/api/namespaces/filters/
- **Fabric.js Canvas**: https://fabric5.fabricjs.com/docs/api/classes/Canvas/
- **Fabric.js Image**: https://fabric5.fabricjs.com/docs/api/classes/FabricImage/

## Notes

- The editor uses **modal freeze** - when opened, the browser preview is frozen as a screenshot to prevent flickering
- All zoom/pan operations work immediately thanks to Fabric.js
- Image transformations are **non-destructive** until "Save Changes" is clicked
- The canvas adapts to window resizing automatically
