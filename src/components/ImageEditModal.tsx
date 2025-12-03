import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Upload, Link2, ChevronDown, ChevronUp, Loader2, CheckCircle2, ZoomIn, ZoomOut, RotateCcw, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'
import { ModalPortal } from './ModalPortal'
import * as fabric from 'fabric'

interface ImageEditModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  imageWidth?: number
  imageHeight?: number
  imagePath?: string
}

function ImageEditModal({ isOpen, onClose, imageSrc, imageWidth, imageHeight, imagePath }: ImageEditModalProps) {
  const { currentProjectId } = useAppStore()
  const { layoutState, setEditModeEnabled, addImageReference, setPrefilledMessage, setPreviewHidden } = useLayoutStore()

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

  const [selectedTool, setSelectedTool] = useState<'generate' | 'assets' | 'upload' | 'reference' | null>(null)
  const [hoveredTool, setHoveredTool] = useState<'generate' | 'assets' | 'upload' | 'reference' | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; preview: string; size: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Assets browser state
  const [assetImages, setAssetImages] = useState<Array<{ name: string; path: string; dimensions?: string; size?: string }>>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<{ name: string; path: string; preview: string } | null>(null)

  // Check if original image is SVG (vector format - cannot be replaced with raster)
  const isSVG = imagePath?.toLowerCase().endsWith('.svg') || imageSrc?.startsWith('data:image/svg+xml')

  // Crop tool state (Fabric.js based)
  const [cropMode, setCropMode] = useState(false)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isCanvasReady, setIsCanvasReady] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const imageObjectRef = useRef<fabric.FabricImage | null>(null)
  const isDisposedRef = useRef(false)

  const handleClose = () => {
    // Dispose canvas BEFORE changing state to avoid React reconciliation conflicts
    if (fabricCanvasRef.current) {
      try {
        fabricCanvasRef.current.dispose()
      } catch (e) {
        // Ignore
      }
      fabricCanvasRef.current = null
      imageObjectRef.current = null
    }

    setSelectedTool(null)
    setAiPrompt('')
    setUploadedFile(null)
    setIsGenerating(false)
    setCropMode(false)
    setCropImage(null)
    setZoomLevel(100)
    setIsCanvasReady(false)
    setSelectedAsset(null)
    setAssetImages([])
    onClose()
  }

  // Load images from assets folder
  const loadAssetImages = async () => {
    if (!currentProjectId) return

    setIsLoadingAssets(true)
    try {
      const result = await window.electronAPI?.projects.getAssetsStructure(currentProjectId)

      if (result?.success && result.assets) {
        // Recursively find all image files
        const images: Array<{ name: string; path: string; dimensions?: string; size?: string }> = []

        const findImages = (nodes: any[], parentPath = '') => {
          for (const node of nodes) {
            if (node.type === 'file' && node.fileType === 'image') {
              // Skip SVG files since we can't replace SVG with raster
              if (!node.name.toLowerCase().endsWith('.svg')) {
                images.push({
                  name: node.name,
                  path: node.path || `${parentPath}/${node.name}`,
                  dimensions: node.dimensions,
                  size: node.size
                })
              }
            } else if (node.type === 'folder' && node.children) {
              findImages(node.children, node.path || `${parentPath}/${node.name}`)
            }
          }
        }

        findImages(result.assets)
        setAssetImages(images)
      }
    } catch (error) {
      console.error('Failed to load asset images:', error)
    } finally {
      setIsLoadingAssets(false)
    }
  }

  const handleGenerateAI = () => {
    if (isSVG) {
      alert('SVG images cannot be replaced.\n\nSVG is a vector format, but AI-generated images are raster (PNG/JPG). Replacing an SVG would break your application.\n\nPlease replace this image manually or use a different image editor.')
      return
    }
    if (selectedTool === 'generate') {
      // Collapse
      setSelectedTool(null)
      setAiPrompt('')
      setIsGenerating(false)
    } else {
      // Expand
      setSelectedTool('generate')
    }
  }

  const handleAssetsSelect = () => {
    if (isSVG) {
      alert('SVG images cannot be replaced.\n\nSVG is a vector format, but asset images are raster (PNG/JPG/WebP). Replacing an SVG would break your application.\n\nPlease replace this image manually or use a different image editor.')
      return
    }
    if (selectedTool === 'assets') {
      // Collapse
      setSelectedTool(null)
      setSelectedAsset(null)
    } else {
      // Expand and load images
      setSelectedTool('assets')
      loadAssetImages()
    }
  }

  const handleAssetClick = async (asset: { name: string; path: string; dimensions?: string }) => {
    try {
      // Read file as base64
      const fileData = await window.electronAPI?.files?.readFileAsBase64?.(asset.path)
      if (fileData) {
        const ext = asset.name.split('.').pop()?.toLowerCase()
        let mimeType = 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
        else if (ext === 'gif') mimeType = 'image/gif'
        else if (ext === 'webp') mimeType = 'image/webp'

        const preview = `data:${mimeType};base64,${fileData}`

        setSelectedAsset({
          name: asset.name,
          path: asset.path,
          preview
        })

        setCropImage(preview)
        setCropMode(true)
      }
    } catch (error) {
      console.error('Failed to load asset image:', error)
    }
  }

  const handleUpload = () => {
    if (isSVG) {
      alert('SVG images cannot be replaced.\n\nSVG is a vector format, but uploaded images are raster (PNG/JPG/WebP). Replacing an SVG would break your application.\n\nPlease replace this image manually or use a different image editor.')
      return
    }
    // Trigger file input click
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setUploadedFile({
          name: file.name,
          preview: result,
          size: file.size
        })
        setSelectedTool('upload')
        setCropImage(result)
        setCropMode(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleReference = () => {
    // Add image reference to ActionBar
    addImageReference({
      id: Date.now().toString(),
      name: imagePath?.split('/').pop() || 'unknown.png',
      path: imagePath || '',
      src: imageSrc,
      dimensions: `${imageWidth || 0}×${imageHeight || 0}`,
    })

    // Pre-fill ActionBar message with template text
    // The pill will appear inline before this text: [pill]: cursor
    setPrefilledMessage(': ')

    // Close modal and disable edit mode
    handleClose()
    setEditModeEnabled(false)

    console.log('Image referenced in ActionBar')
  }

  const handleSubmitAI = () => {
    if (aiPrompt.trim()) {
      setIsGenerating(true)
      console.log('Generating AI image with prompt:', aiPrompt)

      // TODO: Implement AI generation
      // This will:
      // 1. Send prompt to backend API endpoint
      // 2. Backend calls image generation AI (e.g., DALL-E, Midjourney, Stable Diffusion)
      // 3. Receive generated image data
      // 4. Send to Electron app
      // 5. Enter crop mode with the generated image

      // Example flow:
      /*
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, width: imageWidth, height: imageHeight })
      })
      .then(res => res.json())
      .then(data => {
        setCropImageDimensions({ width: data.width, height: data.height })
        setCropImage(data.imageDataUrl)
        setCropMode(true)
        setZoom(1)
        setPosition({ x: 0, y: 0 })
        setIsGenerating(false)
      })
      .catch(error => {
        console.error('Failed to generate image:', error)
        setIsGenerating(false)
      })
      */

      // For now, show not implemented message
      setIsGenerating(false)
      alert('AI image generation will be implemented soon!\n\nThis will connect to your backend to generate images.')
      setSelectedTool(null)
      setAiPrompt('')
    }
  }

  // Calculate crop area dimensions (scaled down to fit in modal)
  const getCropAreaDimensions = (containerWidth: number, containerHeight: number) => {
    if (!imageWidth || !imageHeight) return { width: 300, height: 200 }

    // Use 70% of container size as max
    const maxWidth = containerWidth * 0.7
    const maxHeight = containerHeight * 0.7
    const aspectRatio = imageWidth / imageHeight

    let width = imageWidth
    let height = imageHeight

    // Scale down to fit
    if (width > maxWidth || height > maxHeight) {
      if (aspectRatio > maxWidth / maxHeight) {
        width = maxWidth
        height = maxWidth / aspectRatio
      } else {
        height = maxHeight
        width = maxHeight * aspectRatio
      }
    }

    return { width, height }
  }

  // Initialize Fabric.js canvas when crop mode is enabled
  useEffect(() => {
    if (!cropMode || !cropImage || !canvasRef.current) return

    isDisposedRef.current = false

    // Create Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: false,
    })

    fabricCanvasRef.current = canvas

    // Small delay to ensure container is properly sized
    const initTimeout = setTimeout(() => {
      if (isDisposedRef.current) return

      const container = canvasContainerRef.current
      if (container) {
        const containerW = container.offsetWidth || container.clientWidth || 800
        const containerH = container.offsetHeight || container.clientHeight || 500
        canvas.setWidth(containerW)
        canvas.setHeight(containerH)
      }

      // Load the crop image
      fabric.FabricImage.fromURL(cropImage).then((img) => {
        if (isDisposedRef.current || !canvas || !img) return

        imageObjectRef.current = img

        const containerW = canvas.width!
        const containerH = canvas.height!
        const srcW = img.width || 1
        const srcH = img.height || 1

        // Calculate the crop area dimensions on screen
        const cropArea = getCropAreaDimensions(containerW, containerH)

        // IMPORTANT: Calculate scale so that the crop area captures exactly
        // imageWidth × imageHeight pixels from the source image (1:1 quality)
        //
        // If source is larger than target: scale down so we can see more of the source
        // If source is smaller than target: scale up (will cause quality loss - unavoidable)
        //
        // The scale should be: cropArea.width / imageWidth (for width dimension)
        // This means: at this scale, the crop area on screen = imageWidth pixels of source

        const targetW = imageWidth || srcW
        const targetH = imageHeight || srcH

        // Scale so the source image, when displayed, allows us to capture targetW × targetH pixels
        // within the crop area at 1:1 ratio
        const idealScaleX = cropArea.width / targetW
        const idealScaleY = cropArea.height / targetH

        // Use the smaller scale to ensure we can capture the full target area
        // But also ensure the image is large enough to cover the crop area
        let fitScale = Math.min(idealScaleX, idealScaleY)

        // However, if the source image is smaller than target, we need to scale up
        // to at least cover the crop area
        const minScaleToFillCrop = Math.max(
          cropArea.width / srcW,
          cropArea.height / srcH
        )

        // Use the larger of: ideal 1:1 scale OR minimum to fill crop area
        fitScale = Math.max(fitScale, minScaleToFillCrop)

        img.set({
          left: containerW / 2,
          top: containerH / 2,
          originX: 'center',
          originY: 'center',
          scaleX: fitScale,
          scaleY: fitScale,
          selectable: true,
          hasControls: false,
          hasBorders: false,
          lockScalingX: true,
          lockScalingY: true,
          hoverCursor: 'grab',
          moveCursor: 'grabbing',
        })

        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()

        setZoomLevel(Math.round(fitScale * 100))
        setIsCanvasReady(true)
      })
    }, 50)

    // Mouse wheel zoom
    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY
      let zoom = canvas.getZoom()
      zoom *= 0.999 ** delta
      if (zoom > 5) zoom = 5
      if (zoom < 0.1) zoom = 0.1

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

    return () => {
      isDisposedRef.current = true
      clearTimeout(initTimeout)
      window.removeEventListener('resize', handleResize)

      // Store reference before cleanup
      const canvasToDispose = fabricCanvasRef.current
      fabricCanvasRef.current = null
      imageObjectRef.current = null

      // Defer disposal to next tick to avoid React reconciliation conflicts
      // Fabric.js wraps the canvas in elements that conflict with React's DOM management
      if (canvasToDispose) {
        setTimeout(() => {
          try {
            canvasToDispose.dispose()
          } catch (e) {
            // Ignore disposal errors
          }
        }, 0)
      }
    }
  }, [cropMode, cropImage])

  // Zoom controls
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

  const handleConfirmCrop = async () => {
    if (!cropImage || !imageWidth || !imageHeight || !imagePath || !imageObjectRef.current || !fabricCanvasRef.current || !canvasContainerRef.current) {
      console.error('Missing required data for crop')
      return
    }

    setIsSaving(true)

    try {
      const img = imageObjectRef.current
      const canvas = fabricCanvasRef.current
      const container = canvasContainerRef.current

      // Get container dimensions
      const containerWidth = container.offsetWidth || 800
      const containerHeight = container.offsetHeight || 500

      // Get the crop area dimensions on screen (the fixed overlay in the center)
      const cropAreaScreen = getCropAreaDimensions(containerWidth, containerHeight)

      // Get canvas state
      const canvasZoom = canvas.getZoom()
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]

      // Image properties
      const imgLeft = img.left || 0
      const imgTop = img.top || 0
      const imgScaleX = img.scaleX || 1
      const imgScaleY = img.scaleY || 1
      const srcWidth = img.width || 1
      const srcHeight = img.height || 1

      // The total scale from original image pixels to screen pixels
      // This includes: image scale (to fit canvas) * canvas zoom
      const totalScaleX = imgScaleX * canvasZoom
      const totalScaleY = imgScaleY * canvasZoom

      // Calculate where the image is on screen (in screen/container coordinates)
      // vpt[4] and vpt[5] are the pan offsets
      const imgCenterScreenX = imgLeft * canvasZoom + vpt[4]
      const imgCenterScreenY = imgTop * canvasZoom + vpt[5]

      // Image bounds on screen
      const imgScreenWidth = srcWidth * totalScaleX
      const imgScreenHeight = srcHeight * totalScaleY
      const imgScreenLeft = imgCenterScreenX - imgScreenWidth / 2
      const imgScreenTop = imgCenterScreenY - imgScreenHeight / 2

      // Crop area bounds on screen (always centered in container)
      const cropScreenLeft = (containerWidth - cropAreaScreen.width) / 2
      const cropScreenTop = (containerHeight - cropAreaScreen.height) / 2

      // Convert crop area from screen coordinates to original image pixel coordinates
      // This is the KEY calculation for 1:1 quality preservation
      const sourceX = (cropScreenLeft - imgScreenLeft) / totalScaleX
      const sourceY = (cropScreenTop - imgScreenTop) / totalScaleY
      const sourceWidth = cropAreaScreen.width / totalScaleX
      const sourceHeight = cropAreaScreen.height / totalScaleY

      // Clamp to image bounds
      const clampedSourceX = Math.max(0, Math.min(sourceX, srcWidth))
      const clampedSourceY = Math.max(0, Math.min(sourceY, srcHeight))
      const clampedSourceWidth = Math.min(sourceWidth, srcWidth - clampedSourceX)
      const clampedSourceHeight = Math.min(sourceHeight, srcHeight - clampedSourceY)

      console.log('Crop calculation (sending to Sharp):', {
        targetSize: { imageWidth, imageHeight },
        sourceRegion: {
          x: clampedSourceX,
          y: clampedSourceY,
          w: clampedSourceWidth,
          h: clampedSourceHeight
        },
        scales: { totalScaleX, totalScaleY, imgScaleX, imgScaleY, canvasZoom }
      })

      // Get current project ID
      if (!currentProjectId) {
        throw new Error('No project is currently open')
      }

      // Send to Sharp for high-quality cropping with Lanczos3 resampling
      const result = await window.electronAPI?.image.cropAndReplace(
        currentProjectId,
        imagePath,
        cropImage,
        {
          sourceX: clampedSourceX,
          sourceY: clampedSourceY,
          sourceWidth: clampedSourceWidth,
          sourceHeight: clampedSourceHeight,
          targetWidth: imageWidth,
          targetHeight: imageHeight
        }
      )

      if (result?.success) {
        console.log('✅ Image cropped and replaced successfully with Sharp')

        // Disable edit mode
        setEditModeEnabled(false)

        // Refresh the preview
        if (currentProjectId) {
          await window.electronAPI?.preview.refresh(currentProjectId)
        }

        setCropMode(false)
        handleClose()
      } else {
        throw new Error(result?.error || 'Failed to replace image')
      }
    } catch (error) {
      console.error('❌ Failed to save image:', error)
      alert(`Failed to replace image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelCrop = () => {
    // Dispose canvas BEFORE changing state to avoid React reconciliation conflicts
    if (fabricCanvasRef.current) {
      try {
        fabricCanvasRef.current.dispose()
      } catch (e) {
        // Ignore
      }
      fabricCanvasRef.current = null
      imageObjectRef.current = null
    }

    setCropMode(false)
    setCropImage(null)
    setZoomLevel(100)
    setIsCanvasReady(false)
    setUploadedFile(null)
    setSelectedAsset(null)
    setSelectedTool(null)
  }

  // Get image size text
  const getImageSize = () => {
    if (imageWidth && imageHeight) {
      return `${imageWidth} × ${imageHeight}px`
    }
    return 'Unknown size'
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Get description for hovered tool
  const getToolDescription = () => {
    if (hoveredTool === 'generate') {
      return 'Generate a new image using AI based on your description. Perfect for creating custom visuals.'
    } else if (hoveredTool === 'assets') {
      return 'Select an image from your project assets folder to replace this one.'
    } else if (hoveredTool === 'upload') {
      return 'Upload an image from your computer to replace this one. Supports all common image formats.'
    } else if (hoveredTool === 'reference') {
      return 'Add this image to your prompt context so Claude can reference it in conversations.'
    }
    return 'Choose how you want to replace this image. Hover over an option to learn more.'
  }

  if (!isOpen) return null

  // Crop Mode View (Fabric.js based)
  if (cropMode && cropImage) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* Crop Tool Modal */}
          <div className="relative w-[95vw] h-[85vh] max-w-[1200px] max-h-[800px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Background */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Header */}
            <div className="relative z-10 px-4 py-3 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white">Crop to Fit</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Required size:</span>
                  <span className="text-xs text-primary font-mono font-medium bg-primary/10 px-2 py-0.5 rounded">
                    {imageWidth} × {imageHeight}px
                  </span>
                </div>
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
                  onClick={handleCancelCrop}
                  className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div
              ref={canvasContainerRef}
              className="relative flex-1 bg-dark-bg/50 overflow-hidden"
            >
              {/* Checkerboard background */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage: `repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px`
                }}
              />

              {/* Fabric.js Canvas */}
              <canvas ref={canvasRef} className="block" />

              {/* Crop Area Overlay */}
              {isCanvasReady && canvasContainerRef.current && (() => {
                const containerWidth = canvasContainerRef.current.offsetWidth || 800
                const containerHeight = canvasContainerRef.current.offsetHeight || 500
                const cropArea = getCropAreaDimensions(containerWidth, containerHeight)

                return (
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Dark overlay outside crop area */}
                    <div className="absolute inset-0 bg-black/60" style={{
                      clipPath: `polygon(
                        0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                        calc(50% - ${cropArea.width / 2}px) calc(50% - ${cropArea.height / 2}px),
                        calc(50% - ${cropArea.width / 2}px) calc(50% + ${cropArea.height / 2}px),
                        calc(50% + ${cropArea.width / 2}px) calc(50% + ${cropArea.height / 2}px),
                        calc(50% + ${cropArea.width / 2}px) calc(50% - ${cropArea.height / 2}px),
                        calc(50% - ${cropArea.width / 2}px) calc(50% - ${cropArea.height / 2}px)
                      )`
                    }} />

                    {/* Crop area border */}
                    <div
                      className="absolute border-2 border-white/70"
                      style={{
                        left: `calc(50% - ${cropArea.width / 2}px)`,
                        top: `calc(50% - ${cropArea.height / 2}px)`,
                        width: `${cropArea.width}px`,
                        height: `${cropArea.height}px`
                      }}
                    >
                      {/* Corner indicators */}
                      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white" />
                      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white" />
                      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white" />

                      {/* Grid lines (rule of thirds) */}
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                    </div>

                    {/* Dimensions label */}
                    <div
                      className="absolute bg-black/80 px-3 py-1.5 rounded text-xs text-white font-medium"
                      style={{
                        left: `calc(50% - ${cropArea.width / 2}px)`,
                        top: `calc(50% + ${cropArea.height / 2}px + 12px)`
                      }}
                    >
                      {imageWidth} × {imageHeight}px
                    </div>
                  </div>
                )
              })()}

              {/* Loading state */}
              {!isCanvasReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/50 z-10">
                  <div className="flex items-center gap-3">
                    <Loader2 className="animate-spin text-gray-400" size={20} />
                    <span className="text-gray-400 text-sm">Loading image...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative z-10 px-4 py-3 border-t border-dark-border bg-dark-bg/50 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">
                  Scroll to zoom • Drag to reposition
                </span>
                <span className="text-[10px] text-amber-500/70">
                  ⚠ Zooming may affect quality. For best results, keep the image at its original scale.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelCrop}
                  className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCrop}
                  disabled={isSaving || !isCanvasReady}
                  className="px-5 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    )
  }

  // Default selection view
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-[800px] max-h-[600px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Header */}
        <div className="relative z-10 px-6 py-4 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Image</h2>
            <p className="text-xs text-gray-400 mt-0.5">Replace or modify this image</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-dark-bg/80 transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* LEFT COLUMN - Image Preview & Info */}
            <div className="space-y-4">
              {/* Image Thumbnail */}
              <div className="relative bg-dark-bg rounded-lg border border-dark-border overflow-hidden aspect-video flex items-center justify-center p-4">
                <img
                  src={imageSrc}
                  alt="Current image"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Image Info */}
              <div className="bg-dark-bg/50 rounded-lg border border-dark-border p-4 space-y-2.5">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Image Details</span>

                {/* Dimensions */}
                <div className="text-sm">
                  <span className="text-gray-400">Dimensions: </span>
                  <span className="text-white font-medium">{getImageSize()}</span>
                </div>

                {/* Path */}
                {imagePath && (
                  <div className="pt-2 border-t border-dark-border/50">
                    <span className="text-xs text-gray-400 block mb-1">Path:</span>
                    <p className="text-xs text-white font-mono break-all leading-relaxed bg-dark-bg/50 px-2 py-1.5 rounded">
                      {imagePath}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN - Tools */}
            <div className="space-y-3">
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Replacement Tools</span>
              </div>

              {/* Generate with AI */}
              {(!selectedTool || selectedTool === 'generate') && (
                <div className="space-y-2">
                  <button
                    onClick={handleGenerateAI}
                    onMouseEnter={() => !isSVG && setHoveredTool('generate')}
                    onMouseLeave={() => setHoveredTool(null)}
                    disabled={isSVG}
                    className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center justify-between group ${
                      isSVG
                        ? 'opacity-40 cursor-not-allowed bg-dark-bg/50 border-dark-border text-gray-500'
                        : selectedTool === 'generate'
                        ? 'bg-purple-500/10 border-purple-500/50 text-purple-400'
                        : 'bg-dark-bg/50 border-dark-border hover:border-purple-500/30 hover:bg-purple-500/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        selectedTool === 'generate'
                          ? 'bg-purple-500/20'
                          : 'bg-dark-bg/80 group-hover:bg-purple-500/10'
                      }`}>
                        <Wand2 size={18} className={selectedTool === 'generate' ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'} />
                      </div>
                      <div className="text-sm font-medium">Generate with AI</div>
                    </div>
                    {selectedTool === 'generate' ? (
                      <ChevronUp size={18} className="text-purple-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400 group-hover:text-purple-400" />
                    )}
                  </button>

                  {/* AI Prompt Input - Expandable */}
                  {selectedTool === 'generate' && (
                    <div className="pl-4 pr-2 py-3 space-y-3 bg-dark-bg/30 border border-purple-500/20 rounded-lg animate-in slide-in-from-top-2 duration-200">
                      {!isGenerating ? (
                        <>
                          <textarea
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="What image you want to generate with AI?"
                            className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => {
                                setSelectedTool(null)
                                setAiPrompt('')
                              }}
                              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSubmitAI}
                              disabled={!aiPrompt.trim()}
                              className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              Generate
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-3 py-2">
                          <Loader2 size={20} className="text-purple-400 animate-spin" />
                          <div className="flex-1">
                            <div className="text-sm text-white font-medium">Generating...</div>
                            <div className="text-xs text-gray-400 mt-0.5">Creating your image with AI</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Select from Assets */}
              {(!selectedTool || selectedTool === 'assets') && (
                <div className="space-y-2">
                  <button
                    onClick={handleAssetsSelect}
                    onMouseEnter={() => !isSVG && setHoveredTool('assets')}
                    onMouseLeave={() => setHoveredTool(null)}
                    disabled={isSVG}
                    className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center justify-between group ${
                      isSVG
                        ? 'opacity-40 cursor-not-allowed bg-dark-bg/50 border-dark-border text-gray-500'
                        : selectedTool === 'assets'
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                        : 'bg-dark-bg/50 border-dark-border hover:border-amber-500/30 hover:bg-amber-500/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg transition-colors ${
                        selectedTool === 'assets'
                          ? 'bg-amber-500/20'
                          : 'bg-dark-bg/80 group-hover:bg-amber-500/10'
                      }`}>
                        <FolderOpen size={18} className={selectedTool === 'assets' ? 'text-amber-400' : 'text-gray-400 group-hover:text-amber-400'} />
                      </div>
                      <div className="text-sm font-medium">Select from Assets</div>
                    </div>
                    {selectedTool === 'assets' ? (
                      <ChevronUp size={18} className="text-amber-400" />
                    ) : (
                      <ChevronDown size={18} className="text-gray-400 group-hover:text-amber-400" />
                    )}
                  </button>

                  {/* Assets List - Expandable */}
                  {selectedTool === 'assets' && (
                    <div className="pl-4 pr-2 py-3 space-y-2 bg-dark-bg/30 border border-amber-500/20 rounded-lg animate-in slide-in-from-top-2 duration-200 max-h-[280px] overflow-y-auto scrollbar-thin">
                      {isLoadingAssets ? (
                        <div className="flex items-center gap-3 py-2">
                          <Loader2 size={16} className="text-amber-400 animate-spin" />
                          <span className="text-xs text-gray-400">Loading images...</span>
                        </div>
                      ) : assetImages.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                          <FolderOpen size={20} className="text-gray-600" />
                          <span className="text-xs text-gray-500">No images found in assets</span>
                        </div>
                      ) : (
                        assetImages.map((asset, index) => (
                          <button
                            key={asset.path || index}
                            onClick={() => handleAssetClick(asset)}
                            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-amber-500/10 transition-colors group/item"
                          >
                            <ImageIcon size={14} className="text-amber-400 flex-shrink-0" />
                            <span className="text-xs text-gray-300 truncate min-w-0 text-left group-hover/item:text-white" style={{ flex: '1 1 0' }}>
                              {asset.name}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {asset.dimensions && (
                                <span className="text-[10px] text-amber-400 font-mono" style={{ minWidth: '60px', textAlign: 'right' }}>
                                  {asset.dimensions}
                                </span>
                              )}
                              {asset.size && (
                                <span className="text-[10px] text-gray-600 font-mono" style={{ minWidth: '50px', textAlign: 'right' }}>
                                  {asset.size}
                                </span>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Upload from Computer */}
              {(!selectedTool || selectedTool === 'upload') && (
                <div className="space-y-2">
                  <button
                    onClick={handleUpload}
                    onMouseEnter={() => !isSVG && setHoveredTool('upload')}
                    onMouseLeave={() => setHoveredTool(null)}
                    disabled={isSVG}
                    className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center gap-3 group ${
                      isSVG
                        ? 'opacity-40 cursor-not-allowed bg-dark-bg/50 border-dark-border text-gray-500'
                        : selectedTool === 'upload'
                        ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                        : 'bg-dark-bg/50 border-dark-border hover:border-blue-500/30 hover:bg-blue-500/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${
                      selectedTool === 'upload'
                        ? 'bg-blue-500/20'
                        : 'bg-dark-bg/80 group-hover:bg-blue-500/10'
                    }`}>
                      <Upload size={18} className={selectedTool === 'upload' ? 'text-blue-400' : 'text-gray-400 group-hover:text-blue-400'} />
                    </div>
                    <div className="text-sm font-medium flex-1 text-left">Upload from Computer</div>
                  </button>

                  {/* Uploaded File Preview */}
                  {uploadedFile && selectedTool === 'upload' && !cropMode && (
                    <div className="pl-4 pr-2 py-3 bg-dark-bg/30 border border-blue-500/20 rounded-lg animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-dark-bg border border-dark-border flex-shrink-0">
                          <img
                            src={uploadedFile.preview}
                            alt={uploadedFile.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white font-medium truncate">{uploadedFile.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{formatFileSize(uploadedFile.size)}</div>
                        </div>
                        <CheckCircle2 size={20} className="text-green-400 flex-shrink-0" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reference this Image */}
              {!selectedTool && (
                <button
                  onClick={handleReference}
                  onMouseEnter={() => setHoveredTool('reference')}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`w-full px-4 py-3 rounded-lg border transition-all flex items-center gap-3 group ${
                    selectedTool === 'reference'
                      ? 'bg-green-500/10 border-green-500/50 text-green-400'
                      : 'bg-dark-bg/50 border-dark-border hover:border-green-500/30 hover:bg-green-500/5 text-gray-300 hover:text-white'
                  }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${
                    selectedTool === 'reference'
                      ? 'bg-green-500/20'
                      : 'bg-dark-bg/80 group-hover:bg-green-500/10'
                  }`}>
                    <Link2 size={18} className={selectedTool === 'reference' ? 'text-green-400' : 'text-gray-400 group-hover:text-green-400'} />
                  </div>
                  <div className="text-sm font-medium flex-1 text-left">Reference this Image</div>
                </button>
              )}

              {/* Info Box - Shows description on hover or SVG warning */}
              {!selectedTool && (
                <div className={`mt-6 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isSVG
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-dark-bg/30 border border-dark-border/50'
                }`}>
                  {isSVG ? (
                    <div>
                      <p className="text-xs text-red-400 font-semibold mb-1">⚠️ SVG Image Detected</p>
                      <p className="text-xs text-red-300/80 leading-relaxed">
                        This is an SVG (vector) image. It cannot be replaced with raster formats (PNG/JPG/WebP) as it would break your application. Please edit this SVG manually or use a vector graphics editor.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {getToolDescription()}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      </div>
    </ModalPortal>
  )
}

export default ImageEditModal
