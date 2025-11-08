import { useState, useEffect, useRef } from 'react'
import { RotateCw, ExternalLink, Code2, Maximize2 } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'

interface DesktopPreviewFrameProps {
  children: React.ReactNode
  port?: number
  projectId?: string
  useBrowserView?: boolean
}

function DesktopPreviewFrame({ children, port, projectId, useBrowserView = true }: DesktopPreviewFrameProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const { layoutState } = useLayoutStore()

  // Create/Update BrowserView when using BrowserView mode
  useEffect(() => {
    if (!useBrowserView || !projectId || !port) return

    const createOrUpdatePreview = async () => {
      const rect = contentAreaRef.current?.getBoundingClientRect()
      if (!rect) {
        console.log('📐 [DesktopPreviewFrame] No contentAreaRef rect available')
        return
      }

      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }

      console.log('📐 [DesktopPreviewFrame] Creating BrowserView with bounds:', bounds)
      console.log('📐 [DesktopPreviewFrame] layoutState:', layoutState)

      try {
        await window.electronAPI?.preview.create(
          projectId,
          `http://localhost:${port}`,
          bounds
        )
      } catch (error) {
        console.error('Failed to create desktop preview:', error)
      }
    }

    const timer = setTimeout(createOrUpdatePreview, 100)

    return () => {
      clearTimeout(timer)
      if (projectId) {
        window.electronAPI?.preview.destroy(projectId)
      }
    }
  }, [useBrowserView, projectId, port])

  // Update bounds when layout state changes or window resizes
  useEffect(() => {
    if (!useBrowserView || !projectId || !contentAreaRef.current) return

    // Don't update bounds in STATUS_EXPANDED - LayoutManager handles thumbnail
    if (layoutState === 'STATUS_EXPANDED') {
      console.log('📐 [DesktopPreviewFrame] Skipping bounds update - LayoutManager controls thumbnail in', layoutState)
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

      console.log('📐 [DesktopPreviewFrame] Updating BrowserView bounds:', bounds)
      console.log('📐 [DesktopPreviewFrame] Current layoutState:', layoutState)

      window.electronAPI?.preview.updateBounds(projectId, bounds)
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
  }, [useBrowserView, projectId, layoutState])

  // Listen for DevTools toggle events
  useEffect(() => {
    if (!useBrowserView || !projectId) return

    const unsubscribe = window.electronAPI?.preview.onDevToolsToggled?.((pid, isOpen) => {
      if (pid === projectId) {
        setDevToolsOpen(isOpen)
      }
    })

    return unsubscribe
  }, [useBrowserView, projectId])

  const handleOpenInBrowser = () => {
    if (port) {
      window.electronAPI?.shell.openExternal(`http://localhost:${port}`)
    }
  }

  const handleRefresh = () => {
    if (useBrowserView && projectId) {
      window.electronAPI?.preview.refresh(projectId)
    } else {
      const iframe = document.querySelector('iframe')
      if (iframe) {
        iframe.src = iframe.src
      }
    }
  }

  const handleToggleDevTools = () => {
    if (useBrowserView && projectId) {
      window.electronAPI?.preview.toggleDevTools(projectId)
    }
  }

  const handleFullView = () => {
    if (projectId) {
      window.electronAPI?.layout.setState('BROWSER_FULL', projectId)
    }
  }

  // Hide the frame UI in STATUS_EXPANDED state (only thumbnail shows in StatusSheet)
  if (layoutState === 'STATUS_EXPANDED') {
    return null
  }

  // In BROWSER_FULL state, render fullscreen (no padding/centering)
  const isFullscreen = layoutState === 'BROWSER_FULL'

  return (
    <div className={`w-full h-full bg-gradient-to-br from-gray-900 via-gray-800 to-black ${
      isFullscreen ? '' : 'pb-40 flex items-center justify-center p-8 pt-0'
    }`}>
      {/* Scaled container in DEFAULT, fullscreen in BROWSER_FULL */}
      <div className={`flex flex-col ${
        isFullscreen
          ? 'w-full h-full'
          : 'w-[90%] h-[90%] rounded-lg overflow-hidden shadow-2xl'
      }`} style={!isFullscreen ? { boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' } : {}}>
        {/* Minimal top bar with controls */}
        <div className="h-10 bg-gray-800/50 border-b border-gray-700/50 flex items-center px-3 gap-2 flex-shrink-0">
          {/* URL indicator */}
          <div className="flex-1 bg-gray-900/50 rounded px-3 py-1.5 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[11px] text-gray-400 font-mono">localhost:{port || '----'}</span>
          </div>

          {/* Controls */}
          <div className="flex gap-1">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors group"
              title="Refresh"
            >
              <RotateCw size={13} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
            </button>

            {/* DevTools */}
            {useBrowserView && projectId && (
              <button
                onClick={handleToggleDevTools}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                  devToolsOpen ? 'bg-green-500/20' : 'hover:bg-gray-700'
                }`}
                title="Toggle DevTools"
              >
                <Code2 size={13} className={`transition-colors ${
                  devToolsOpen ? 'text-green-400' : 'text-gray-400 group-hover:text-gray-200'
                }`} />
              </button>
            )}

            {/* Full View (goes to BROWSER_FULL state) */}
            <button
              onClick={handleFullView}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                layoutState === 'BROWSER_FULL' ? 'bg-primary/20' : 'hover:bg-gray-700'
              }`}
              title="Full Screen Preview"
            >
              <Maximize2 size={13} className={`transition-colors ${
                layoutState === 'BROWSER_FULL' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-200'
              }`} />
            </button>

            {/* Open in Browser */}
            <button
              onClick={handleOpenInBrowser}
              className="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors group"
              title="Open in Browser"
            >
              <ExternalLink size={13} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
            </button>
          </div>
        </div>

        {/* Content Area - BrowserView will be positioned here */}
        <div
          ref={contentAreaRef}
          className="flex-1 bg-white overflow-hidden relative"
        >
          {/* BrowserView will be positioned here when useBrowserView=true */}
          {/* Iframe fallback (use useBrowserView=false to enable) */}
          {!useBrowserView && children}
        </div>
      </div>
    </div>
  )
}

export default DesktopPreviewFrame
