import { useState, useEffect, useRef } from 'react'
import { RotateCw, ExternalLink, Code2, Activity } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import FrozenBackground from './FrozenBackground'
import HealthStatusModal from './HealthStatusModal'
import ImageEditModal from './ImageEditModal'
import { HealthCheckStatus } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'

interface DesktopPreviewFrameProps {
  children: React.ReactNode
  port?: number
  projectId?: string
  useBrowserView?: boolean
}

function DesktopPreviewFrame({ children, port, projectId, useBrowserView = true }: DesktopPreviewFrameProps) {
  const [devToolsOpen, setDevToolsOpen] = useState(false)
  const [healthStatus, setHealthStatus] = useState<HealthCheckStatus | null>(null)
  const [showHealthModal, setShowHealthModal] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const browserViewRef = useRef<HTMLDivElement>(null)
  const healthButtonRef = useRef<HTMLButtonElement>(null)
  const {
    layoutState,
    editModeEnabled,
    imageEditModalOpen,
    imageEditModalData,
    setImageEditModalOpen,
    setImageEditModalData
  } = useLayoutStore()

  // Create/Update BrowserView when using BrowserView mode
  useEffect(() => {
    if (!useBrowserView || !projectId || !port) return

    const createOrUpdatePreview = async () => {
      const maxRetries = 3
      const retryDelay = 100

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const rect = browserViewRef.current?.getBoundingClientRect()

        if (rect) {
          // Bounds available - create preview
          const bounds = {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }

          try {
            await window.electronAPI?.preview.create(
              projectId,
              `http://localhost:${port}`,
              bounds
            )
            setPreviewFailed(false)
            return // Success!
          } catch (error) {
            console.error('Failed to create desktop preview:', error)
            setPreviewFailed(true)
            return
          }
        }

        // Bounds not ready - wait and retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        }
      }

      // All retries failed - bounds never became available
      console.error('Failed to get DOM bounds after 3 retries')
      setPreviewFailed(true)
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
    if (!useBrowserView || !projectId || !browserViewRef.current) return

    // Don't update bounds in TOOLS - preview is hidden
    if (layoutState === 'TOOLS') {
      return
    }

    const updateBounds = () => {
      const rect = browserViewRef.current?.getBoundingClientRect()
      if (!rect) return

      const bounds = {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }

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

  // Listen for health check events and fetch initial status
  useEffect(() => {
    if (!projectId) return

    // Fetch initial health status
    const fetchHealthStatus = async () => {
      try {
        const result = await window.electronAPI?.process.getHealthStatus(projectId)
        if (result?.success && result.healthStatus) {
          setHealthStatus(result.healthStatus)
        }
      } catch (error) {
        console.error('Failed to fetch health status:', error)
      }
    }

    fetchHealthStatus()

    // Listen for health status updates
    const unsubscribeHealthChanged = window.electronAPI?.process.onHealthChanged?.((pid, status) => {
      if (pid === projectId) {
        setHealthStatus(status)
      }
    })

    const unsubscribeHealthCritical = window.electronAPI?.process.onHealthCritical?.((pid, status) => {
      if (pid === projectId) {
        setHealthStatus(status)
      }
    })

    return () => {
      unsubscribeHealthChanged?.()
      unsubscribeHealthCritical?.()
    }
  }, [projectId])

  // Close health modal when clicking outside
  useEffect(() => {
    if (!showHealthModal) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        healthButtonRef.current &&
        !healthButtonRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('.health-modal')
      ) {
        setShowHealthModal(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHealthModal])

  // Freeze browser when health modal opens
  useEffect(() => {
    const handleFreeze = async () => {
      if (showHealthModal && projectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(projectId)
          if (result?.success && result.freezeImage) {
            useLayoutStore.setState({
              modalFreezeImage: result.freezeImage,
              modalFreezeActive: true
            })
            await window.electronAPI?.preview.hide(projectId)
          }
        }
      } else {
        // Unfreeze when modal closes
        useLayoutStore.setState({ modalFreezeActive: false })
        // Only show browser back if in DEFAULT state
        if (projectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(projectId)
        }
      }
    }

    handleFreeze()
  }, [showHealthModal, projectId, layoutState])

  // Inject CSS for edit mode highlighting
  useEffect(() => {
    if (!useBrowserView || !projectId) return

    const manageEditModeCSS = async () => {
      if (editModeEnabled) {
        const css = `
          @keyframes imagePopAnimation {
            0% { transform: scale(1); }
            50% { transform: scale(1.08); }
            100% { transform: scale(1); }
          }

          /* Wrapper for images */
          .edit-mode-wrapper {
            display: inline-block;
            position: relative;
            border: 1px solid rgba(100, 100, 100, 0.3);
            cursor: pointer;
            transition: all 0.2s ease;
            border-radius: 2px;
          }

          .edit-mode-wrapper:hover {
            border-color: rgba(100, 100, 100, 0.5);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          }

          /* Subtle overlay tint */
          .edit-mode-wrapper::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.02);
            pointer-events: none;
            z-index: 1;
            opacity: 0;
            transition: opacity 0.2s ease;
          }

          .edit-mode-wrapper:hover::before {
            opacity: 1;
          }

          /* Corner badge */
          .edit-mode-wrapper::after {
            content: '✏️';
            position: absolute;
            top: 6px;
            right: 6px;
            width: 18px;
            height: 18px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(0, 0, 0, 0.1);
            border-radius: 3px;
            font-size: 10px;
            line-height: 18px;
            text-align: center;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
            transition: all 0.2s ease;
            z-index: 2;
            pointer-events: none;
            opacity: 0.7;
          }

          .edit-mode-wrapper:hover::after {
            opacity: 1;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
          }

          .edit-mode-wrapper img {
            display: block;
            animation: imagePopAnimation 0.3s ease-out;
            position: relative;
            z-index: 0;
          }
        `

        const jsCode = `
          (function() {
            // Remove existing wrappers and listeners
            if (window._editModeCleanup) {
              window._editModeCleanup();
            }

            // Wrap all images with edit mode wrapper
            const images = document.querySelectorAll('img:not(.edit-mode-wrapped)');
            const wrappers = [];

            images.forEach(img => {
              // Skip if already wrapped
              if (img.classList.contains('edit-mode-wrapped')) return;

              // Create wrapper
              const wrapper = document.createElement('div');
              wrapper.className = 'edit-mode-wrapper';

              // Insert wrapper before image
              img.parentNode.insertBefore(wrapper, img);

              // Move image into wrapper
              wrapper.appendChild(img);

              // Mark as wrapped
              img.classList.add('edit-mode-wrapped');

              wrappers.push(wrapper);
            });

            // Add click listener
            const clickHandler = function(e) {
              const wrapper = e.target.closest('.edit-mode-wrapper');
              if (wrapper) {
                const img = wrapper.querySelector('img');
                if (img) {
                  e.preventDefault();
                  e.stopPropagation();

                  // Convert image to data URL for reliable rendering
                  let dataUrl = img.src;
                  try {
                    // Try to convert to canvas for cross-origin images
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    dataUrl = canvas.toDataURL('image/png');
                  } catch (error) {
                    // If canvas fails (CORS), use original src
                    console.warn('Could not convert image to data URL:', error);
                    dataUrl = img.src;
                  }

                  // Store image data for React to pick up
                  window.__imageEditData = {
                    src: dataUrl,
                    width: img.naturalWidth || img.width,
                    height: img.naturalHeight || img.height,
                    path: img.getAttribute('src') || img.currentSrc
                  };
                  window.__imageEditRequested = true;
                }
              }
            };

            document.addEventListener('click', clickHandler, true);

            // Cleanup function
            window._editModeCleanup = function() {
              // Remove click listener
              document.removeEventListener('click', clickHandler, true);

              // Unwrap images
              document.querySelectorAll('.edit-mode-wrapper').forEach(wrapper => {
                const img = wrapper.querySelector('img');
                if (img) {
                  img.classList.remove('edit-mode-wrapped');
                  wrapper.parentNode.insertBefore(img, wrapper);
                  wrapper.remove();
                }
              });
            };
          })();
        `

        try {
          // Wait for preview to be created before injecting (max 5 seconds)
          const previewExists = await window.electronAPI?.preview.waitForPreview(projectId, 5000)

          if (!previewExists?.exists) {
            console.warn('⚠️ Preview not ready for edit mode injection, skipping')
            return
          }

          await window.electronAPI?.preview.injectCSS(projectId, css)
          await window.electronAPI?.preview.executeJavaScript(projectId, jsCode)
        } catch (error) {
          console.error('❌ Failed to inject edit mode CSS/JS:', error)
        }
      } else {
        // Remove CSS and event listeners when edit mode is disabled
        // Only if preview exists (avoid race condition during project switch)
        try {
          // Check if preview exists before attempting removal
          const hasPreview = await window.electronAPI?.preview.hasPreview(projectId)

          if (!hasPreview?.exists) {
            return // Preview doesn't exist, nothing to remove
          }

          await window.electronAPI?.preview.removeCSS(projectId)
          await window.electronAPI?.preview.executeJavaScript(projectId, `
            if (window._editModeCleanup) {
              window._editModeCleanup();
              delete window._editModeCleanup;
            }
          `)
        } catch (error) {
          // Silently ignore - preview might not exist yet during project switch
          if (!error.message?.includes('Preview not found')) {
            console.error('❌ Failed to remove edit mode CSS/JS:', error)
          }
        }
      }
    }

    manageEditModeCSS()
  }, [useBrowserView, projectId, editModeEnabled])

  // Poll for image click events from BrowserView
  useEffect(() => {
    if (!useBrowserView || !projectId || !editModeEnabled) return

    const pollInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI?.preview.executeJavaScript(
          projectId,
          `
            if (window.__imageEditRequested) {
              const data = window.__imageEditData;
              window.__imageEditRequested = false;
              window.__imageEditData = null;
              data;
            } else {
              null;
            }
          `
        )

        if (result?.result && result.result.src) {
          // Open modal with image data
          setImageEditModalData({
            src: result.result.src,
            width: result.result.width,
            height: result.result.height,
            path: result.result.path
          })
          setImageEditModalOpen(true)
        }
      } catch (error) {
        // Silently ignore - preview might not be ready
      }
    }, 100) // Poll every 100ms

    return () => clearInterval(pollInterval)
  }, [useBrowserView, projectId, editModeEnabled, setImageEditModalOpen, setImageEditModalData])

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
      window.electronAPI?.preview.toggleDevTools(projectId, false, layoutState)
    }
  }

  const handleHealthIndicatorClick = () => {
    setShowHealthModal(!showHealthModal)
  }

  const handleRestartServer = async () => {
    if (!projectId) return

    setShowHealthModal(false)

    try {
      await window.electronAPI?.process.restartDevServer(projectId)
    } catch (error) {
      console.error('Failed to restart server:', error)
    }
  }

  const handleRetryPreview = async () => {
    if (!projectId || !port) return

    setPreviewFailed(false)

    // Retry preview creation
    const rect = browserViewRef.current?.getBoundingClientRect()
    if (!rect) {
      console.error('Cannot retry - DOM bounds still unavailable')
      setPreviewFailed(true)
      return
    }

    const bounds = {
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    }

    try {
      await window.electronAPI?.preview.create(
        projectId,
        `http://localhost:${port}`,
        bounds
      )
      setPreviewFailed(false)
    } catch (error) {
      console.error('Failed to retry preview creation:', error)
      setPreviewFailed(true)
    }
  }

  // In TOOLS state, hide the preview frame completely (no frozen background)
  if (layoutState === 'TOOLS') {
    return null
  }

  return (
    <>
      <div className="w-full h-full flex flex-col">
        {/* Container */}
        <div className="flex flex-col w-full h-full overflow-hidden shadow-2xl" style={{ boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }}>
        {/* Minimal top bar with controls */}
        <div className="h-10 bg-dark-card/95 backdrop-blur-xl border-t border-l border-r border-dark-border/80 flex items-center px-3 gap-2 flex-shrink-0 relative">
          {/* Browser label */}
          <div className="text-[12px] text-gray-500 font-medium px-2">
            CodeDeck Browser v.1.0
          </div>

          {/* URL indicator */}
          <div className="flex-1 bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 rounded px-3 py-1.5 flex items-center gap-2">
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

            {/* Open in Browser */}
            <button
              onClick={handleOpenInBrowser}
              className="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors group"
              title="Open in Browser"
            >
              <ExternalLink size={13} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
            </button>

            {/* Health Status Indicator */}
            {useBrowserView && projectId && (
              <button
                ref={healthButtonRef}
                onClick={handleHealthIndicatorClick}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                  healthStatus?.healthy === false ? 'bg-red-500/20' : 'hover:bg-gray-700'
                }`}
                title={healthStatus?.healthy === false ? 'Server Unhealthy' : 'Server Healthy'}
              >
                <Activity
                  size={13}
                  className={`transition-colors ${
                    healthStatus?.healthy === false
                      ? 'text-red-400'
                      : 'text-green-400 group-hover:text-green-300'
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Content Area - With padding for frame */}
        <div
          ref={contentAreaRef}
          className="flex-1 bg-dark-card/95 border border-dark-border/80 overflow-hidden relative p-1.5"
        >
          {/* Inner area for BrowserView positioning */}
          <div
            ref={browserViewRef}
            className="w-full h-full bg-white relative"
          >
            {/* Frozen background overlay - positioned exactly where BrowserView appears */}
            <FrozenBackground />

            {/* Preview failed - show reload button */}
            {previewFailed && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-[95]">
                <div className="text-center">
                  <div className="text-gray-300 text-sm mb-4">Preview failed to load</div>
                  <button
                    onClick={handleRetryPreview}
                    className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                  >
                    <RotateCw size={14} />
                    Reload Preview
                  </button>
                </div>
              </div>
            )}

            {/* BrowserView will be positioned here when useBrowserView=true */}
            {/* Iframe fallback (use useBrowserView=false to enable) */}
            {!useBrowserView && children}
          </div>
        </div>
      </div>
    </div>

      {/* Health Status Modal */}
      <HealthStatusModal
        isOpen={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        healthStatus={healthStatus}
        projectId={projectId || ''}
        onRestart={handleRestartServer}
        buttonRef={healthButtonRef}
      />

      {/* Image Edit Modal */}
      {imageEditModalData && (
        <ImageEditModal
          isOpen={imageEditModalOpen}
          onClose={() => setImageEditModalOpen(false)}
          imageSrc={imageEditModalData.src}
          imageWidth={imageEditModalData.width}
          imageHeight={imageEditModalData.height}
          imagePath={imageEditModalData.path}
        />
      )}
    </>
  )
}

export default DesktopPreviewFrame
