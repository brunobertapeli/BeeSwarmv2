import { useState, useEffect, useRef } from 'react'
import { X, Wand2, Upload, Link2, ChevronDown, ChevronUp, Loader2, CheckCircle2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

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
  const { setModalFreezeActive, setModalFreezeImage, layoutState, setEditModeEnabled, addImageReference, setPrefilledMessage } = useLayoutStore()
  const [selectedTool, setSelectedTool] = useState<'generate' | 'upload' | 'reference' | null>(null)
  const [hoveredTool, setHoveredTool] = useState<'generate' | 'upload' | 'reference' | null>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; preview: string; size: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if original image is SVG (vector format - cannot be replaced with raster)
  const isSVG = imagePath?.toLowerCase().endsWith('.svg') || imageSrc?.includes('svg')

  // Crop tool state
  const [cropMode, setCropMode] = useState(false)
  const [cropImage, setCropImage] = useState<string | null>(null)
  const [cropImageDimensions, setCropImageDimensions] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isSaving, setIsSaving] = useState(false)
  const cropContainerRef = useRef<HTMLDivElement>(null)

  // Handle modal freeze when modal opens/closes
  useEffect(() => {
    const handleFreeze = async () => {
      if (isOpen && currentProjectId) {
        // Capture fresh image to match current layout state
        const result = await window.electronAPI?.layout.captureModalFreeze(currentProjectId)

        if (result?.success && result.freezeImage) {
          setModalFreezeImage(result.freezeImage)
          setModalFreezeActive(true)
          // Hide BrowserView (unless in TOOLS state where it's already hidden)
          if (layoutState !== 'TOOLS') {
            await window.electronAPI?.preview.hide(currentProjectId)
          }
        }
      } else {
        // Unfreeze when modal closes
        setModalFreezeActive(false)
        // Show BrowserView again (only if not in TOOLS)
        if (currentProjectId && layoutState !== 'TOOLS') {
          await window.electronAPI?.preview.show(currentProjectId)
        }
      }
    }

    handleFreeze()
  }, [isOpen, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  const handleClose = () => {
    setSelectedTool(null)
    setAiPrompt('')
    setUploadedFile(null)
    setIsGenerating(false)
    setCropMode(false)
    setCropImage(null)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    onClose()
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

        // Load image to get dimensions and enter crop mode
        const img = new Image()
        img.onload = () => {
          setCropImageDimensions({ width: img.width, height: img.height })
          setCropImage(result)
          setCropMode(true)
          setZoom(1)
          setPosition({ x: 0, y: 0 })
        }
        img.src = result
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

  // Crop tool handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleConfirmCrop = async () => {
    if (!cropImage || !imageWidth || !imageHeight || !imagePath) {
      console.error('Missing required data for crop')
      return
    }

    setIsSaving(true)

    try {
      console.log('🎨 Starting crop with:', { zoom, position, imageWidth, imageHeight })

      // Get the original image format from the path
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'png'
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                       ext === 'webp' ? 'image/webp' :
                       ext === 'gif' ? 'image/gif' : 'image/png'

      // Create canvas with original image dimensions
      const canvas = document.createElement('canvas')
      canvas.width = imageWidth
      canvas.height = imageHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Load the uploaded image
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = cropImage
      })

      // Calculate the crop area dimensions (scaled representation on screen)
      const cropArea = getCropAreaDimensions()

      // Get the container dimensions (where the image is displayed)
      const containerRect = cropContainerRef.current?.getBoundingClientRect()
      if (!containerRect) {
        throw new Error('Could not get container dimensions')
      }

      // Calculate center of container
      const centerX = containerRect.width / 2
      const centerY = containerRect.height / 2

      // The displayed image dimensions after zoom
      const displayedImageWidth = img.width * zoom
      const displayedImageHeight = img.height * zoom

      // Calculate the top-left corner of the crop area (fixed in center)
      const cropAreaLeft = centerX - cropArea.width / 2
      const cropAreaTop = centerY - cropArea.height / 2

      // Calculate where the displayed image's top-left corner is
      // The image is centered, then translated by position, then zoomed
      // Zoom happens from center, so the offset needs to account for that
      const imageLeft = centerX + position.x - displayedImageWidth / 2
      const imageTop = centerY + position.y - displayedImageHeight / 2

      // Calculate the crop area relative to the image
      let sourceX = (cropAreaLeft - imageLeft) / zoom
      let sourceY = (cropAreaTop - imageTop) / zoom
      let sourceWidth = cropArea.width / zoom
      let sourceHeight = cropArea.height / zoom

      console.log('📐 Raw crop calculations:', {
        containerRect,
        cropArea,
        uploadedImageSize: { width: img.width, height: img.height },
        displayedSize: { width: img.width * zoom, height: img.height * zoom },
        zoom,
        position,
        imagePosition: { imageLeft, imageTop },
        cropAreaPosition: { cropAreaLeft, cropAreaTop },
        rawSource: { sourceX, sourceY, sourceWidth, sourceHeight }
      })

      // Clamp source coordinates to valid range (0 to image dimensions)
      sourceX = Math.max(0, Math.min(sourceX, img.width))
      sourceY = Math.max(0, Math.min(sourceY, img.height))
      sourceWidth = Math.min(sourceWidth, img.width - sourceX)
      sourceHeight = Math.min(sourceHeight, img.height - sourceY)

      console.log('📐 Clamped source:', { sourceX, sourceY, sourceWidth, sourceHeight })

      // Validate that we have valid dimensions
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        throw new Error('Invalid crop dimensions - the crop area is outside the image bounds')
      }

      // Draw the cropped and scaled image to canvas
      // Draw from source to destination, scaling appropriately
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceWidth, sourceHeight, // Source rectangle
        0, 0, imageWidth, imageHeight // Destination rectangle (full canvas)
      )

      console.log('✅ Canvas drawn successfully')

      // Convert canvas to blob with original format
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, mimeType, 0.95)
      })

      if (!blob) {
        throw new Error('Could not create image blob')
      }

      // Convert blob to base64 data URL
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      console.log('💾 Saving image to:', imagePath)

      // Get current project ID
      if (!currentProjectId) {
        throw new Error('No project is currently open')
      }

      // Send to Electron to save
      const result = await window.electronAPI?.image.replace(currentProjectId, imagePath, dataUrl)

      if (result?.success) {
        console.log('✅ Image replaced successfully')

        // Disable edit mode
        setEditModeEnabled(false)

        // Refresh the preview to show the updated image
        if (currentProjectId) {
          await window.electronAPI?.preview.refresh(currentProjectId)
        }

        setCropMode(false)
        handleClose()
      } else {
        throw new Error(result?.error || 'Failed to replace image')
      }
    } catch (error) {
      console.error('❌ Failed to crop and save image:', error)
      alert(`Failed to replace image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelCrop = () => {
    setCropMode(false)
    setCropImage(null)
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setUploadedFile(null) // Reset uploaded file state
    setSelectedTool(null) // Clear selected tool
  }

  // Calculate crop area dimensions (scaled down to fit in modal)
  const getCropAreaDimensions = () => {
    if (!imageWidth || !imageHeight) return { width: 300, height: 200 }

    const maxWidth = 400
    const maxHeight = 300
    const aspectRatio = imageWidth / imageHeight

    let width = imageWidth
    let height = imageHeight

    if (width > maxWidth || height > maxHeight) {
      if (aspectRatio > 1) {
        // Landscape
        width = maxWidth
        height = maxWidth / aspectRatio
      } else {
        // Portrait
        height = maxHeight
        width = maxHeight * aspectRatio
      }
    }

    return { width, height }
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
    } else if (hoveredTool === 'upload') {
      return 'Upload an image from your computer to replace this one. Supports all common image formats.'
    } else if (hoveredTool === 'reference') {
      return 'Add this image to your prompt context so Claude can reference it in conversations.'
    }
    return 'Choose how you want to replace this image. Hover over an option to learn more.'
  }

  if (!isOpen) return null

  // Crop Mode View
  if (cropMode && cropImage) {
    const cropArea = getCropAreaDimensions()

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

        {/* Crop Tool Modal */}
        <div className="relative w-[900px] h-[700px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="relative z-10 px-6 py-4 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Adjust Image</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Position and zoom the image to fit the {imageWidth} × {imageHeight}px area
              </p>
            </div>
            <button
              onClick={handleCancelCrop}
              className="p-2 rounded-lg hover:bg-dark-bg/80 transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Crop Area */}
          <div
            ref={cropContainerRef}
            className="flex-1 relative bg-dark-bg overflow-hidden flex items-center justify-center"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Image with zoom and pan */}
            <div
              className="absolute inset-0 flex items-center justify-center cursor-move"
              onMouseDown={handleMouseDown}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
            >
              <img
                src={cropImage}
                alt="Crop preview"
                className="max-w-none"
                style={{
                  width: `${cropImageDimensions.width}px`,
                  height: `${cropImageDimensions.height}px`,
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
                draggable={false}
              />
            </div>

            {/* Crop overlay with transparent center */}
            <div className="absolute inset-0 pointer-events-none">
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
                className="absolute border-2 border-white/50 pointer-events-none"
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
          </div>

          {/* Controls */}
          <div className="relative z-10 px-6 py-4 border-t border-dark-border bg-dark-bg/50 flex items-center justify-between">
            {/* Zoom controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 mr-2">Zoom:</span>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg bg-dark-bg hover:bg-dark-bg/80 border border-dark-border text-gray-400 hover:text-white transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm text-white font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg bg-dark-bg hover:bg-dark-bg/80 border border-dark-border text-gray-400 hover:text-white transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 rounded-lg bg-dark-bg hover:bg-dark-bg/80 border border-dark-border text-gray-400 hover:text-white transition-colors ml-2"
                title="Reset"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancelCrop}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCrop}
                disabled={isSaving}
                className="px-6 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
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
    )
  }

  // Default selection view
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
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

              {/* Upload from Computer */}
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

              {/* Reference this Image */}
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

              {/* Info Box - Shows description on hover or SVG warning */}
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
  )
}

export default ImageEditModal
