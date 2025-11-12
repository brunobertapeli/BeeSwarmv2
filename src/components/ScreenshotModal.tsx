import { useState, useEffect, useRef } from 'react'
import { X, Send, Pencil, Eraser } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

interface ScreenshotModalProps {
  isOpen: boolean
  onClose: () => void
  screenshotSrc: string
}

type PencilColor = 'blue' | 'red' | 'purple' | null

function ScreenshotModal({ isOpen, onClose, screenshotSrc }: ScreenshotModalProps) {
  const { currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState, addImageReference, setPrefilledMessage, setEditModeEnabled } = useLayoutStore()
  const [description, setDescription] = useState('')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [selectedColor, setSelectedColor] = useState<PencilColor>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [canvasReady, setCanvasReady] = useState(false)

  // Handle modal freeze when modal opens/closes
  useEffect(() => {
    const handleFreeze = async () => {
      if (isOpen && currentProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(currentProjectId)

          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(currentProjectId)
          }
        }
      } else {
        // Unfreeze when modal closes
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (currentProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(currentProjectId)
        }
      }
    }

    handleFreeze()
  }, [isOpen, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

  // Initialize canvas when image loads
  useEffect(() => {
    const img = imageRef.current
    const canvas = canvasRef.current

    if (!img || !canvas) return

    const initCanvas = () => {
      const rect = img.getBoundingClientRect()
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      setCanvasReady(true)
    }

    if (img.complete) {
      initCanvas()
    } else {
      img.onload = initCanvas
    }
  }, [screenshotSrc])

  const handleClose = async () => {
    // Cleanup freeze effect before closing
    if (currentProjectId && layoutState === 'DEFAULT') {
      setModalFreezeActive(false)
      await window.electronAPI?.preview.show(currentProjectId)
    }

    setDescription('')
    setShowColorPicker(false)
    setSelectedColor(null)
    onClose()
  }

  const getColorClass = (color: PencilColor) => {
    switch (color) {
      case 'blue': return 'text-blue-400'
      case 'red': return 'text-red-400'
      case 'purple': return 'text-purple-400'
      default: return 'text-gray-400'
    }
  }

  const getDrawColor = (color: PencilColor) => {
    switch (color) {
      case 'blue': return '#60a5fa'
      case 'red': return '#f87171'
      case 'purple': return '#c084fc'
      default: return '#9ca3af'
    }
  }

  const colors: { name: PencilColor; bg: string; hover: string }[] = [
    { name: 'blue', bg: 'bg-blue-500', hover: 'hover:bg-blue-600' },
    { name: 'red', bg: 'bg-red-500', hover: 'hover:bg-red-600' },
    { name: 'purple', bg: 'bg-purple-500', hover: 'hover:bg-purple-600' }
  ]

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedColor) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = getDrawColor(selectedColor)
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !selectedColor) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const handleSend = () => {
    // Merge canvas drawings with original screenshot
    const canvas = canvasRef.current
    const img = imageRef.current

    if (!canvas || !img) return

    // Create a temporary canvas to merge image and drawings
    const mergeCanvas = document.createElement('canvas')
    mergeCanvas.width = canvas.width
    mergeCanvas.height = canvas.height
    const mergeCtx = mergeCanvas.getContext('2d')

    if (!mergeCtx) return

    // Draw original image
    mergeCtx.drawImage(img, 0, 0, canvas.width, canvas.height)

    // Draw annotations on top
    mergeCtx.drawImage(canvas, 0, 0)

    // Get final image as data URL
    const finalImage = mergeCanvas.toDataURL('image/png')

    // Send screenshot and description to parent
    // Parent will handle adding to attachments and setting message
    if (window.onScreenshotSend) {
      window.onScreenshotSend(finalImage, description)
    }

    // Close modal and disable edit mode if active
    handleClose()
    setEditModeEnabled(false)

    console.log('Screenshot sent to ActionBar')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-[700px] bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden">
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
        <div className="relative z-10 px-5 py-3 border-b border-dark-border bg-dark-bg/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Send Screenshot to Claude</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add a description to help Claude understand what you need</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-dark-bg/80 transition-colors text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 p-5 space-y-4">
          {/* Screenshot Preview */}
          <div className="relative bg-dark-bg rounded-lg border border-dark-border overflow-hidden flex flex-col items-center justify-center p-4">
            <div className="relative inline-block flex-shrink-0">
              <img
                ref={imageRef}
                src={screenshotSrc}
                alt="Screenshot"
                className="max-w-full max-h-[280px] object-contain rounded"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className={`absolute top-0 left-0 rounded ${selectedColor ? 'cursor-crosshair' : 'cursor-default'}`}
                style={{ pointerEvents: selectedColor ? 'auto' : 'none' }}
              />
            </div>

            {/* Tools - Below Screenshot, Centered */}
            <div className="mt-4 flex items-center justify-center gap-2">
              {/* Clear Button */}
              <button
                onClick={clearCanvas}
                className="p-1.5 rounded-md bg-dark-bg/40 border border-dark-border/30 transition-all hover:border-dark-border/60 text-gray-400 hover:text-white"
                title="Clear annotations"
              >
                <Eraser size={14} />
              </button>

              {/* Color Picker */}
              <div className="flex items-center gap-1.5">
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1.5 overflow-hidden"
                    >
                      {colors.map((color, index) => (
                        <motion.button
                          key={color.name}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.15, delay: index * 0.05 }}
                          onClick={() => {
                            setSelectedColor(color.name)
                            setShowColorPicker(false)
                          }}
                          className={`w-5 h-5 rounded-full ${color.bg} transition-all hover:scale-125 ring-1 ring-dark-border/30 hover:ring-2 hover:ring-white/20`}
                          title={color.name}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pencil Button */}
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={`p-1.5 rounded-md ${
                    selectedColor
                      ? 'bg-dark-bg/80'
                      : 'bg-dark-bg/40'
                  } border border-dark-border/30 transition-all hover:border-dark-border/60`}
                  title="Choose markup color"
                >
                  <Pencil size={14} className={`${getColorClass(selectedColor)} transition-colors`} />
                </button>
              </div>
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              What would you like Claude to do?
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Increase the padding on this button..."
              className="w-full px-3 py-2.5 bg-dark-bg/50 border border-dark-border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none h-[80px]"
              autoFocus
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 justify-end pt-1">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!description.trim()}
              className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Send size={15} />
              Send to Claude
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenshotModal
