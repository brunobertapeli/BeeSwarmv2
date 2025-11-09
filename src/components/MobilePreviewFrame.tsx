import { useState, useEffect, useRef } from 'react'
import { RotateCw, Code2 } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import FrozenBackground from './FrozenBackground'

interface MobilePreviewFrameProps {
  port?: number
  projectId?: string
}

function MobilePreviewFrame({ port, projectId }: MobilePreviewFrameProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const { layoutState } = useLayoutStore()
  const { selectedDevice } = useAppStore()

  // Create/Update BrowserView when using BrowserView mode
  useEffect(() => {
    if (!projectId || !port) return

    const createOrUpdatePreview = async () => {
      const rect = contentAreaRef.current?.getBoundingClientRect()
      if (!rect) {
        console.log('📐 [MobilePreviewFrame] No contentAreaRef rect available')
        return
      }

      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }

      console.log('📐 [MobilePreviewFrame] Creating BrowserView with bounds:', bounds)
      console.log('📐 [MobilePreviewFrame] layoutState:', layoutState)

      try {
        await window.electronAPI?.preview.create(
          projectId,
          `http://localhost:${port}`,
          bounds
        )
      } catch (error) {
        console.error('Failed to create mobile preview:', error)
      }
    }

    const timer = setTimeout(createOrUpdatePreview, 100)

    return () => {
      clearTimeout(timer)
      if (projectId) {
        window.electronAPI?.preview.destroy(projectId)
      }
    }
  }, [projectId, port])

  // Update bounds when layout state changes or window resizes
  useEffect(() => {
    if (!projectId || !contentAreaRef.current) return

    // Don't update bounds in STATUS_EXPANDED - LayoutManager handles thumbnail
    if (layoutState === 'STATUS_EXPANDED') {
      console.log('📐 [MobilePreviewFrame] Skipping bounds update - LayoutManager controls thumbnail in', layoutState)
      return
    }

    const updateBounds = () => {
      const rect = contentAreaRef.current?.getBoundingClientRect()
      if (!rect) return

      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }

      console.log('📐 [MobilePreviewFrame] Updating BrowserView bounds:', bounds)
      console.log('📐 [MobilePreviewFrame] Current layoutState:', layoutState)

      window.electronAPI?.preview.updateBounds(projectId, bounds)

      // Also reposition DevTools if open (for mobile)
      // This will be implemented when you provide the positioning values
      // window.electronAPI?.preview.repositionDevTools?.(projectId, layoutState)
    }

    // Update immediately
    const timer = setTimeout(updateBounds, 100)

    // Also listen for window resize
    let resizeTimer: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(updateBounds, 150)
    }

    window.addEventListener('resize', debouncedResize)

    return () => {
      clearTimeout(timer)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', debouncedResize)
    }
  }, [projectId, layoutState])

  // Listen for DevTools toggle events
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = window.electronAPI?.preview.onDevToolsToggled?.((pid, isOpen) => {
      if (pid === projectId) {
        setDevToolsOpen(isOpen)
      }
    })

    return unsubscribe
  }, [projectId])

  const handleRefresh = () => {
    if (projectId) {
      window.electronAPI?.preview.refresh(projectId)
    }
  }

  const handleToggleDevTools = () => {
    if (projectId) {
      window.electronAPI?.preview.toggleDevTools(projectId, true, layoutState)
    }
  }

  // Hide the frame UI in STATUS_EXPANDED state (only thumbnail shows in StatusSheet)
  if (layoutState === 'STATUS_EXPANDED') {
    return null
  }

  // Get device dimensions for sizing
  const deviceWidth = selectedDevice?.width || 393
  const deviceHeight = selectedDevice?.height || 852
  const aspectRatio = deviceHeight / deviceWidth

  // In BROWSER_FULL state, make it larger but still phone-sized
  const isFullscreen = layoutState === 'BROWSER_FULL'

  // Scale factors for different states - increased DEFAULT from 0.6 to 0.7 (10% bigger)
  const scale = isFullscreen ? 0.8 : 0.7 // 80% of viewport in fullscreen, 70% in default

  // Calculate dimensions maintaining aspect ratio
  // Increased top gap for fullscreen from 100 to 180
  const maxHeight = isFullscreen ? window.innerHeight - 180 : window.innerHeight - 300
  const calculatedWidth = Math.min(deviceWidth * scale, (maxHeight / aspectRatio))
  const calculatedHeight = calculatedWidth * aspectRatio

  return (
    <div className={`w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center ${
      isFullscreen ? 'pt-12 pb-8' : 'pb-40'
    }`}>
      {/* Mobile phone container - centered */}
      <div
        className="flex flex-col bg-gray-900 rounded-3xl overflow-hidden shadow-2xl"
        style={{
          width: `${calculatedWidth}px`,
          height: `${calculatedHeight}px`,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* Minimal top bar with controls */}
        <div className="h-8 bg-gray-800/50 border-b border-gray-700/50 flex items-center px-2 gap-2 flex-shrink-0">
          {/* Device name indicator */}
          <div className="flex-1 text-[10px] text-gray-400 font-medium px-2">
            {selectedDevice?.name || 'Mobile'}
          </div>

          {/* Controls */}
          <div className="flex gap-1">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="w-6 h-6 rounded hover:bg-gray-700 flex items-center justify-center transition-colors group"
              title="Refresh"
            >
              <RotateCw size={11} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
            </button>

            {/* DevTools */}
            <button
              onClick={handleToggleDevTools}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors group ${
                devToolsOpen ? 'bg-green-500/20' : 'hover:bg-gray-700'
              }`}
              title="Toggle DevTools"
            >
              <Code2 size={11} className={`transition-colors ${
                devToolsOpen ? 'text-green-400' : 'text-gray-400 group-hover:text-gray-200'
              }`} />
            </button>
          </div>
        </div>

        {/* Content Area - BrowserView will be positioned here */}
        <div
          ref={contentAreaRef}
          className="flex-1 bg-white overflow-hidden relative"
        >
          {/* Frozen background overlay - positioned exactly where BrowserView appears */}
          <FrozenBackground />
        </div>
      </div>
    </div>
  )
}

export default MobilePreviewFrame
