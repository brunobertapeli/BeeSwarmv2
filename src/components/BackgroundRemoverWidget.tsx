import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Upload, ImageIcon, Wand2, Loader2, Trash2, FolderOpen, FolderPlus, ExternalLink, Check, Lock, Crown } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'

type ResizeDirection = 's' | 'n' | 'e' | 'w' | null

interface AssetImage {
  name: string
  path: string
  dimensions?: string
  size?: string
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

  // Assets browser state
  const [showAssets, setShowAssets] = useState(false)
  const [assetImages, setAssetImages] = useState<AssetImage[]>([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)

  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MIN_WIDTH = 500
  const MAX_WIDTH = 900
  const MIN_HEIGHT = 350
  const MAX_HEIGHT = 700

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
        // Recursively find all image files
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
        setAssetImages(images)
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
      // Read file as base64
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
        setInputImagePath(asset.path) // Already on disk
        setResultImage(null)
        setResultLocalPath(null)
        setShowAssets(false)
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
          setInputImagePath(null) // External file, no path to persist
          setResultImage(null)
          setResultLocalPath(null)
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
        setInputImagePath(null) // External file, no path to persist
        setResultImage(null)
        setResultLocalPath(null)
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
      // Extract base64 data from data URL
      const base64 = inputImage.split(',')[1]
      const result = await window.electronAPI?.backgroundRemover?.remove(base64, currentProjectId)

      if (result?.success) {
        setResultImage(result.imageDataUrl || null)
        setResultLocalPath(result.localPath || null)
      } else {
        setError(result?.error || 'Background removal failed')
      }
    } catch (err: any) {
      setError(err.message || 'Background removal failed')
    } finally {
      setIsProcessing(false)
    }
  }, [inputImage, hasBgRemovalAccess, currentProjectId])

  // Clear input image
  const clearInput = useCallback(() => {
    setInputImage(null)
    setInputImageName('')
    setInputImagePath(null)
    setResultImage(null)
    setResultLocalPath(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Clear result
  const clearResult = useCallback(() => {
    setResultImage(null)
    setResultLocalPath(null)
    setError(null)
    setSavedToAssets(false)
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
        className="relative px-4 border-b border-dark-border/50 flex items-center justify-between cursor-move select-none"
        style={{ height: '37px', minHeight: '37px' }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">Background Remover</h3>
        </div>

        <div className="flex items-center gap-1">
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
      <div className="flex-1 p-4 flex gap-4 overflow-hidden" style={{ height: `calc(100% - 37px)` }}>
        {/* Left Panel - Input Image */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400 font-medium">
              {showAssets ? 'Select from Assets' : 'Original Image'}
            </div>
            {showAssets && (
              <button
                onClick={() => setShowAssets(false)}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {showAssets ? (
            // Assets List View
            <div className="flex-1 bg-dark-bg/30 rounded-lg border border-dark-border/50 overflow-hidden">
              <div className="h-full p-2 space-y-1 overflow-y-auto scrollbar-thin">
                {isLoadingAssets ? (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 size={16} className="text-primary animate-spin" />
                    <span className="text-xs text-gray-400">Loading images...</span>
                  </div>
                ) : assetImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <FolderOpen size={20} className="text-gray-600" />
                    <span className="text-xs text-gray-500">No images found in assets</span>
                  </div>
                ) : (
                  assetImages.map((asset, index) => (
                    <button
                      key={asset.path || index}
                      onClick={() => handleAssetClick(asset)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary/10 transition-colors group/item"
                    >
                      <ImageIcon size={14} className="text-primary flex-shrink-0" />
                      <span className="text-xs text-gray-300 truncate min-w-0 text-left group-hover/item:text-white" style={{ flex: '1 1 0' }}>
                        {asset.name}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {asset.dimensions && (
                          <span className="text-[10px] text-primary font-mono" style={{ minWidth: '60px', textAlign: 'right' }}>
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
            </div>
          ) : inputImage ? (
            <div className="flex-1 relative bg-dark-bg/50 rounded-lg border border-dark-border/50 overflow-hidden">
              <img
                src={inputImage}
                alt="Input"
                className="w-full h-full object-contain"
              />
              <button
                onClick={clearInput}
                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-md transition-colors"
                title="Remove image"
              >
                <Trash2 size={12} className="text-white" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-[10px] text-gray-300 truncate">
                {inputImageName}
              </div>
            </div>
          ) : (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`flex-1 flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
                isDragOver
                  ? 'border-primary bg-primary/10'
                  : 'border-dark-border/50 hover:border-dark-border bg-dark-bg/30'
              }`}
              onClick={openFilePicker}
            >
              <div className={`p-4 rounded-full ${isDragOver ? 'bg-primary/20' : 'bg-dark-bg/50'}`}>
                <Upload size={28} className={isDragOver ? 'text-primary' : 'text-gray-500'} />
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-300">Drop image here or click to browse</p>
              </div>

              {/* Separator with "or" */}
              <div className="flex items-center gap-3 w-full max-w-[200px]">
                <div className="flex-1 h-px bg-dark-border/50" />
                <span className="text-[10px] text-gray-500 uppercase">or</span>
                <div className="flex-1 h-px bg-dark-border/50" />
              </div>

              {/* Select from assets link */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSelectFromAssets()
                }}
                className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
              >
                Select from assets
              </button>
            </div>
          )}
        </div>

          {/* Center - Remove Button */}
          <div className="flex flex-col items-center justify-center gap-2">
            {hasBgRemovalAccess ? (
              <button
                onClick={handleRemoveBackground}
                disabled={!inputImage || isProcessing || !currentProjectId}
                className={`p-3 rounded-full transition-all ${
                  inputImage && !isProcessing && currentProjectId
                    ? 'bg-primary hover:bg-primary/80 shadow-lg shadow-primary/20'
                    : 'bg-dark-bg/50 cursor-not-allowed'
                }`}
                title="Remove Background"
              >
                <Wand2 size={20} className={inputImage && !isProcessing && currentProjectId ? 'text-white' : 'text-gray-500'} />
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                className="p-3 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:from-yellow-500/30 hover:to-orange-500/30 transition-all"
                title="Upgrade to use"
              >
                <Lock size={20} className="text-yellow-400" />
              </button>
            )}
            <span className="text-[10px] text-gray-500 text-center">
              {!hasBgRemovalAccess ? (
                <span className="text-yellow-400">Plus Required</span>
              ) : isProcessing ? (
                'Processing...'
              ) : (
                'Remove BG'
              )}
            </span>
          </div>

          {/* Right Panel - Result Image */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="text-xs text-gray-400 font-medium">Result</div>

            <div className="flex-1 relative bg-dark-bg/50 rounded-lg border border-dark-border/50 overflow-hidden">
              {isProcessing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <Loader2 size={32} className="text-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wand2 size={14} className="text-primary/60" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Removing background...</p>
                </div>
              ) : resultImage ? (
                <>
                  {/* Checkered background to show transparency */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `
                        linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
                        linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
                        linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)
                      `,
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                    }}
                  />
                  <img
                    src={resultImage}
                    alt="Result"
                    className="relative w-full h-full object-contain"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {/* Show in Finder */}
                    <button
                      onClick={() => {
                        if (resultLocalPath) {
                          window.electronAPI?.shell?.showItemInFolder(resultLocalPath)
                        }
                      }}
                      className="p-1.5 bg-dark-bg/80 border border-dark-border/50 hover:border-primary/30 hover:bg-primary/10 rounded-md transition-all"
                      title="Show in Finder"
                    >
                      <FolderOpen size={12} className="text-gray-400 hover:text-primary" />
                    </button>
                    {/* Save to Assets */}
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
                      className={`p-1.5 rounded-md transition-all ${
                        savedToAssets
                          ? 'bg-green-500/20 border border-green-500/50'
                          : 'bg-dark-bg/80 border border-dark-border/50 hover:border-primary/30 hover:bg-primary/10'
                      }`}
                      title="Save to Assets"
                    >
                      {savedToAssets ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <FolderPlus size={12} className="text-gray-400 hover:text-primary" />
                      )}
                    </button>
                    {/* Open */}
                    <button
                      onClick={() => {
                        if (resultLocalPath) {
                          window.electronAPI?.shell?.openPath(resultLocalPath)
                        }
                      }}
                      className="p-1.5 bg-dark-bg/80 border border-dark-border/50 hover:border-primary/30 hover:bg-primary/10 rounded-md transition-all"
                      title="Open"
                    >
                      <ExternalLink size={12} className="text-gray-400 hover:text-primary" />
                    </button>
                    {/* Clear */}
                    <button
                      onClick={clearResult}
                      className="p-1.5 bg-dark-bg/80 border border-dark-border/50 hover:border-red-500/30 hover:bg-red-500/10 rounded-md transition-all"
                      title="Clear result"
                    >
                      <Trash2 size={12} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={32} className="text-gray-600" />
                  <p className="text-xs text-gray-500 text-center px-4">
                    Result will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Result Info / Error */}
            {error ? (
              <div className="text-[10px] text-red-400 text-center">
                {error}
              </div>
            ) : resultImage && !isProcessing ? (
              <div className="text-[10px] text-gray-500 text-center">
                Background removed successfully
              </div>
            ) : null}
          </div>
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
