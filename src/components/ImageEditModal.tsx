import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Upload, Link2, ChevronDown, ChevronUp, Loader2, CheckCircle2, ZoomIn, ZoomOut, RotateCcw, FolderOpen, Image as ImageIcon } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { ModalPortal } from './ModalPortal'
import Konva from 'konva'

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

  // Crop tool state (Konva based)
  const [cropMode, setCropMode] = useState(false)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isCanvasReady, setIsCanvasReady] = useState(false)

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage | null>(null)
  const layerRef = useRef<Konva.Layer | null>(null)
  const imageNodeRef = useRef<Konva.Image | null>(null)
  const isDisposedRef = useRef(false)

  const handleClose = () => {
    // Dispose Konva stage BEFORE changing state
    if (stageRef.current) {
      stageRef.current.destroy()
      stageRef.current = null
      layerRef.current = null
      imageNodeRef.current = null
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
  }

  const handleSubmitAI = () => {
    if (aiPrompt.trim()) {
      setIsGenerating(true)

      // TODO: Implement AI generation
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

  // Initialize Konva stage when crop mode is enabled
  useEffect(() => {
    if (!cropMode || !cropImage || !canvasContainerRef.current) return

    isDisposedRef.current = false

    const container = canvasContainerRef.current
    const containerW = container.offsetWidth || 800
    const containerH = container.offsetHeight || 500

    // Create a wrapper div for Konva to prevent React DOM conflicts
    const konvaWrapper = document.createElement('div')
    konvaWrapper.style.width = '100%'
    konvaWrapper.style.height = '100%'
    konvaWrapper.style.position = 'absolute'
    konvaWrapper.style.top = '0'
    konvaWrapper.style.left = '0'
    container.appendChild(konvaWrapper)

    // Create Konva Stage
    const stage = new Konva.Stage({
      container: konvaWrapper,
      width: containerW,
      height: containerH,
    })
    stageRef.current = stage

    // Create Layer
    const layer = new Konva.Layer()
    stage.add(layer)
    layerRef.current = layer

    // Load image
    const imageObj = new window.Image()
    imageObj.crossOrigin = 'anonymous'
    imageObj.onload = () => {
      if (isDisposedRef.current) return

      const srcW = imageObj.width
      const srcH = imageObj.height

      // Calculate the crop area dimensions on screen
      const cropArea = getCropAreaDimensions(containerW, containerH)

      // Calculate scale for 1:1 quality
      const targetW = imageWidth || srcW
      const targetH = imageHeight || srcH

      const idealScaleX = cropArea.width / targetW
      const idealScaleY = cropArea.height / targetH
      let fitScale = Math.min(idealScaleX, idealScaleY)

      const minScaleToFillCrop = Math.max(
        cropArea.width / srcW,
        cropArea.height / srcH
      )
      fitScale = Math.max(fitScale, minScaleToFillCrop)

      // Create Konva Image
      const konvaImage = new Konva.Image({
        image: imageObj,
        x: containerW / 2,
        y: containerH / 2,
        offsetX: srcW / 2,
        offsetY: srcH / 2,
        scaleX: fitScale,
        scaleY: fitScale,
        draggable: true,
      })

      layer.add(konvaImage)
      imageNodeRef.current = konvaImage
      layer.draw()

      setZoomLevel(Math.round(fitScale * 100))
      setIsCanvasReady(true)
    }
    imageObj.src = cropImage

    // Mouse wheel zoom
    stage.on('wheel', (e) => {
      e.evt.preventDefault()
      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()
      if (!pointer) return

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }

      const direction = e.evt.deltaY > 0 ? -1 : 1
      const scaleBy = 1.1
      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
      newScale = Math.max(0.1, Math.min(5, newScale))

      stage.scale({ x: newScale, y: newScale })

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      }
      stage.position(newPos)

      setZoomLevel(Math.round(newScale * 100))
    })

    // Handle window resize
    const handleResize = () => {
      if (isDisposedRef.current || !stageRef.current) return
      const w = container.offsetWidth || container.clientWidth
      const h = container.offsetHeight || container.clientHeight
      stageRef.current.width(w)
      stageRef.current.height(h)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      isDisposedRef.current = true
      window.removeEventListener('resize', handleResize)
      if (stageRef.current) {
        stageRef.current.destroy()
        stageRef.current = null
        layerRef.current = null
        imageNodeRef.current = null
      }
      // Clean up the wrapper div we created
      if (konvaWrapper.parentNode) {
        konvaWrapper.parentNode.removeChild(konvaWrapper)
      }
      setIsCanvasReady(false)
    }
  }, [cropMode, cropImage])

  // Zoom controls
  const handleZoomIn = () => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = Math.min(oldScale * 1.2, 5)
    stage.scale({ x: newScale, y: newScale })
    setZoomLevel(Math.round(newScale * 100))
  }

  const handleZoomOut = () => {
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const newScale = Math.max(oldScale * 0.8, 0.1)
    stage.scale({ x: newScale, y: newScale })
    setZoomLevel(Math.round(newScale * 100))
  }

  const handleResetZoom = () => {
    const stage = stageRef.current
    const img = imageNodeRef.current
    if (!stage || !img) return

    stage.scale({ x: 1, y: 1 })
    stage.position({ x: 0, y: 0 })
    setZoomLevel(100)

    // Recenter image
    const containerW = stage.width()
    const containerH = stage.height()
    img.x(containerW / 2)
    img.y(containerH / 2)
    layerRef.current?.draw()
  }

  const handleConfirmCrop = async () => {
    if (!cropImage || !imageWidth || !imageHeight || !imagePath || !imageNodeRef.current || !stageRef.current || !canvasContainerRef.current) {
      console.error('Missing required data for crop')
      return
    }

    setIsSaving(true)

    try {
      const img = imageNodeRef.current
      const stage = stageRef.current
      const container = canvasContainerRef.current

      // Get container dimensions
      const containerWidth = container.offsetWidth || 800
      const containerHeight = container.offsetHeight || 500

      // Get the crop area dimensions on screen (the fixed overlay in the center)
      const cropAreaScreen = getCropAreaDimensions(containerWidth, containerHeight)

      // Get stage state
      const stageScale = stage.scaleX()
      const stagePos = stage.position()

      // Image properties
      const imgX = img.x()
      const imgY = img.y()
      const imgScaleX = img.scaleX()
      const imgScaleY = img.scaleY()
      const srcWidth = img.image()?.width || 1
      const srcHeight = img.image()?.height || 1
      const offsetX = img.offsetX()
      const offsetY = img.offsetY()

      // Total scale from original image pixels to screen pixels
      const totalScaleX = imgScaleX * stageScale
      const totalScaleY = imgScaleY * stageScale

      // Calculate image position on screen
      const imgScreenX = (imgX - offsetX * imgScaleX) * stageScale + stagePos.x
      const imgScreenY = (imgY - offsetY * imgScaleY) * stageScale + stagePos.y

      // Crop area bounds on screen (always centered in container)
      const cropScreenLeft = (containerWidth - cropAreaScreen.width) / 2
      const cropScreenTop = (containerHeight - cropAreaScreen.height) / 2

      // Convert crop area from screen coordinates to original image pixel coordinates
      const sourceX = (cropScreenLeft - imgScreenX) / totalScaleX
      const sourceY = (cropScreenTop - imgScreenY) / totalScaleY
      const sourceWidth = cropAreaScreen.width / totalScaleX
      const sourceHeight = cropAreaScreen.height / totalScaleY

      // Clamp to image bounds
      const clampedSourceX = Math.max(0, Math.min(sourceX, srcWidth))
      const clampedSourceY = Math.max(0, Math.min(sourceY, srcHeight))
      const clampedSourceWidth = Math.min(sourceWidth, srcWidth - clampedSourceX)
      const clampedSourceHeight = Math.min(sourceHeight, srcHeight - clampedSourceY)

      if (!currentProjectId) {
        throw new Error('No project is currently open')
      }

      // Send to Sharp for high-quality cropping
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
        setEditModeEnabled(false)

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
    if (stageRef.current) {
      stageRef.current.destroy()
      stageRef.current = null
      layerRef.current = null
      imageNodeRef.current = null
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

  // Crop Mode View (Konva based)
  if (cropMode && cropImage) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* Crop Tool Modal */}
          <div className="relative w-[95vw] h-[85vh] max-w-[1200px] max-h-[800px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
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

              {/* Konva will mount here */}

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
            <div className="px-4 py-3 border-t border-dark-border bg-dark-bg/50 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-gray-500">
                  Scroll to zoom • Drag to reposition
                </span>
                <span className="text-[10px] text-amber-500/70">
                  Zooming may affect quality. For best results, keep the image at its original scale.
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
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
        <div className="p-6">
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
                      <p className="text-xs text-red-400 font-semibold mb-1">SVG Image Detected</p>
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
