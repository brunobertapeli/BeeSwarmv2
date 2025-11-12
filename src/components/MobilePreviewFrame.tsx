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
  const browserViewRef = useRef<HTMLDivElement>(null)
  const { layoutState, editModeEnabled } = useLayoutStore()
  const { selectedDevice } = useAppStore()

  // Create/Update BrowserView when using BrowserView mode
  useEffect(() => {
    if (!projectId || !port) return

    const createOrUpdatePreview = async () => {
      const rect = browserViewRef.current?.getBoundingClientRect()
      if (!rect) {
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
    if (!projectId || !browserViewRef.current) return

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

  // Inject CSS for edit mode highlighting
  useEffect(() => {
    if (!projectId) return

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
                  console.log('Image clicked:', img.src);
                  alert('Image clicked: ' + img.src + '\\n\\nMenu will be implemented here.');
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
          await window.electronAPI?.preview.injectCSS(projectId, css)
          await window.electronAPI?.preview.executeJavaScript(projectId, jsCode)
        } catch (error) {
          console.error('❌ Failed to inject edit mode CSS/JS:', error)
        }
      } else {
        // Remove CSS and event listeners when edit mode is disabled
        // Only if preview exists (avoid race condition during project switch)
        try {
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
  }, [projectId, editModeEnabled])

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

  // Get device dimensions for sizing
  const deviceWidth = selectedDevice?.width || 393
  const deviceHeight = selectedDevice?.height || 852
  const aspectRatio = deviceHeight / deviceWidth

  // Scale factor for mobile preview
  const scale = 0.735

  // Calculate dimensions maintaining aspect ratio
  const maxHeight = window.innerHeight - 300
  const calculatedWidth = Math.min(deviceWidth * scale, (maxHeight / aspectRatio))
  const calculatedHeight = calculatedWidth * aspectRatio

  // In TOOLS state, hide the preview frame completely (no frozen background)
  if (layoutState === 'TOOLS') {
    return null
  }

  return (
    <div className="w-full h-full flex items-center justify-center pb-40" style={{ marginTop: '-50px' }}>
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
        <div className="h-[37px] bg-dark-card/95 backdrop-blur-xl border-t border-l border-r border-b border-dark-border/80 rounded-t-3xl flex items-center px-2 gap-2 flex-shrink-0 relative">
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

        {/* Content Area - With padding for frame */}
        <div
          ref={contentAreaRef}
          className="flex-1 bg-dark-card/95 border-l border-r border-b border-dark-border/80 rounded-b-3xl overflow-hidden relative px-1.5 py-3.5"
        >
          {/* Inner area for BrowserView positioning */}
          <div
            ref={browserViewRef}
            className="w-full h-full bg-white relative"
          >
            {/* Frozen background overlay - positioned exactly where BrowserView appears */}
            <FrozenBackground />
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobilePreviewFrame
