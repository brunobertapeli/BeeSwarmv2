import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Crop, Palette, SlidersHorizontal, RotateCw, FlipHorizontal, FlipVertical, Sun, Contrast, Droplets, CircleDot, Link, Unlink, Check, Square, RectangleHorizontal, RectangleVertical, Smartphone, Move, Undo2, Scan, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { ModalPortal } from './ModalPortal'
import * as fabric from 'fabric'

interface ImageEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
  imageSrc: string
  imageWidth?: number
  imageHeight?: number
  imagePath?: string
  imageName?: string
}

type EditorTool = 'resize' | 'crop' | 'filters' | 'adjust' | 'blur' | null

interface BlurRegion {
  id: string
  x: number
  y: number
  width: number
  height: number
  intensity: number
}

interface AdjustmentValues {
  brightness: number
  contrast: number
  saturation: number
  hue: number
}

interface FilterValues {
  grayscale: boolean
  sepia: boolean
  invert: boolean
  blur: number
  sharpen: boolean
  emboss: boolean
  vintage: boolean
  warmth: number
}

interface ResizeValues {
  width: number
  height: number
  lockAspectRatio: boolean
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

type AspectRatioPreset = 'free' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

interface HistoryState {
  adjustments: AdjustmentValues
  filters: FilterValues
  resize: ResizeValues
  rotation: number
  flipX: boolean
  flipY: boolean
  cropX?: number
  cropY?: number
  width?: number
  height?: number
  blurRegions?: BlurRegion[]
  // Store image data URL for operations that modify the image pixels (like blur apply)
  imageDataURL?: string
  scaleX?: number
  scaleY?: number
}

const defaultAdjustments: AdjustmentValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
}

const defaultFilters: FilterValues = {
  grayscale: false,
  sepia: false,
  invert: false,
  blur: 0,
  sharpen: false,
  emboss: false,
  vintage: false,
  warmth: 0,
}

// Box blur helper function for localized blur
function applyBoxBlur(imageData: ImageData, intensity: number): ImageData {
  const { data, width, height } = imageData
  const output = new ImageData(width, height)
  const outputData = output.data

  // Blur radius based on intensity (1-50 pixels)
  const radius = Math.max(1, Math.min(50, Math.round(intensity / 2)))

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0

      // Sample pixels in the blur radius
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const idx = (ny * width + nx) * 4
            r += data[idx]
            g += data[idx + 1]
            b += data[idx + 2]
            a += data[idx + 3]
            count++
          }
        }
      }

      const outIdx = (y * width + x) * 4
      outputData[outIdx] = Math.round(r / count)
      outputData[outIdx + 1] = Math.round(g / count)
      outputData[outIdx + 2] = Math.round(b / count)
      outputData[outIdx + 3] = Math.round(a / count)
    }
  }

  return output
}

// Crop Overlay Component
interface CropOverlayProps {
  cropArea: CropArea
  setCropArea: (area: CropArea) => void
  imageObject: fabric.FabricImage
  canvas: fabric.Canvas | null
  aspectRatioPreset: AspectRatioPreset
}

function CropOverlay({ cropArea, setCropArea, imageObject, canvas, aspectRatioPreset }: CropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 })

  // Get the actual pixel-to-screen scale
  // cropArea is in ORIGINAL image pixel coordinates (before any scaling)
  const getImageScreenBounds = useCallback(() => {
    if (!canvas || !imageObject) return { left: 0, top: 0, scaleX: 1, scaleY: 1 }

    const zoom = canvas.getZoom()
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]

    // Image position and scale
    const imgLeft = imageObject.left || 0
    const imgTop = imageObject.top || 0
    const imgScaleX = imageObject.scaleX || 1
    const imgScaleY = imageObject.scaleY || 1
    const imgWidth = imageObject.width || 0
    const imgHeight = imageObject.height || 0

    // The image is centered (originX/Y = 'center'), so top-left corner is:
    const imgTopLeftX = imgLeft - (imgWidth * imgScaleX) / 2
    const imgTopLeftY = imgTop - (imgHeight * imgScaleY) / 2

    // Apply canvas zoom and viewport transform
    const screenLeft = imgTopLeftX * zoom + vpt[4]
    const screenTop = imgTopLeftY * zoom + vpt[5]

    // Total scale from original pixels to screen pixels
    const totalScaleX = imgScaleX * zoom
    const totalScaleY = imgScaleY * zoom

    return {
      left: screenLeft,
      top: screenTop,
      scaleX: totalScaleX,
      scaleY: totalScaleY,
    }
  }, [canvas, imageObject])

  // Convert crop area (in original image coordinates) to screen coordinates
  const getCropScreenPosition = useCallback(() => {
    const bounds = getImageScreenBounds()

    return {
      left: bounds.left + cropArea.x * bounds.scaleX,
      top: bounds.top + cropArea.y * bounds.scaleY,
      width: cropArea.width * bounds.scaleX,
      height: cropArea.height * bounds.scaleY,
    }
  }, [getImageScreenBounds, cropArea])

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.preventDefault()
    e.stopPropagation()

    if (handle) {
      setIsResizing(handle)
    } else {
      setIsDragging(true)
    }

    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropX: cropArea.x,
      cropY: cropArea.y,
      cropW: cropArea.width,
      cropH: cropArea.height,
    })
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isResizing) return

    const bounds = getImageScreenBounds()
    const imgWidth = imageObject.width || 100
    const imgHeight = imageObject.height || 100

    // Convert screen delta to original image coordinates
    const deltaX = (e.clientX - dragStart.x) / bounds.scaleX
    const deltaY = (e.clientY - dragStart.y) / bounds.scaleY

    if (isDragging) {
      // Move the crop area
      let newX = dragStart.cropX + deltaX
      let newY = dragStart.cropY + deltaY

      // Clamp to image bounds
      newX = Math.max(0, Math.min(newX, imgWidth - cropArea.width))
      newY = Math.max(0, Math.min(newY, imgHeight - cropArea.height))

      setCropArea({ ...cropArea, x: newX, y: newY })
    } else if (isResizing) {
      let newX = dragStart.cropX
      let newY = dragStart.cropY
      let newW = dragStart.cropW
      let newH = dragStart.cropH

      // Handle resize based on which handle is being dragged
      const aspectRatio = getAspectRatioValue(aspectRatioPreset)

      if (isResizing.includes('e')) {
        newW = Math.max(20, dragStart.cropW + deltaX)
        if (aspectRatio) newH = newW / aspectRatio
      }
      if (isResizing.includes('w')) {
        const widthDelta = -deltaX
        newW = Math.max(20, dragStart.cropW + widthDelta)
        newX = dragStart.cropX - widthDelta
        if (aspectRatio) newH = newW / aspectRatio
      }
      if (isResizing.includes('s')) {
        newH = Math.max(20, dragStart.cropH + deltaY)
        if (aspectRatio) newW = newH * aspectRatio
      }
      if (isResizing.includes('n')) {
        const heightDelta = -deltaY
        newH = Math.max(20, dragStart.cropH + heightDelta)
        newY = dragStart.cropY - heightDelta
        if (aspectRatio) newW = newH * aspectRatio
      }

      // Clamp to image bounds
      newX = Math.max(0, newX)
      newY = Math.max(0, newY)
      newW = Math.min(newW, imgWidth - newX)
      newH = Math.min(newH, imgHeight - newY)

      setCropArea({ x: newX, y: newY, width: newW, height: newH })
    }
  }, [isDragging, isResizing, dragStart, cropArea, setCropArea, aspectRatioPreset, imageObject, getImageScreenBounds])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  const getAspectRatioValue = (preset: AspectRatioPreset): number | null => {
    switch (preset) {
      case '1:1': return 1
      case '16:9': return 16 / 9
      case '9:16': return 9 / 16
      case '4:3': return 4 / 3
      case '3:4': return 3 / 4
      default: return null
    }
  }

  const screenPos = getCropScreenPosition()

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Dark overlay outside crop area */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <mask id="cropMask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={screenPos.left}
              y={screenPos.top}
              width={screenPos.width}
              height={screenPos.height}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.6)"
          mask="url(#cropMask)"
        />
      </svg>

      {/* Crop area with border */}
      <div
        className="absolute border-2 border-green-400 pointer-events-auto cursor-move"
        style={{
          left: screenPos.left,
          top: screenPos.top,
          width: screenPos.width,
          height: screenPos.height,
        }}
        onMouseDown={(e) => handleMouseDown(e)}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
        </div>

        {/* Resize handles */}
        {/* Corners */}
        <div
          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-green-500 cursor-nw-resize"
          onMouseDown={(e) => handleMouseDown(e, 'nw')}
        />
        <div
          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-green-500 cursor-ne-resize"
          onMouseDown={(e) => handleMouseDown(e, 'ne')}
        />
        <div
          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-green-500 cursor-sw-resize"
          onMouseDown={(e) => handleMouseDown(e, 'sw')}
        />
        <div
          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-green-500 cursor-se-resize"
          onMouseDown={(e) => handleMouseDown(e, 'se')}
        />

        {/* Edge handles */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-green-500 cursor-n-resize"
          onMouseDown={(e) => handleMouseDown(e, 'n')}
        />
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-green-500 cursor-s-resize"
          onMouseDown={(e) => handleMouseDown(e, 's')}
        />
        <div
          className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border border-green-500 cursor-w-resize"
          onMouseDown={(e) => handleMouseDown(e, 'w')}
        />
        <div
          className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border border-green-500 cursor-e-resize"
          onMouseDown={(e) => handleMouseDown(e, 'e')}
        />
      </div>
    </div>
  )
}

function ImageEditorModal({ isOpen, onClose, onSave, imageSrc, imageWidth, imageHeight, imagePath, imageName }: ImageEditorModalProps) {
  const { currentProjectId } = useAppStore()
  const { layoutState, setPreviewHidden } = useLayoutStore()

  // Hide/show preview when modal opens/closes
  useEffect(() => {
    if (!currentProjectId || layoutState !== 'DEFAULT') return

    if (isOpen) {
      window.electronAPI?.preview.hide(currentProjectId)
      setPreviewHidden(true)
    } else {
      window.electronAPI?.preview.show(currentProjectId)
      setPreviewHidden(false)
    }
  }, [isOpen, currentProjectId, layoutState, setPreviewHidden])

  const [selectedTool, setSelectedTool] = useState<EditorTool>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const imageObjectRef = useRef<fabric.FabricImage | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const isDisposedRef = useRef(false)

  // Editing state - "applied" values are committed, "pending" are for preview
  const [appliedAdjustments, setAppliedAdjustments] = useState<AdjustmentValues>(defaultAdjustments)
  const [pendingAdjustments, setPendingAdjustments] = useState<AdjustmentValues>(defaultAdjustments)
  const [appliedFilters, setAppliedFilters] = useState<FilterValues>(defaultFilters)
  const [pendingFilters, setPendingFilters] = useState<FilterValues>(defaultFilters)
  const [resize, setResize] = useState<ResizeValues>({ width: imageWidth || 0, height: imageHeight || 0, lockAspectRatio: true })
  const originalAspectRatio = useRef<number>(1)
  const [rotation, setRotation] = useState(0)
  const [flipX, setFlipX] = useState(false)
  const [flipY, setFlipY] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)

  // Crop state
  const [cropMode, setCropMode] = useState(false)
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 })
  const [aspectRatioPreset, setAspectRatioPreset] = useState<AspectRatioPreset>('free')

  // Store original image dimensions for reset
  const originalImageDimensions = useRef<{ width: number; height: number } | null>(null)

  // Blur regions state
  const [blurRegions, setBlurRegions] = useState<BlurRegion[]>([])
  const [blurIntensity, setBlurIntensity] = useState(20)
  const [isDrawingBlur, setIsDrawingBlur] = useState(false)
  const [blurDrawStart, setBlurDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentBlurRect, setCurrentBlurRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Undo history (last 5 states)
  const [history, setHistory] = useState<HistoryState[]>([])
  const MAX_HISTORY = 5

  // Save current state to history (including image data for pixel-modifying operations)
  const saveToHistory = useCallback((captureImageData: boolean = false) => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current

    let imageDataURL: string | undefined = undefined

    // Capture image data URL for operations that modify pixels
    if (captureImageData && img && canvas) {
      // Create a temporary canvas to capture the current image state
      const tempCanvas = document.createElement('canvas')
      const imgWidth = img.width || 100
      const imgHeight = img.height || 100
      tempCanvas.width = imgWidth
      tempCanvas.height = imgHeight

      const ctx = tempCanvas.getContext('2d')
      if (ctx) {
        const sourceElement = img.getElement() as HTMLImageElement
        if (sourceElement) {
          const cropX = img.cropX || 0
          const cropY = img.cropY || 0
          ctx.drawImage(sourceElement, cropX, cropY, imgWidth, imgHeight, 0, 0, imgWidth, imgHeight)
          imageDataURL = tempCanvas.toDataURL('image/png')
        }
      }
    }

    const currentState: HistoryState = {
      adjustments: { ...appliedAdjustments },
      filters: { ...appliedFilters },
      resize: { ...resize },
      rotation,
      flipX,
      flipY,
      cropX: img?.cropX,
      cropY: img?.cropY,
      width: img?.width,
      height: img?.height,
      blurRegions: [...blurRegions],
      imageDataURL,
      scaleX: img?.scaleX,
      scaleY: img?.scaleY,
    }

    setHistory(prev => {
      const newHistory = [...prev, currentState]
      // Keep only the last MAX_HISTORY states
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY)
      }
      return newHistory
    })
  }, [appliedAdjustments, appliedFilters, resize, rotation, flipX, flipY, blurRegions])

  // Undo to previous state
  const handleUndo = useCallback(async () => {
    if (history.length === 0) return

    const previousState = history[history.length - 1]
    const canvas = fabricCanvasRef.current

    if (!canvas) return

    // Restore state - filters will be reapplied by useEffect
    setAppliedAdjustments(previousState.adjustments)
    setPendingAdjustments(previousState.adjustments)
    setAppliedFilters(previousState.filters)
    setPendingFilters(previousState.filters)
    setResize(previousState.resize)
    setRotation(previousState.rotation)
    setFlipX(previousState.flipX)
    setFlipY(previousState.flipY)
    setBlurRegions(previousState.blurRegions || [])

    // If we have stored image data, restore the full image
    if (previousState.imageDataURL) {
      const oldImg = imageObjectRef.current
      const newImg = await fabric.FabricImage.fromURL(previousState.imageDataURL)

      newImg.set({
        left: oldImg?.left || canvas.width! / 2,
        top: oldImg?.top || canvas.height! / 2,
        originX: 'center',
        originY: 'center',
        scaleX: previousState.scaleX || 1,
        scaleY: previousState.scaleY || 1,
        angle: previousState.rotation,
        flipX: previousState.flipX,
        flipY: previousState.flipY,
        selectable: oldImg?.selectable ?? true,
        evented: oldImg?.evented ?? true,
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'grab',
        moveCursor: 'grabbing',
        cropX: previousState.cropX || 0,
        cropY: previousState.cropY || 0,
        width: previousState.width,
        height: previousState.height,
      })

      // Remove old image and add new one
      if (oldImg) canvas.remove(oldImg)
      canvas.add(newImg)
      canvas.setActiveObject(newImg)
      imageObjectRef.current = newImg
    } else {
      // Just restore properties on existing image
      const img = imageObjectRef.current
      if (img) {
        img.set({
          angle: previousState.rotation,
          flipX: previousState.flipX,
          flipY: previousState.flipY,
        })

        // Restore scale (for resize undo)
        if (previousState.scaleX !== undefined && previousState.scaleY !== undefined) {
          img.set({
            scaleX: previousState.scaleX,
            scaleY: previousState.scaleY,
          })
        }

        // Restore crop if it was set
        if (previousState.width !== undefined && previousState.height !== undefined) {
          img.set({
            cropX: previousState.cropX || 0,
            cropY: previousState.cropY || 0,
            width: previousState.width,
            height: previousState.height,
          })
        }
      }
    }

    canvas.renderAll()

    // Remove the last history entry
    setHistory(prev => prev.slice(0, -1))
  }, [history])

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return

    isDisposedRef.current = false

    // Create Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: false, // Disable group selection
    })

    fabricCanvasRef.current = canvas

    // Small delay to ensure container is properly sized by flexbox
    const initTimeout = setTimeout(() => {
      if (isDisposedRef.current) return

      // Set initial canvas dimensions from the container ref
      const container = canvasContainerRef.current
      if (container) {
        const width = container.offsetWidth || container.clientWidth || 800
        const height = container.offsetHeight || container.clientHeight || 600
        canvas.setWidth(width)
        canvas.setHeight(height)
      }

      // Load image
      fabric.FabricImage.fromURL(imageSrc).then((img) => {
        // Check if canvas was disposed during async load
        if (isDisposedRef.current || !canvas || !img) return

        imageObjectRef.current = img

        // Store original aspect ratio and dimensions
        originalAspectRatio.current = (img.width || 1) / (img.height || 1)
        originalImageDimensions.current = { width: img.width || 0, height: img.height || 0 }
        setResize({ width: img.width || 0, height: img.height || 0, lockAspectRatio: true })

        // Calculate scale to fit image in canvas (max 100% of original size)
        const fitScale = Math.min(
          (canvas.width! * 0.9) / (img.width || 1),
          (canvas.height! * 0.9) / (img.height || 1),
          1 // Never scale up beyond original size
        )

        // Make image movable but hide controls
        img.set({
          left: canvas.width! / 2,
          top: canvas.height! / 2,
          originX: 'center',
          originY: 'center',
          scaleX: fitScale,
          scaleY: fitScale,
          selectable: true,
          hasControls: false, // Hide resize handles
          hasBorders: false, // Hide selection border
          lockScalingX: true,
          lockScalingY: true,
          hoverCursor: 'grab',
          moveCursor: 'grabbing',
        })

        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()

        // Set zoom level to reflect the actual display scale
        setZoomLevel(Math.round(fitScale * 100))
        setIsCanvasReady(true)
      })
    }, 50) // Small delay for layout to settle

    // Mouse wheel zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY
      let zoom = canvas.getZoom()
      zoom *= 0.999 ** delta
      if (zoom > 5) zoom = 5
      if (zoom < 0.1) zoom = 0.1

      // Zoom to mouse point
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom)
      setZoomLevel(Math.round(zoom * 100))

      opt.e.preventDefault()
      opt.e.stopPropagation()
    })

    // Handle window resize
    const handleResize = () => {
      if (isDisposedRef.current) return
      const container = canvasContainerRef.current
      if (container && canvas) {
        canvas.setWidth(container.offsetWidth || container.clientWidth)
        canvas.setHeight(container.offsetHeight || container.clientHeight)
        canvas.renderAll()
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      isDisposedRef.current = true
      clearTimeout(initTimeout)
      window.removeEventListener('resize', handleResize)
      canvas.dispose()
      fabricCanvasRef.current = null
      imageObjectRef.current = null
      setIsCanvasReady(false)
    }
  }, [isOpen, imageSrc])

  // Disable image dragging when a tool is selected
  useEffect(() => {
    const img = imageObjectRef.current
    if (!img) return

    const toolActive = selectedTool !== null || cropMode
    img.set({
      selectable: !toolActive,
      evented: !toolActive,
      hoverCursor: toolActive ? 'default' : 'grab',
      moveCursor: toolActive ? 'default' : 'grabbing',
    })

    fabricCanvasRef.current?.renderAll()
  }, [selectedTool, cropMode])

  const handleClose = () => {
    // Reset all state for clean reopen
    setSelectedTool(null)
    setCropMode(false)
    setAppliedAdjustments(defaultAdjustments)
    setPendingAdjustments(defaultAdjustments)
    setAppliedFilters(defaultFilters)
    setPendingFilters(defaultFilters)
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setHistory([])
    setZoomLevel(100)
    setBlurRegions([])
    setIsDrawingBlur(false)
    setBlurDrawStart(null)
    setCurrentBlurRect(null)
    onClose()
  }

  const handleZoomIn = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const zoom = canvas.getZoom()
    const newZoom = Math.min(zoom * 1.2, 5)
    canvas.setZoom(newZoom)
    setZoomLevel(Math.round(newZoom * 100))
  }

  const handleZoomOut = () => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const zoom = canvas.getZoom()
    const newZoom = Math.max(zoom * 0.8, 0.1)
    canvas.setZoom(newZoom)
    setZoomLevel(Math.round(newZoom * 100))
  }

  const handleResetZoom = () => {
    const canvas = fabricCanvasRef.current
    const img = imageObjectRef.current
    if (!canvas || !img) return

    canvas.setZoom(1)
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0]
    setZoomLevel(100)

    const scale = Math.min(
      (canvas.width! * 0.8) / (img.width || 1),
      (canvas.height! * 0.8) / (img.height || 1)
    )

    img.set({
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      scaleX: scale,
      scaleY: scale,
    })

    canvas.renderAll()
  }

  const handleFitToScreen = () => {
    const canvas = fabricCanvasRef.current
    const img = imageObjectRef.current
    if (!canvas || !img) return

    const scale = Math.min(
      (canvas.width! * 0.9) / (img.width || 1),
      (canvas.height! * 0.9) / (img.height || 1)
    )

    img.set({
      left: canvas.width! / 2,
      top: canvas.height! / 2,
      scaleX: scale,
      scaleY: scale,
    })

    canvas.setZoom(1)
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0]
    setZoomLevel(100)
    canvas.renderAll()
  }

  // Apply all filters to image
  // Apply filters to canvas - uses pending values for live preview
  const applyFiltersToCanvas = useCallback(() => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    img.filters = []

    // Use pending values for live preview
    if (pendingAdjustments.brightness !== 0) {
      img.filters.push(new fabric.filters.Brightness({ brightness: pendingAdjustments.brightness / 100 }))
    }

    if (pendingAdjustments.contrast !== 0) {
      img.filters.push(new fabric.filters.Contrast({ contrast: pendingAdjustments.contrast / 100 }))
    }

    if (pendingAdjustments.saturation !== 0) {
      img.filters.push(new fabric.filters.Saturation({ saturation: pendingAdjustments.saturation / 100 }))
    }

    if (pendingAdjustments.hue !== 0) {
      img.filters.push(new fabric.filters.HueRotation({ rotation: pendingAdjustments.hue / 360 }))
    }

    if (pendingFilters.grayscale) {
      img.filters.push(new fabric.filters.Grayscale())
    }

    if (pendingFilters.sepia) {
      img.filters.push(new fabric.filters.Sepia())
    }

    if (pendingFilters.invert) {
      img.filters.push(new fabric.filters.Invert())
    }

    if (pendingFilters.blur > 0) {
      img.filters.push(new fabric.filters.Blur({ blur: pendingFilters.blur / 100 }))
    }

    if (pendingFilters.sharpen) {
      img.filters.push(new fabric.filters.Convolute({
        matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0]
      }))
    }

    if (pendingFilters.emboss) {
      img.filters.push(new fabric.filters.Convolute({
        matrix: [-2, -1, 0, -1, 1, 1, 0, 1, 2]
      }))
    }

    if (pendingFilters.warmth !== 0) {
      // Warmth: positive = warmer (more red/yellow), negative = cooler (more blue)
      const warmthMatrix = pendingFilters.warmth > 0
        ? [1 + pendingFilters.warmth / 200, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - pendingFilters.warmth / 200, 0, 0, 0, 0, 0, 1, 0]
        : [1 + pendingFilters.warmth / 200, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1 - pendingFilters.warmth / 200, 0, 0, 0, 0, 0, 1, 0]
      img.filters.push(new fabric.filters.ColorMatrix({ matrix: warmthMatrix }))
    }

    img.applyFilters()
    canvas.renderAll()
  }, [pendingAdjustments, pendingFilters])

  useEffect(() => {
    if (isCanvasReady) {
      applyFiltersToCanvas()
    }
  }, [pendingAdjustments, pendingFilters, isCanvasReady, applyFiltersToCanvas])

  // Apply adjustments (commit pending to applied)
  const applyAdjustments = () => {
    saveToHistory()
    setAppliedAdjustments({ ...pendingAdjustments })
  }

  // Apply filters (commit pending to applied)
  const applyFilters = () => {
    saveToHistory()
    setAppliedFilters({ ...pendingFilters })
  }

  // Check if there are pending changes
  const hasUnappliedAdjustments = JSON.stringify(pendingAdjustments) !== JSON.stringify(appliedAdjustments)
  const hasUnappliedFilters = JSON.stringify(pendingFilters) !== JSON.stringify(appliedFilters)

  const handleRotate = (degrees: number) => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    saveToHistory() // Save state before rotation
    const newRotation = (rotation + degrees) % 360
    setRotation(newRotation)
    img.rotate(newRotation)
    canvas.renderAll()
  }

  // Get output dimensions (accounting for rotation)
  const getOutputDimensions = () => {
    const currentRotation = (rotation % 360 + 360) % 360
    const isRotated90or270 = currentRotation === 90 || currentRotation === 270
    return isRotated90or270
      ? { width: resize.height, height: resize.width }
      : { width: resize.width, height: resize.height }
  }

  // Crop tool functions
  const initCropArea = () => {
    const img = imageObjectRef.current
    if (!img) return

    // Initialize crop area to center of image
    const imgWidth = img.width || 100
    const imgHeight = img.height || 100
    const cropWidth = imgWidth * 0.8
    const cropHeight = imgHeight * 0.8

    setCropArea({
      x: (imgWidth - cropWidth) / 2,
      y: (imgHeight - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    })
    setCropMode(true)
    setAspectRatioPreset('free')
  }

  const handleCropToolSelect = () => {
    if (selectedTool === 'crop') {
      // Deselect crop tool, cancel crop mode
      setSelectedTool(null)
      setCropMode(false)
    } else {
      setSelectedTool('crop')
      initCropArea()
    }
  }

  const applyCrop = () => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas || !cropMode) return

    saveToHistory() // Save state before crop

    // Get current crop offset (in case image was already cropped)
    const existingCropX = img.cropX || 0
    const existingCropY = img.cropY || 0

    // Calculate new absolute crop position
    // cropArea.x/y are relative to current visible image, so add to existing crop
    const newCropX = existingCropX + cropArea.x
    const newCropY = existingCropY + cropArea.y

    // Update resize dimensions to match crop
    setResize({
      ...resize,
      width: Math.round(cropArea.width),
      height: Math.round(cropArea.height),
    })

    // Apply the crop using Fabric.js crop properties
    img.set({
      cropX: newCropX,
      cropY: newCropY,
      width: cropArea.width,
      height: cropArea.height,
    })

    // Recenter image
    img.set({
      left: canvas.width! / 2,
      top: canvas.height! / 2,
    })

    canvas.renderAll()
    setCropMode(false)
    setSelectedTool(null)
  }

  const cancelCrop = () => {
    setCropMode(false)
    setSelectedTool(null)
  }

  const setAspectRatio = (preset: AspectRatioPreset) => {
    setAspectRatioPreset(preset)

    const img = imageObjectRef.current
    if (!img) return

    const imgWidth = img.width || 100
    const imgHeight = img.height || 100

    let newWidth = cropArea.width
    let newHeight = cropArea.height

    switch (preset) {
      case '1:1':
        newWidth = newHeight = Math.min(cropArea.width, cropArea.height, imgWidth, imgHeight)
        break
      case '16:9':
        newHeight = newWidth / (16 / 9)
        if (newHeight > imgHeight) {
          newHeight = imgHeight * 0.8
          newWidth = newHeight * (16 / 9)
        }
        break
      case '9:16':
        newWidth = newHeight / (16 / 9)
        if (newWidth > imgWidth) {
          newWidth = imgWidth * 0.8
          newHeight = newWidth * (16 / 9)
        }
        break
      case '4:3':
        newHeight = newWidth / (4 / 3)
        if (newHeight > imgHeight) {
          newHeight = imgHeight * 0.8
          newWidth = newHeight * (4 / 3)
        }
        break
      case '3:4':
        newWidth = newHeight / (4 / 3)
        if (newWidth > imgWidth) {
          newWidth = imgWidth * 0.8
          newHeight = newWidth * (4 / 3)
        }
        break
      case 'free':
      default:
        return // Don't change dimensions for free
    }

    // Center the new crop area
    const newX = Math.max(0, Math.min((imgWidth - newWidth) / 2, imgWidth - newWidth))
    const newY = Math.max(0, Math.min((imgHeight - newHeight) / 2, imgHeight - newHeight))

    setCropArea({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    })
  }

  const handleFlipX = () => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    saveToHistory() // Save state before flip
    setFlipX(!flipX)
    img.set('flipX', !flipX)
    canvas.renderAll()
  }

  const handleFlipY = () => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    saveToHistory() // Save state before flip
    setFlipY(!flipY)
    img.set('flipY', !flipY)
    canvas.renderAll()
  }

  const handleResetAll = () => {
    setAppliedAdjustments(defaultAdjustments)
    setPendingAdjustments(defaultAdjustments)
    setAppliedFilters(defaultFilters)
    setPendingFilters(defaultFilters)
    setRotation(0)
    setFlipX(false)
    setFlipY(false)
    setHistory([]) // Clear undo history
    setBlurRegions([]) // Clear blur regions

    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    // Reset crop to original dimensions
    if (originalImageDimensions.current) {
      img.set({
        cropX: 0,
        cropY: 0,
        width: originalImageDimensions.current.width,
        height: originalImageDimensions.current.height,
      })
      setResize({
        width: originalImageDimensions.current.width,
        height: originalImageDimensions.current.height,
        lockAspectRatio: true,
      })
    }

    img.filters = []
    img.applyFilters()
    img.rotate(0)
    img.set('flipX', false)
    img.set('flipY', false)
    handleFitToScreen()
  }

  // Blur tool functions
  const addBlurRegion = (region: Omit<BlurRegion, 'id'>) => {
    saveToHistory()
    const newRegion: BlurRegion = {
      ...region,
      id: `blur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
    setBlurRegions(prev => [...prev, newRegion])
  }

  const removeBlurRegion = (id: string) => {
    saveToHistory()
    setBlurRegions(prev => prev.filter(r => r.id !== id))
  }

  const clearAllBlurRegions = () => {
    if (blurRegions.length === 0) return
    saveToHistory()
    setBlurRegions([])
  }

  // Apply blur regions permanently to the image
  const applyBlurRegions = async () => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas || blurRegions.length === 0) return

    // Capture image data before applying blur so we can undo
    saveToHistory(true)

    // Get the source element (the actual image)
    const sourceElement = img.getElement() as HTMLImageElement
    if (!sourceElement) return

    // Create a temporary canvas to apply blur
    const tempCanvas = document.createElement('canvas')
    const imgWidth = img.width || sourceElement.naturalWidth
    const imgHeight = img.height || sourceElement.naturalHeight
    tempCanvas.width = imgWidth
    tempCanvas.height = imgHeight

    const ctx = tempCanvas.getContext('2d')
    if (!ctx) return

    // Draw the current image (respecting cropX/cropY)
    const cropX = img.cropX || 0
    const cropY = img.cropY || 0
    ctx.drawImage(
      sourceElement,
      cropX, cropY, imgWidth, imgHeight,
      0, 0, imgWidth, imgHeight
    )

    // Apply blur to each region
    for (const region of blurRegions) {
      const rx = Math.max(0, Math.round(region.x))
      const ry = Math.max(0, Math.round(region.y))
      const rw = Math.min(Math.round(region.width), imgWidth - rx)
      const rh = Math.min(Math.round(region.height), imgHeight - ry)

      if (rw <= 0 || rh <= 0) continue

      // Extract region data
      const regionData = ctx.getImageData(rx, ry, rw, rh)
      const blurredData = applyBoxBlur(regionData, region.intensity)
      ctx.putImageData(blurredData, rx, ry)
    }

    // Create new Fabric image from the blurred canvas
    const dataURL = tempCanvas.toDataURL('image/png')
    const newImg = await fabric.FabricImage.fromURL(dataURL)

    // Copy properties from old image
    newImg.set({
      left: img.left,
      top: img.top,
      originX: 'center',
      originY: 'center',
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      angle: img.angle,
      flipX: img.flipX,
      flipY: img.flipY,
      selectable: img.selectable,
      evented: img.evented,
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      hoverCursor: 'grab',
      moveCursor: 'grabbing',
    })

    // Copy filters
    if (img.filters && img.filters.length > 0) {
      newImg.filters = [...img.filters]
      newImg.applyFilters()
    }

    // Replace old image with new one
    canvas.remove(img)
    canvas.add(newImg)
    canvas.setActiveObject(newImg)
    imageObjectRef.current = newImg

    // Clear blur regions and exit tool
    setBlurRegions([])
    setSelectedTool(null)
    canvas.renderAll()
  }

  // Get image bounds for blur overlay positioning
  const getImageScreenBoundsForBlur = useCallback((): { left: number; top: number; scaleX: number; scaleY: number; imgWidth: number; imgHeight: number } => {
    const canvas = fabricCanvasRef.current
    const imageObject = imageObjectRef.current
    if (!canvas || !imageObject) return { left: 0, top: 0, scaleX: 1, scaleY: 1, imgWidth: 0, imgHeight: 0 }

    const zoom = canvas.getZoom()
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]

    const imgLeft = imageObject.left || 0
    const imgTop = imageObject.top || 0
    const imgScaleX = imageObject.scaleX || 1
    const imgScaleY = imageObject.scaleY || 1
    const imgWidth = imageObject.width || 0
    const imgHeight = imageObject.height || 0

    const imgTopLeftX = imgLeft - (imgWidth * imgScaleX) / 2
    const imgTopLeftY = imgTop - (imgHeight * imgScaleY) / 2

    const screenLeft = imgTopLeftX * zoom + vpt[4]
    const screenTop = imgTopLeftY * zoom + vpt[5]

    return {
      left: screenLeft,
      top: screenTop,
      scaleX: imgScaleX * zoom,
      scaleY: imgScaleY * zoom,
      imgWidth,
      imgHeight,
    }
  }, [])

  const handleBlurMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectedTool !== 'blur') return

    const bounds = getImageScreenBoundsForBlur()
    const rect = e.currentTarget.getBoundingClientRect()

    // Get mouse position relative to canvas container
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // Convert to image coordinates
    const imgX = (mouseX - bounds.left) / bounds.scaleX
    const imgY = (mouseY - bounds.top) / bounds.scaleY

    // Check if within image bounds
    if (imgX >= 0 && imgX <= bounds.imgWidth && imgY >= 0 && imgY <= bounds.imgHeight) {
      setIsDrawingBlur(true)
      setBlurDrawStart({ x: imgX, y: imgY })
      setCurrentBlurRect({ x: imgX, y: imgY, width: 0, height: 0 })
    }
  }

  const handleBlurMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingBlur || !blurDrawStart) return

    const bounds = getImageScreenBoundsForBlur()
    const rect = e.currentTarget.getBoundingClientRect()

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const imgX = (mouseX - bounds.left) / bounds.scaleX
    const imgY = (mouseY - bounds.top) / bounds.scaleY

    // Clamp to image bounds
    const clampedX = Math.max(0, Math.min(imgX, bounds.imgWidth))
    const clampedY = Math.max(0, Math.min(imgY, bounds.imgHeight))

    // Calculate rectangle (handle negative width/height for drawing in any direction)
    const x = Math.min(blurDrawStart.x, clampedX)
    const y = Math.min(blurDrawStart.y, clampedY)
    const width = Math.abs(clampedX - blurDrawStart.x)
    const height = Math.abs(clampedY - blurDrawStart.y)

    setCurrentBlurRect({ x, y, width, height })
  }

  const handleBlurMouseUp = () => {
    if (!isDrawingBlur || !currentBlurRect) {
      setIsDrawingBlur(false)
      setBlurDrawStart(null)
      setCurrentBlurRect(null)
      return
    }

    // Only add if the rectangle has a minimum size
    if (currentBlurRect.width >= 10 && currentBlurRect.height >= 10) {
      addBlurRegion({
        x: currentBlurRect.x,
        y: currentBlurRect.y,
        width: currentBlurRect.width,
        height: currentBlurRect.height,
        intensity: blurIntensity,
      })
    }

    setIsDrawingBlur(false)
    setBlurDrawStart(null)
    setCurrentBlurRect(null)
  }

  const handleResizeWidth = (newWidth: number) => {
    if (resize.lockAspectRatio) {
      const newHeight = Math.round(newWidth / originalAspectRatio.current)
      setResize({ ...resize, width: newWidth, height: newHeight })
    } else {
      setResize({ ...resize, width: newWidth })
    }
  }

  const handleResizeHeight = (newHeight: number) => {
    if (resize.lockAspectRatio) {
      const newWidth = Math.round(newHeight * originalAspectRatio.current)
      setResize({ ...resize, width: newWidth, height: newHeight })
    } else {
      setResize({ ...resize, height: newHeight })
    }
  }

  const applyResize = () => {
    const img = imageObjectRef.current
    const canvas = fabricCanvasRef.current
    if (!img || !canvas) return

    const imgWidth = img.width || 1
    const imgHeight = img.height || 1

    // Validate resize values
    if (resize.width <= 0 || resize.height <= 0) return

    saveToHistory() // Save state before resize

    const scaleX = resize.width / imgWidth
    const scaleY = resize.height / imgHeight

    img.set({ scaleX, scaleY })
    canvas.renderAll()
  }

  const handleSave = async () => {
    if (!imagePath || !imageObjectRef.current || !fabricCanvasRef.current) return

    setIsSaving(true)

    try {
      const img = imageObjectRef.current

      // Calculate base dimensions from the image scale
      const baseWidth = Math.round((img.width || 0) * Math.abs(img.scaleX || 1))
      const baseHeight = Math.round((img.height || 0) * Math.abs(img.scaleY || 1))

      // Check if rotation is 90 or 270 degrees (need to swap width/height)
      const currentRotation = (rotation % 360 + 360) % 360
      const isRotated90or270 = currentRotation === 90 || currentRotation === 270

      // Swap dimensions if rotated 90 or 270 degrees
      const exportWidth = isRotated90or270 ? baseHeight : baseWidth
      const exportHeight = isRotated90or270 ? baseWidth : baseHeight

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = exportWidth
      tempCanvas.height = exportHeight

      const exportCanvas = new fabric.Canvas(tempCanvas, {
        backgroundColor: 'transparent',
        width: exportWidth,
        height: exportHeight,
      })

      // Clone the image and apply transformations for export
      const clonedImg = await img.clone()

      // Reset scale to 1 for export (we already accounted for it in canvas size)
      // But keep the relative scale ratio if aspect ratio was changed
      const scaleRatio = Math.abs(img.scaleX || 1) / Math.abs(img.scaleY || 1)

      clonedImg.set({
        left: exportWidth / 2,
        top: exportHeight / 2,
        originX: 'center',
        originY: 'center',
        // Scale to fit the export canvas
        scaleX: isRotated90or270 ? exportHeight / (img.width || 1) : exportWidth / (img.width || 1),
        scaleY: isRotated90or270 ? exportWidth / (img.height || 1) : exportHeight / (img.height || 1),
        angle: currentRotation,
        flipX: flipX,
        flipY: flipY,
      })

      exportCanvas.add(clonedImg)
      exportCanvas.renderAll()

      const ext = imagePath.split('.').pop()?.toLowerCase()
      let format = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') format = 'image/jpeg'
      else if (ext === 'webp') format = 'image/webp'

      const dataURL = exportCanvas.toDataURL({
        format: format === 'image/jpeg' ? 'jpeg' : format === 'image/webp' ? 'webp' : 'png',
        quality: 0.95,
        multiplier: 1,
      })

      exportCanvas.dispose()

      const result = await window.electronAPI?.files?.saveBase64Image?.(imagePath, dataURL)

      if (result?.success) {
        onSave?.()
        handleClose()
      } else {
        console.error('❌ Failed to save image:', result?.error)
        alert('Failed to save image: ' + (result?.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('❌ Error saving image:', error)
      alert('Error saving image')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  const tools = [
    { id: 'adjust' as EditorTool, icon: SlidersHorizontal, label: 'Adjust', color: 'pink' },
    { id: 'filters' as EditorTool, icon: Palette, label: 'Filters', color: 'orange' },
    { id: 'resize' as EditorTool, icon: Maximize2, label: 'Resize', color: 'blue' },
    { id: 'crop' as EditorTool, icon: Crop, label: 'Crop', color: 'green' },
    { id: 'blur' as EditorTool, icon: Scan, label: 'Blur', color: 'purple' },
  ]

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

        <div className="relative w-[95vw] h-[95vh] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Image Editor</h2>
              {/* Breadcrumb when tool is selected */}
              {(selectedTool || cropMode) && (
                <>
                  <span className="text-gray-500">/</span>
                  <span className="text-sm text-primary font-medium">
                    {cropMode ? 'Crop' : tools.find(t => t.id === selectedTool)?.label}
                  </span>
                </>
              )}
              <span className="text-xs text-gray-500 ml-2">
                {imageName} • {getOutputDimensions().width} × {getOutputDimensions().height}px
              </span>
            </div>

            <div className="flex items-center gap-1">
              {/* Zoom Controls */}
              <button
                onClick={handleZoomOut}
                disabled={!isCanvasReady}
                className="p-1.5 rounded hover:bg-dark-bg/80 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-xs text-gray-400 min-w-[45px] text-center font-mono">
                {zoomLevel}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={!isCanvasReady}
                className="p-1.5 rounded hover:bg-dark-bg/80 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleResetZoom}
                disabled={!isCanvasReady}
                className="p-1.5 rounded hover:bg-dark-bg/80 text-gray-400 hover:text-white transition-colors disabled:opacity-40"
                title="Reset"
              >
                <RotateCcw size={14} />
              </button>

              <div className="w-px h-5 bg-dark-border mx-2" />

              <button
                onClick={handleClose}
                className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative flex-1 flex overflow-hidden">
            {/* Floating Left Toolbar */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
              <div className="bg-dark-bg/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-2">
                {tools.map((tool) => {
                  const isActive = selectedTool === tool.id || (tool.id === 'crop' && cropMode)
                  return (
                    <button
                      key={tool.id}
                      onClick={() => {
                        if (tool.id === 'crop') {
                          handleCropToolSelect()
                        } else {
                          // Exit crop mode if switching to another tool
                          if (cropMode) {
                            cancelCrop()
                          }
                          setSelectedTool(selectedTool === tool.id ? null : tool.id)
                        }
                      }}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${isActive
                        ? `bg-gradient-to-br from-${tool.color}-500/20 to-${tool.color}-500/5 text-${tool.color}-400 border border-${tool.color}-500/30 shadow-[0_0_15px_rgba(0,0,0,0.3)]`
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <tool.icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />

                      {/* Tooltip */}
                      <div className="absolute left-full ml-3 px-2 py-1 bg-dark-bg/90 border border-white/10 rounded-md text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md">
                        {tool.label}
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="bg-dark-bg/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl flex flex-col gap-2">
                {/* Transform buttons */}
                <button
                  onClick={() => handleRotate(90)}
                  disabled={!isCanvasReady}
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-40 group relative"
                >
                  <RotateCw size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-dark-bg/90 border border-white/10 rounded-md text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md">
                    Rotate
                  </div>
                </button>
                <button
                  onClick={handleFlipX}
                  disabled={!isCanvasReady}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 group relative ${flipX ? 'bg-primary/20 text-primary border border-primary/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <FlipHorizontal size={20} />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-dark-bg/90 border border-white/10 rounded-md text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md">
                    Flip Horizontal
                  </div>
                </button>
                <button
                  onClick={handleFlipY}
                  disabled={!isCanvasReady}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 group relative ${flipY ? 'bg-primary/20 text-primary border border-primary/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <FlipVertical size={20} />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-dark-bg/90 border border-white/10 rounded-md text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md">
                    Flip Vertical
                  </div>
                </button>

                <div className="h-px w-8 bg-white/10 mx-auto my-1" />

                {/* Undo button */}
                <button
                  onClick={handleUndo}
                  disabled={!isCanvasReady || history.length === 0}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 group relative ${history.length > 0
                    ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                    : 'text-gray-600'
                    }`}
                >
                  <Undo2 size={20} />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-dark-bg/90 border border-white/10 rounded-md text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap backdrop-blur-md">
                    Undo ({history.length})
                  </div>
                </button>
              </div>
            </div>

            {/* Center Area */}
            <div className="flex-1 flex flex-col relative">
              {/* Tool Options Bar - Floating at top */}
              <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${(selectedTool || cropMode) ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'
                }`}>
                <div className="bg-dark-bg/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 min-w-[300px] justify-center">

                  {/* Adjust Tool Options */}
                  {selectedTool === 'adjust' && (
                    <>
                      <div className="flex items-center gap-3 group">
                        <Sun size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Brightness</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={pendingAdjustments.brightness}
                              onChange={(e) => setPendingAdjustments({ ...pendingAdjustments, brightness: parseInt(e.target.value) })}
                              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
                            />
                            <span className="text-xs font-mono text-gray-300 w-8 text-right">{pendingAdjustments.brightness}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-3 group">
                        <Contrast size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Contrast</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={pendingAdjustments.contrast}
                              onChange={(e) => setPendingAdjustments({ ...pendingAdjustments, contrast: parseInt(e.target.value) })}
                              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
                            />
                            <span className="text-xs font-mono text-gray-300 w-8 text-right">{pendingAdjustments.contrast}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-3 group">
                        <Droplets size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Saturation</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              value={pendingAdjustments.saturation}
                              onChange={(e) => setPendingAdjustments({ ...pendingAdjustments, saturation: parseInt(e.target.value) })}
                              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
                            />
                            <span className="text-xs font-mono text-gray-300 w-8 text-right">{pendingAdjustments.saturation}</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-3 group">
                        <CircleDot size={16} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Hue</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="360"
                              value={pendingAdjustments.hue}
                              onChange={(e) => setPendingAdjustments({ ...pendingAdjustments, hue: parseInt(e.target.value) })}
                              className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500 hover:accent-pink-400 transition-all"
                            />
                            <span className="text-xs font-mono text-gray-300 w-10 text-right">{pendingAdjustments.hue}°</span>
                          </div>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPendingAdjustments(appliedAdjustments)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          Reset
                        </button>
                        {hasUnappliedAdjustments && (
                          <button
                            onClick={applyAdjustments}
                            className="px-4 py-1.5 text-xs font-medium bg-pink-500 text-white rounded-lg shadow-lg shadow-pink-500/20 hover:bg-pink-400 hover:shadow-pink-500/40 transition-all flex items-center gap-1.5"
                          >
                            <Check size={14} />
                            Apply
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Filters Tool Options */}
                  {selectedTool === 'filters' && (
                    <>
                      <div className="flex items-center gap-2">
                        {[
                          { key: 'grayscale', label: 'Grayscale' },
                          { key: 'sepia', label: 'Sepia' },
                          { key: 'invert', label: 'Invert' },
                          { key: 'sharpen', label: 'Sharpen' },
                          { key: 'emboss', label: 'Emboss' },
                        ].map((f) => (
                          <button
                            key={f.key}
                            onClick={() => setPendingFilters({ ...pendingFilters, [f.key]: !pendingFilters[f.key as keyof FilterValues] })}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${pendingFilters[f.key as keyof FilterValues]
                              ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20'
                              }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-3 group">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider group-hover:text-orange-400 transition-colors">Blur</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pendingFilters.blur}
                            onChange={(e) => setPendingFilters({ ...pendingFilters, blur: parseInt(e.target.value) })}
                            className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
                          />
                          <span className="text-xs font-mono text-gray-300 w-8 text-right">{pendingFilters.blur}%</span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-3 group">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider group-hover:text-orange-400 transition-colors">Warmth</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="-100"
                            max="100"
                            value={pendingFilters.warmth}
                            onChange={(e) => setPendingFilters({ ...pendingFilters, warmth: parseInt(e.target.value) })}
                            className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 hover:accent-orange-400 transition-all"
                          />
                          <span className="text-xs font-mono text-gray-300 w-8 text-right">{pendingFilters.warmth}</span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPendingFilters(appliedFilters)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          Reset
                        </button>
                        {hasUnappliedFilters && (
                          <button
                            onClick={applyFilters}
                            className="px-4 py-1.5 text-xs font-medium bg-orange-500 text-white rounded-lg shadow-lg shadow-orange-500/20 hover:bg-orange-400 hover:shadow-orange-500/40 transition-all flex items-center gap-1.5"
                          >
                            <Check size={14} />
                            Apply
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Resize Tool Options */}
                  {selectedTool === 'resize' && (
                    <>
                      <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 focus-within:border-blue-500/50 transition-colors">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Width</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={resize.width}
                            onChange={(e) => handleResizeWidth(parseInt(e.target.value) || 0)}
                            className="w-16 bg-transparent text-sm font-mono text-white focus:outline-none text-right"
                          />
                          <span className="text-xs text-gray-500">px</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setResize({ ...resize, lockAspectRatio: !resize.lockAspectRatio })}
                        className={`p-2 rounded-lg transition-all ${resize.lockAspectRatio
                          ? 'text-blue-400 bg-blue-500/20 border border-blue-500/30'
                          : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
                          }`}
                        title={resize.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                      >
                        {resize.lockAspectRatio ? <Link size={16} /> : <Unlink size={16} />}
                      </button>

                      <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 focus-within:border-blue-500/50 transition-colors">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Height</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={resize.height}
                            onChange={(e) => handleResizeHeight(parseInt(e.target.value) || 0)}
                            className="w-16 bg-transparent text-sm font-mono text-white focus:outline-none text-right"
                          />
                          <span className="text-xs text-gray-500">px</span>
                        </div>
                      </div>

                      <div className="w-px h-8 bg-white/10" />

                      <button
                        onClick={applyResize}
                        className="px-4 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-400 hover:shadow-blue-500/40 transition-all flex items-center gap-1.5"
                      >
                        <Check size={14} />
                        Apply
                      </button>
                    </>
                  )}

                  {/* Crop Tool Options */}
                  {selectedTool === 'crop' && cropMode && (
                    <>
                      <span className="text-xs text-gray-400">Aspect Ratio:</span>
                      <div className="flex items-center gap-1">
                        {[
                          { key: 'free' as AspectRatioPreset, label: 'Free', icon: Move },
                          { key: '1:1' as AspectRatioPreset, label: '1:1', icon: Square },
                          { key: '16:9' as AspectRatioPreset, label: '16:9', icon: RectangleHorizontal },
                          { key: '9:16' as AspectRatioPreset, label: '9:16', icon: RectangleVertical },
                          { key: '4:3' as AspectRatioPreset, label: '4:3', icon: RectangleHorizontal },
                          { key: '3:4' as AspectRatioPreset, label: '3:4', icon: RectangleVertical },
                        ].map((preset) => (
                          <button
                            key={preset.key}
                            onClick={() => setAspectRatio(preset.key)}
                            className={`px-2 py-1 text-xs rounded-md border transition-colors flex items-center gap-1 ${aspectRatioPreset === preset.key
                              ? 'bg-green-500/20 border-green-500/50 text-green-400'
                              : 'bg-dark-bg/50 border-dark-border text-gray-400 hover:text-white hover:border-gray-500'
                              }`}
                          >
                            <preset.icon size={12} />
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="w-px h-6 bg-dark-border" />

                      <span className="text-xs text-gray-500">
                        {Math.round(cropArea.width)} × {Math.round(cropArea.height)}px
                      </span>

                      <div className="flex-1" />

                      <button
                        onClick={cancelCrop}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={applyCrop}
                        className="px-3 py-1.5 text-xs bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-md transition-colors flex items-center gap-1"
                      >
                        <Check size={12} />
                        Apply Crop
                      </button>
                    </>
                  )}

                  {/* Blur Tool Options */}
                  {selectedTool === 'blur' && (
                    <>
                      <span className="text-xs text-gray-400">Draw rectangles on areas to blur</span>

                      <div className="w-px h-6 bg-dark-border" />

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Intensity</span>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          value={blurIntensity}
                          onChange={(e) => setBlurIntensity(parseInt(e.target.value))}
                          className="w-24 h-1 bg-dark-border rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <span className="text-xs text-gray-500 w-8">{blurIntensity}</span>
                      </div>

                      <div className="w-px h-6 bg-dark-border" />

                      <span className="text-xs text-gray-500">
                        {blurRegions.length} region{blurRegions.length !== 1 ? 's' : ''}
                      </span>

                      <div className="flex-1" />

                      {blurRegions.length > 0 && (
                        <>
                          <button
                            onClick={clearAllBlurRegions}
                            className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors flex items-center gap-1"
                          >
                            <Trash2 size={12} />
                            Clear All
                          </button>
                          <button
                            onClick={applyBlurRegions}
                            className="px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-400 rounded-md transition-colors flex items-center gap-1"
                          >
                            <Check size={12} />
                            Apply
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Canvas Area */}
              <div
                ref={canvasContainerRef}
                className={`relative flex-1 bg-dark-bg/50 overflow-hidden ${selectedTool === 'blur' ? 'cursor-crosshair' : ''}`}
                onMouseDown={handleBlurMouseDown}
                onMouseMove={handleBlurMouseMove}
                onMouseUp={handleBlurMouseUp}
                onMouseLeave={handleBlurMouseUp}
              >
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px`
                  }}
                />

                {/* Canvas element - Fabric.js will wrap this */}
                <canvas ref={canvasRef} className="block" />

                {!isCanvasReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/50 z-10">
                    <div className="text-gray-400 text-sm">Loading editor...</div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg text-xs text-gray-300 font-mono pointer-events-none z-10 shadow-lg">
                  {getOutputDimensions().width} × {getOutputDimensions().height}px
                  {rotation !== 0 && <span className="ml-1 text-gray-500">({rotation}°)</span>}
                </div>

                {/* Crop Overlay */}
                {cropMode && isCanvasReady && imageObjectRef.current && (
                  <CropOverlay
                    cropArea={cropArea}
                    setCropArea={setCropArea}
                    imageObject={imageObjectRef.current}
                    canvas={fabricCanvasRef.current}
                    aspectRatioPreset={aspectRatioPreset}
                  />
                )}

                {/* Blur Regions Overlay */}
                {selectedTool === 'blur' && isCanvasReady && (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Existing blur regions */}
                    {blurRegions.map((region) => {
                      const bounds = getImageScreenBoundsForBlur()
                      const screenX = bounds.left + region.x * bounds.scaleX
                      const screenY = bounds.top + region.y * bounds.scaleY
                      const screenW = region.width * bounds.scaleX
                      const screenH = region.height * bounds.scaleY
                      // Calculate CSS blur to match box blur: box blur radius = intensity/2,
                      // then account for screen scale (avg of X and Y) and adjust for CSS vs box blur difference
                      const avgScale = (bounds.scaleX + bounds.scaleY) / 2
                      const cssBlur = Math.round((region.intensity / 2) * avgScale * 0.7)

                      return (
                        <div
                          key={region.id}
                          className="absolute border-2 border-purple-400 pointer-events-auto group shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                          style={{
                            left: screenX,
                            top: screenY,
                            width: screenW,
                            height: screenH,
                            backdropFilter: `blur(${cssBlur}px)`,
                            WebkitBackdropFilter: `blur(${cssBlur}px)`,
                          }}
                        >
                          <button
                            onClick={() => removeBlurRegion(region.id)}
                            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg transform hover:scale-110"
                            title="Remove blur region"
                          >
                            <X size={14} className="text-white" />
                          </button>
                        </div>
                      )
                    })}

                    {/* Current drawing rectangle */}
                    {currentBlurRect && currentBlurRect.width > 0 && currentBlurRect.height > 0 && (() => {
                      const bounds = getImageScreenBoundsForBlur()
                      // Match the same CSS blur formula as saved regions
                      const avgScale = (bounds.scaleX + bounds.scaleY) / 2
                      const cssBlur = Math.round((blurIntensity / 2) * avgScale * 0.7)
                      return (
                        <div
                          className="absolute border-2 border-dashed border-purple-400/70"
                          style={{
                            left: bounds.left + currentBlurRect.x * bounds.scaleX,
                            top: bounds.top + currentBlurRect.y * bounds.scaleY,
                            width: currentBlurRect.width * bounds.scaleX,
                            height: currentBlurRect.height * bounds.scaleY,
                            backdropFilter: `blur(${cssBlur}px)`,
                            WebkitBackdropFilter: `blur(${cssBlur}px)`,
                          }}
                        />
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 px-6 py-4 border-t border-white/5 bg-dark-bg/80 backdrop-blur-xl flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              Scroll to zoom • Drag to pan
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-dark-bg hover:bg-dark-bg/70 text-gray-300 text-sm font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !isCanvasReady}
                className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

export default ImageEditorModal
