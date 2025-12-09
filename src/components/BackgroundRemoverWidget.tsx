import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, Wand2, Loader2, Trash2, FolderOpen, FolderPlus, ExternalLink, Check, Lock, Crown, ImageIcon, Sparkles } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'

type ResizeDirection = 's' | 'n' | 'e' | 'w' | null

interface AssetImage {
  name: string
  path: string
  dimensions?: string
  size?: string
  thumbnail?: string
}

export function BackgroundRemoverWidget() {
  const {
    backgroundRemoverWidgetPosition,
    setBackgroundRemoverWidgetPosition,
    backgroundRemoverWidgetSize,
    setBackgroundRemoverWidgetSize,
    backgroundRemoverWidgetZIndex,
    setBackgroundRemoverWidgetEnabled,
    bringWidgetToFront
  } = useLayoutStore()

  const { currentProjectId, user } = useAppStore()

  // Plan access check
  const userPlan = user?.plan || 'free'
  const hasBgRemovalAccess = userPlan === 'plus' || userPlan === 'premium'

  // State
  const [error, setError] = useState<string | null>(null)
  const [resultLocalPath, setResultLocalPath] = useState<string | null>(null)
  const [savedToAssets, setSavedToAssets] = useState(false)

  // Drag and resize state
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null)
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Local state for the widget
  const [inputImage, setInputImage] = useState<string | null>(null)
  const [inputImageName, setInputImageName] = useState<string>('')
  const [inputImagePath, setInputImagePath] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [stateLoaded, setStateLoaded] = useState(false)

  // Comparison slider state
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isSliding, setIsSliding] = useState(false)

  // Assets browser state
  const [showAssets, setShowAssets] = useState(false)
  const [assetImages, setAssetImages] = useState<AssetImage[]>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const MIN_WIDTH = 460
  const MAX_WIDTH = 800
  const MIN_HEIGHT = 350
  const MAX_HEIGHT = 650

  // Load saved state from database
  useEffect(() => {
    const loadSavedState = async () => {
      if (!currentProjectId) return

      try {
        const result = await window.electronAPI?.backgroundRemover?.loadState(currentProjectId)
        if (result?.success && result.state) {
          const { inputImagePath: savedInputPath, inputImageName: savedName, resultImagePath: savedResultPath } = result.state

          // Load input image from disk
          if (savedInputPath && savedName) {
            try {
              const imageData = await window.electronAPI?.files?.readFileAsBase64(savedInputPath)
              if (imageData) {
                const ext = savedInputPath.split('.').pop()?.toLowerCase()
                let mimeType = 'image/png'
                if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
                else if (ext === 'webp') mimeType = 'image/webp'

                setInputImage(`data:${mimeType};base64,${imageData}`)
                setInputImageName(savedName)
                setInputImagePath(savedInputPath)
              }
            } catch (err) {
              console.error('Failed to load input image:', err)
            }
          }

          // Load result image from disk
          if (savedResultPath) {
            try {
              const imageData = await window.electronAPI?.files?.readFileAsBase64(savedResultPath)
              if (imageData) {
                setResultImage(`data:image/png;base64,${imageData}`)
                setResultLocalPath(savedResultPath)
              }
            } catch (err) {
              console.error('Failed to load result image:', err)
            }
          }
        }
      } catch (err) {
        console.error('Failed to load saved state:', err)
      } finally {
        setStateLoaded(true)
      }
    }
    loadSavedState()
  }, [currentProjectId])

  // Save state to database when images change
  useEffect(() => {
    if (!currentProjectId || !stateLoaded) return

    const saveState = async () => {
      await window.electronAPI?.backgroundRemover?.saveState(currentProjectId, {
        inputImagePath,
        inputImageName: inputImageName || null,
        resultImagePath: resultLocalPath
      })
    }
    saveState()
  }, [currentProjectId, inputImagePath, inputImageName, resultLocalPath, stateLoaded])

  // Load images from assets folder
  const loadAssetImages = useCallback(async () => {
    if (!currentProjectId) return

    setIsLoadingAssets(true)
    try {
      const result = await window.electronAPI?.projects.getAssetsStructure(currentProjectId)

      if (result?.success && result.assets) {
        const images: AssetImage[] = []

        const findImages = (nodes: any[], parentPath = '') => {
          for (const node of nodes) {
            if (node.type === 'file' && node.fileType === 'image') {
              images.push({
                name: node.name,
                path: node.path || `${parentPath}/${node.name}`,
                dimensions: node.dimensions,
                size: node.size
              })
            } else if (node.type === 'folder' && node.children) {
              findImages(node.children, node.path || `${parentPath}/${node.name}`)
            }
          }
        }

        findImages(result.assets)

        // Load thumbnails for each image
        const imagesWithThumbnails = await Promise.all(
          images.map(async (img) => {
            try {
              const fileData = await window.electronAPI?.files?.readFileAsBase64?.(img.path)
              if (fileData) {
                const ext = img.name.split('.').pop()?.toLowerCase()
                let mimeType = 'image/png'
                if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
                else if (ext === 'gif') mimeType = 'image/gif'
                else if (ext === 'webp') mimeType = 'image/webp'
                else if (ext === 'ico') mimeType = 'image/x-icon'
                return { ...img, thumbnail: `data:${mimeType};base64,${fileData}` }
              }
            } catch {
              // Ignore thumbnail load errors
            }
            return img
          })
        )

        setAssetImages(imagesWithThumbnails)
      }
    } catch (error) {
      console.error('Failed to load asset images:', error)
    } finally {
      setIsLoadingAssets(false)
    }
  }, [currentProjectId])

  // Handle asset click
  const handleAssetClick = useCallback(async (asset: AssetImage) => {
    try {
      const fileData = await window.electronAPI?.files?.readFileAsBase64?.(asset.path)
      if (fileData) {
        const ext = asset.name.split('.').pop()?.toLowerCase()
        let mimeType = 'image/png'
        if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg'
        else if (ext === 'gif') mimeType = 'image/gif'
        else if (ext === 'webp') mimeType = 'image/webp'

        const preview = `data:${mimeType};base64,${fileData}`

        setInputImage(preview)
        setInputImageName(asset.name)
        setInputImagePath(asset.path)
        setResultImage(null)
        setResultLocalPath(null)
        setShowAssets(false)
        setSliderPosition(50)
      }
    } catch (error) {
      console.error('Failed to load asset image:', error)
    }
  }, [])

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setInputImage(event.target?.result as string)
          setInputImageName(file.name)
          setInputImagePath(null)
          setResultImage(null)
          setResultLocalPath(null)
          setSliderPosition(50)
        }
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  // Handle file input change
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setInputImage(event.target?.result as string)
        setInputImageName(file.name)
        setInputImagePath(null)
        setResultImage(null)
        setResultLocalPath(null)
        setSliderPosition(50)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Remove background using BRIA RMBG 2.0 via Replicate
  const handleRemoveBackground = useCallback(async () => {
    if (!inputImage || !hasBgRemovalAccess || !currentProjectId) return

    setIsProcessing(true)
    setError(null)

    try {
      const base64 = inputImage.split(',')[1]
      const result = await window.electronAPI?.backgroundRemover?.remove(base64, currentProjectId)

      if (result?.success) {
        setResultImage(result.imageDataUrl || null)
        setResultLocalPath(result.localPath || null)
        setSliderPosition(50)
      } else {
        setError(result?.error || 'Background removal failed')
      }
    } catch (err: any) {
      setError(err.message || 'Background removal failed')
    } finally {
      setIsProcessing(false)
    }
  }, [inputImage, hasBgRemovalAccess, currentProjectId])

  // Clear all
  const clearAll = useCallback(() => {
    setInputImage(null)
    setInputImageName('')
    setInputImagePath(null)
    setResultImage(null)
    setResultLocalPath(null)
    setError(null)
    setSliderPosition(50)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Handle upgrade click
  const handleUpgrade = async () => {
    await window.electronAPI?.shell?.openExternal('https://www.codedeckai.com/#pricing')
  }

  // Handle select from assets click
  const handleSelectFromAssets = useCallback(() => {
    setShowAssets(true)
    loadAssetImages()
  }, [loadAssetImages])

  // Slider handling
  const handleSliderMove = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!isSliding || !imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPosition(percentage)
  }, [isSliding])

  const handleSliderStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsSliding(true)
  }, [])

  useEffect(() => {
    const handleMouseUp = () => setIsSliding(false)
    const handleMouseMove = (e: MouseEvent) => {
      if (isSliding) handleSliderMove(e)
    }

    if (isSliding) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSliding, handleSliderMove])

  // Resize handling
  const handleResizeStart = (e: React.MouseEvent, direction: ResizeDirection) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeDirection(direction)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: backgroundRemoverWidgetSize.width,
      height: backgroundRemoverWidgetSize.height
    })
  }

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

    setIsDragging(true)
    setDragOffset({
      x: e.clientX - backgroundRemoverWidgetPosition.x,
      y: e.clientY - backgroundRemoverWidgetPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y

        const padding = 5
        const headerHeight = 40 + padding
        const bottomReservedArea = 200 + 2
        const minX = padding
        const maxX = window.innerWidth - backgroundRemoverWidgetSize.width - padding
        const minY = headerHeight
        const maxY = window.innerHeight - backgroundRemoverWidgetSize.height - bottomReservedArea - padding

        setBackgroundRemoverWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        let newWidth = resizeStart.width
        let newHeight = resizeStart.height
        let newX = backgroundRemoverWidgetPosition.x
        let newY = backgroundRemoverWidgetPosition.y

        if (resizeDirection === 'e') {
          newWidth = resizeStart.width + deltaX
        }
        if (resizeDirection === 'w') {
          newWidth = resizeStart.width - deltaX
          newX = backgroundRemoverWidgetPosition.x + deltaX
        }
        if (resizeDirection === 's') {
          newHeight = resizeStart.height + deltaY
        }
        if (resizeDirection === 'n') {
          newHeight = resizeStart.height - deltaY
          newY = backgroundRemoverWidgetPosition.y + deltaY
        }

        newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH))
        newHeight = Math.max(MIN_HEIGHT, Math.min(newHeight, MAX_HEIGHT))

        setBackgroundRemoverWidgetSize({ width: newWidth, height: newHeight })

        if (resizeDirection === 'w' || resizeDirection === 'n') {
          setBackgroundRemoverWidgetPosition({ x: newX, y: newY })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeDirection(null)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragOffset, resizeDirection, resizeStart, backgroundRemoverWidgetPosition, backgroundRemoverWidgetSize, setBackgroundRemoverWidgetPosition, setBackgroundRemoverWidgetSize])

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${backgroundRemoverWidgetPosition.x}px`,
        top: `${backgroundRemoverWidgetPosition.y}px`,
        width: `${backgroundRemoverWidgetSize.width}px`,
        height: `${backgroundRemoverWidgetSize.height}px`,
        zIndex: backgroundRemoverWidgetZIndex
      }}
      onMouseDown={(e) => { bringWidgetToFront('backgroundRemover'); handleMouseDown(e); }}
    >

      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 cursor-move select-none"
        style={{ minHeight: '37px', paddingTop: '6px', paddingBottom: '6px' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">Background Remover</h3>

          <button
            onClick={() => setBackgroundRemoverWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col h-[calc(100%-37px)] relative">
        {/* Plan Blocker Overlay - Only covers content */}
        {!hasBgRemovalAccess && (
          <div className="absolute inset-0 z-50 bg-[#0d0d0f] flex flex-col items-center justify-center p-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-orange-500/20 blur-2xl rounded-full" />
              <div className="relative bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6 max-w-xs text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Crown size={22} className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">Upgrade to Plus</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Background removal is available on Plus and Premium plans.
                </p>
                <button
                  onClick={handleUpgrade}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-sm font-semibold rounded-lg transition-all shadow-lg shadow-amber-500/25"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Image Area */}
        <div className="flex-1 p-4 overflow-hidden">
          {showAssets ? (
            // Assets Browser
            <div className="h-full flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Select from Assets</span>
                <button
                  onClick={() => setShowAssets(false)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
              <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
                <div className="h-full p-2 overflow-y-auto scrollbar-thin">
                  {isLoadingAssets ? (
                    <div className="flex items-center justify-center gap-3 py-12">
                      <Loader2 size={18} className="text-violet-400 animate-spin" />
                      <span className="text-sm text-gray-400">Loading...</span>
                    </div>
                  ) : assetImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12">
                      <FolderOpen size={24} className="text-gray-600" />
                      <span className="text-sm text-gray-500">No images in assets</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {assetImages.map((asset, index) => (
                        <button
                          key={asset.path || index}
                          onClick={() => handleAssetClick(asset)}
                          className="group aspect-square rounded-lg bg-dark-bg/50 border border-dark-border/50 hover:border-primary/30 overflow-hidden transition-all relative"
                        >
                          {asset.thumbnail ? (
                            <img
                              src={asset.thumbnail}
                              alt={asset.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <ImageIcon size={20} className="text-gray-600" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                            <span className="text-[10px] text-gray-300 truncate block">{asset.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : !inputImage ? (
            // Upload Area
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={openFilePicker}
              className={`h-full flex flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
                isDragOver
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.01]'
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                isDragOver ? 'bg-violet-500/10' : 'bg-white/[0.03]'
              }`}>
                <Upload size={28} className={isDragOver ? 'text-violet-400' : 'text-gray-500'} />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-300 mb-1">Drop image here or click to browse</p>
                <p className="text-xs text-gray-500">PNG, JPG, WebP supported</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-px w-12 bg-white/[0.06]" />
                <span className="text-[10px] text-gray-600 uppercase tracking-wider">or</span>
                <div className="h-px w-12 bg-white/[0.06]" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectFromAssets()
                }}
                className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                Select from assets
              </button>
            </div>
          ) : (
            // Image Comparison View
            <div className="h-full flex flex-col gap-3">
              {/* Comparison Container */}
              <div
                ref={imageContainerRef}
                className="flex-1 relative rounded-xl overflow-hidden bg-white/[0.02] border border-white/[0.04]"
              >
                {/* Checkered background for transparency */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, #1a1a1c 25%, transparent 25%),
                      linear-gradient(-45deg, #1a1a1c 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #1a1a1c 75%),
                      linear-gradient(-45deg, transparent 75%, #1a1a1c 75%)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                  }}
                />

                {/* Original Image - Base layer (always visible) */}
                {resultImage ? (
                  <img
                    src={inputImage}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <img
                    src={inputImage}
                    alt="Original"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                )}

                {/* Result Image - Clipped on top (shows on right side of slider) */}
                {resultImage && (
                  <>
                    {/* Checkered background for result side only */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        clipPath: `inset(0 0 0 ${sliderPosition}%)`,
                        backgroundImage: `
                          linear-gradient(45deg, #2a2a2c 25%, transparent 25%),
                          linear-gradient(-45deg, #2a2a2c 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, #2a2a2c 75%),
                          linear-gradient(-45deg, transparent 75%, #2a2a2c 75%)
                        `,
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                        backgroundColor: '#1a1a1c'
                      }}
                    />
                    <img
                      src={resultImage}
                      alt="Result"
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                      style={{
                        clipPath: `inset(0 0 0 ${sliderPosition}%)`
                      }}
                      draggable={false}
                    />

                    {/* Slider Handle */}
                    <div
                      className="absolute top-0 bottom-0 z-20 cursor-ew-resize"
                      style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)', width: '40px' }}
                      onMouseDown={handleSliderStart}
                    >
                      {/* Vertical Line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white shadow-lg -translate-x-1/2" />

                      {/* Circle Handle */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center">
                        <div className="flex gap-1">
                          <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                          <div className="w-0.5 h-4 bg-gray-400 rounded-full" />
                        </div>
                      </div>
                    </div>

                    {/* Labels */}
                    <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-medium z-10">
                      Original
                    </div>
                    <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/70 text-[10px] text-white font-medium z-10">
                      Result
                    </div>
                  </>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full animate-pulse" />
                      <Loader2 size={40} className="text-violet-400 animate-spin relative" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-white font-medium">Removing background...</p>
                      <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
                    </div>
                  </div>
                )}

                {/* Bottom Right Actions */}
                <div className="absolute bottom-3 right-3 flex gap-1.5">
                  {resultImage && (
                    <>
                      <button
                        onClick={() => {
                          if (resultLocalPath) {
                            window.electronAPI?.shell?.showItemInFolder(resultLocalPath)
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center transition-all"
                        title="Show in Finder"
                      >
                        <FolderOpen size={14} className="text-gray-300" />
                      </button>
                      <button
                        onClick={async () => {
                          if (resultLocalPath && currentProjectId) {
                            try {
                              const assetsResult = await window.electronAPI?.projects?.getAssetsStructure(currentProjectId)
                              if (!assetsResult?.success || !assetsResult.assets) {
                                throw new Error('Could not find assets folder')
                              }
                              const imagesFolder = assetsResult.assets.find((a: any) => a.name === 'images' && a.type === 'folder')
                              if (!imagesFolder?.path) {
                                throw new Error('Images folder not found in assets')
                              }
                              const imageData = await window.electronAPI?.files?.readFileAsBase64(resultLocalPath)
                              if (imageData) {
                                const fileName = resultLocalPath.split('/').pop() || `bg_removed_${Date.now()}.png`
                                const destPath = `${imagesFolder.path}/${fileName}`
                                await window.electronAPI?.files?.saveBase64Image(destPath, imageData)
                                setSavedToAssets(true)
                                setTimeout(() => setSavedToAssets(false), 2000)
                              }
                            } catch (err: any) {
                              console.error('Failed to save to assets:', err)
                            }
                          }
                        }}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
                          savedToAssets
                            ? 'bg-green-500/20 border-green-500/40'
                            : 'bg-black/60 hover:bg-black/80 border-white/10'
                        }`}
                        title="Save to Assets"
                      >
                        {savedToAssets ? (
                          <Check size={14} className="text-green-400" />
                        ) : (
                          <FolderPlus size={14} className="text-gray-300" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          if (resultLocalPath) {
                            window.electronAPI?.shell?.openPath(resultLocalPath)
                          }
                        }}
                        className="w-8 h-8 rounded-lg bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center transition-all"
                        title="Open"
                      >
                        <ExternalLink size={14} className="text-gray-300" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={clearAll}
                    className="w-8 h-8 rounded-lg bg-black/60 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition-all"
                    title="Clear"
                  >
                    <Trash2 size={14} className="text-gray-300" />
                  </button>
                </div>

                {/* File name badge */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/60 border border-white/10">
                  <span className="text-xs text-gray-300 truncate max-w-[200px] block">{inputImageName}</span>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        {inputImage && !showAssets && (
          <div className="px-4 pb-4 flex gap-2">
            {resultImage ? (
              <button
                onClick={clearAll}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all bg-dark-bg/50 border border-dark-border/50 hover:border-dark-border text-gray-300 hover:text-white"
              >
                <Upload size={16} />
                New Image
              </button>
            ) : (
              <button
                onClick={handleRemoveBackground}
                disabled={isProcessing || !currentProjectId || !hasBgRemovalAccess}
                className={`flex-1 py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  isProcessing || !currentProjectId
                    ? 'bg-dark-bg/50 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    Remove Background
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Resize Handles */}
      <div
        onMouseDown={(e) => handleResizeStart(e, 'n')}
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 's')}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'e')}
        className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize z-10"
      />
      <div
        onMouseDown={(e) => handleResizeStart(e, 'w')}
        className="absolute top-0 left-0 bottom-0 w-2 cursor-ew-resize z-10"
      />
    </div>
  )
}
