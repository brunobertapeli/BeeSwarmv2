import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Play, Pause, Scissors, Loader2, RotateCcw, Repeat } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { ModalPortal } from './ModalPortal'
import WaveSurfer from 'wavesurfer.js'

interface AudioEditorModalProps {
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
  audioPath: string
  audioName?: string
}

function AudioEditorModal({ isOpen, onClose, onSave, audioPath, audioName }: AudioEditorModalProps) {
  const { currentProjectId } = useAppStore()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null)
  const [isLooping, setIsLooping] = useState(false)

  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [waveformReady, setWaveformReady] = useState(false)

  // Format time in mm:ss.ms format
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  // Convert percentage to time
  const percentToTime = (percent: number) => (percent / 100) * duration
  const timeToPercent = (time: number) => duration > 0 ? (time / duration) * 100 : 0

  // Set waveformReady when ref is available
  useEffect(() => {
    if (isOpen && !isLoading) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => setWaveformReady(true), 100)
      return () => clearTimeout(timer)
    } else {
      setWaveformReady(false)
    }
  }, [isOpen, isLoading])

  // Initialize WaveSurfer
  useEffect(() => {
    if (!isOpen) return
    if (!waveformRef.current) return

    let ws: WaveSurfer | null = null
    let cancelled = false

    const init = async () => {
      setError(null)
      setTrimStart(0)
      setTrimEnd(100)
      setIsLoading(true)

      try {
        // Read audio file as base64 from backend
        const fileData = await window.electronAPI?.files?.readFileAsBase64?.(audioPath)
        if (cancelled) return

        if (!fileData) {
          throw new Error('Failed to read audio file')
        }

        // Determine mime type
        const ext = audioPath.split('.').pop()?.toLowerCase()
        const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg'
        const audioUrl = `data:${mimeType};base64,${fileData}`

        ws = WaveSurfer.create({
          container: waveformRef.current!,
          waveColor: '#4f46e5',
          progressColor: '#818cf8',
          cursorColor: '#f97316',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 100,
          normalize: true,
        })

        wavesurferRef.current = ws

        ws.on('ready', () => {
          if (cancelled) return
          setDuration(ws!.getDuration())
          setIsLoading(false)
        })

        ws.on('play', () => !cancelled && setIsPlaying(true))
        ws.on('pause', () => !cancelled && setIsPlaying(false))
        ws.on('timeupdate', (time) => !cancelled && setCurrentTime(time))
        ws.on('error', (err) => {
          if (cancelled) return
          console.error('[AudioEditor] WaveSurfer error:', err)
          setError('Failed to load audio file')
          setIsLoading(false)
        })

        ws.load(audioUrl)

      } catch (err) {
        if (cancelled) return
        console.error('[AudioEditor] Failed to initialize:', err)
        setError('Failed to load audio file')
        setIsLoading(false)
      }
    }

    init()

    return () => {
      cancelled = true
      if (ws) {
        try {
          ws.destroy()
        } catch (e) {
          // Ignore destroy errors
        }
      }
      wavesurferRef.current = null
    }
  }, [isOpen, audioPath])

  // Handle drag for trim handles
  const handleMouseDown = (handle: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(handle)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100))

      if (isDragging === 'start') {
        setTrimStart(Math.min(percent, trimEnd - 2))
      } else {
        setTrimEnd(Math.max(percent, trimStart + 2))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, trimStart, trimEnd])

  const togglePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause()
    }
  }, [])

  const restart = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setTime(0)
      wavesurferRef.current.play()
    }
  }, [])

  // Handle loop - when audio ends, restart if looping
  useEffect(() => {
    if (!wavesurferRef.current) return

    const handleFinish = () => {
      if (isLooping && wavesurferRef.current) {
        wavesurferRef.current.setTime(0)
        wavesurferRef.current.play()
      }
    }

    wavesurferRef.current.on('finish', handleFinish)
    return () => {
      wavesurferRef.current?.un('finish', handleFinish)
    }
  }, [isLooping])

  const handleCrop = async () => {
    if (!currentProjectId) return

    setIsSaving(true)

    try {
      const ext = audioPath.split('.').pop()?.toLowerCase()
      const startTime = percentToTime(trimStart)
      const endTime = percentToTime(trimEnd)

      const result = await window.electronAPI?.audio?.cropAudio({
        inputPath: audioPath,
        startTime,
        endTime,
        format: ext || 'mp3'
      })

      if (result?.success) {
        onSave?.()
        onClose()
      } else {
        setError(result?.error || 'Failed to crop audio')
      }
    } catch (err) {
      console.error('Failed to crop audio:', err)
      setError('Failed to crop audio')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === ' ') {
        e.preventDefault()
        togglePlayPause()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, togglePlayPause, onClose])

  if (!isOpen) return null

  const startTime = percentToTime(trimStart)
  const endTime = percentToTime(trimEnd)
  const cropDuration = endTime - startTime

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-[301] pointer-events-none">
        <div
          className="bg-dark-card border border-dark-border rounded-xl shadow-2xl pointer-events-auto w-[600px] max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Scissors size={16} className="text-orange-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Audio Editor</h2>
                <p className="text-xs text-gray-500 truncate max-w-[300px]">{audioName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-bg/50 rounded-lg transition-colors"
            >
              <X size={18} className="text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5">
            {/* Waveform Container with Trim Overlay */}
            <div className="bg-dark-bg/50 rounded-xl p-4 border border-dark-border/50">
              {error ? (
                <div className="flex items-center justify-center h-[100px] text-red-400 text-sm">
                  {error}
                </div>
              ) : (
                <div ref={containerRef} className="relative">
                  {/* Loading overlay */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/50 z-10">
                      <Loader2 className="animate-spin text-orange-400" size={32} />
                    </div>
                  )}
                  {/* Waveform - always rendered so ref is available */}
                  <div ref={waveformRef} className="w-full min-h-[100px]" />

                  {/* Trim Overlay - z-20 to be above waveform */}
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {/* Left dark overlay (trimmed area) */}
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-black/70"
                      style={{ width: `${trimStart}%` }}
                    />

                    {/* Right dark overlay (trimmed area) */}
                    <div
                      className="absolute top-0 bottom-0 right-0 bg-black/70"
                      style={{ width: `${100 - trimEnd}%` }}
                    />

                    {/* Selected region border */}
                    <div
                      className="absolute top-0 bottom-0 border-t-2 border-b-2 border-orange-500"
                      style={{
                        left: `${trimStart}%`,
                        width: `${trimEnd - trimStart}%`
                      }}
                    />
                  </div>

                  {/* Left Handle - z-30 to be above overlay, wider click area */}
                  <div
                    className="absolute top-0 bottom-0 w-8 cursor-ew-resize pointer-events-auto group z-30"
                    style={{ left: `calc(${trimStart}% - 16px)` }}
                    onMouseDown={handleMouseDown('start')}
                  >
                    <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-orange-500 group-hover:bg-orange-400 transition-colors" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-12 bg-orange-500 group-hover:bg-orange-400 rounded-md flex items-center justify-center transition-colors shadow-lg">
                      <div className="w-0.5 h-6 bg-white/60 rounded-full" />
                    </div>
                  </div>

                  {/* Right Handle - z-30 to be above overlay, wider click area */}
                  <div
                    className="absolute top-0 bottom-0 w-8 cursor-ew-resize pointer-events-auto group z-30"
                    style={{ left: `calc(${trimEnd}% - 16px)` }}
                    onMouseDown={handleMouseDown('end')}
                  >
                    <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-orange-500 group-hover:bg-orange-400 transition-colors" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-12 bg-orange-500 group-hover:bg-orange-400 rounded-md flex items-center justify-center transition-colors shadow-lg">
                      <div className="w-0.5 h-6 bg-white/60 rounded-full" />
                    </div>
                  </div>

                  {/* Playhead indicator */}
                  {duration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none z-10"
                      style={{ left: `${timeToPercent(currentTime)}%` }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Time Display */}
            <div className="flex items-center justify-between mt-4 px-1">
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Current: </span>
                <span className="font-mono text-white">{formatTime(currentTime)}</span>
              </div>
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Total: </span>
                <span className="font-mono text-white">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={restart}
                disabled={isLoading}
                className="p-2 hover:bg-dark-bg/70 rounded-lg transition-colors disabled:opacity-50"
                title="Restart"
              >
                <RotateCcw size={18} className="text-gray-400" />
              </button>
              <button
                onClick={togglePlayPause}
                disabled={isLoading}
                className="p-3 bg-orange-500 hover:bg-orange-600 rounded-full transition-colors disabled:opacity-50"
              >
                {isPlaying ? (
                  <Pause size={20} className="text-white" />
                ) : (
                  <Play size={20} className="text-white ml-0.5" />
                )}
              </button>
              <button
                onClick={() => setIsLooping(!isLooping)}
                disabled={isLoading}
                className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                  isLooping ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-dark-bg/70 text-gray-400'
                }`}
                title="Loop"
              >
                <Repeat size={18} />
              </button>
            </div>

            {/* Selection Info */}
            <div className="mt-5 p-4 bg-dark-bg/30 rounded-xl border border-dark-border/30">
              <div className="flex items-center gap-2 mb-3">
                <Scissors size={14} className="text-orange-400" />
                <span className="text-xs font-medium text-gray-300">Trim Selection</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Start</p>
                  <p className="text-sm font-mono text-orange-400">{formatTime(startTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">End</p>
                  <p className="text-sm font-mono text-orange-400">{formatTime(endTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Keep</p>
                  <p className="text-sm font-mono text-white">{formatTime(cropDuration)}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-600 mt-3">
                Drag the orange handles to select the portion to keep. Dark areas will be removed.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-dark-border bg-dark-bg/20">
            <p className="text-[10px] text-gray-600">
              Press <kbd className="px-1.5 py-0.5 bg-dark-bg rounded text-gray-400">Space</kbd> to play/pause
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCrop}
                disabled={isLoading || isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Cropping...
                  </>
                ) : (
                  <>
                    <Scissors size={14} />
                    Crop Audio
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

export default AudioEditorModal
