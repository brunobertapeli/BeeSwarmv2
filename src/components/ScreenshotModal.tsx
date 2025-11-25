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
      <div className="relative w-[700px] bg-dark-bg/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
        <div className="relative z-10 px-6 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Send Screenshot to Claude</h2>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Add a description to help Claude understand what you need. You can also paint/point what you want changed using the pencil.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-white group"
          >
            <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 p-5 space-y-4 flex flex-col h-full">
          {/* Screenshot Preview */}
          <div className="relative bg-black/20 rounded-xl border border-white/10 overflow-hidden flex-1 flex flex-col items-center justify-center p-4 min-h-0">
            <div className="relative inline-block shadow-2xl rounded-lg overflow-hidden max-h-full">
              <img
                ref={imageRef}
                src={screenshotSrc}
                alt="Screenshot"
                className="max-w-full max-h-[400px] object-contain"
              />
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className={`absolute top-0 left-0 ${selectedColor ? 'cursor-crosshair' : 'cursor-default'}`}
                style={{ pointerEvents: selectedColor ? 'auto' : 'none' }}
              />
            </div>
          </div>

          {/* Tools - Centered Below Screenshot */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-3 bg-dark-bg/40 border border-white/10 px-4 py-2 rounded-full shadow-sm">
              {/* Clear Button */}
              <button
                onClick={clearCanvas}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                title="Clear annotations"
              >
                <Eraser size={16} />
              </button>

              <div className="w-px h-4 bg-white/10" />

              {/* Color Picker */}
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 overflow-hidden pr-2"
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
                          className={`w-6 h-6 rounded-full ${color.bg} transition-all hover:scale-125 ring-2 ring-transparent hover:ring-white/20 shadow-lg`}
                          title={color.name}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Pencil Button */}
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className={`p-2 rounded-full transition-all ${selectedColor
                    ? 'bg-white/10 text-white ring-1 ring-white/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  title="Choose markup color"
                >
                  <Pencil size={16} className={selectedColor ? getColorClass(selectedColor) : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wider ml-1">
              Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to change..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all resize-none h-[80px]"
              autoFocus
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 justify-end pt-1">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-dark-bg hover:bg-dark-bg/70 text-gray-300 text-sm font-medium rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!description.trim()}
              className="px-4 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-sm font-medium text-primary transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              SEND TO CLAUDE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreenshotModal
