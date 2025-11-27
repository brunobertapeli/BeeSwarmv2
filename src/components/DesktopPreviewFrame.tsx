import { useState, useEffect, useRef } from 'react'
import { RotateCw, ExternalLink, Code2, Activity } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import FrozenBackground from './FrozenBackground'
import HealthStatusModal from './HealthStatusModal'
import ImageEditModal from './ImageEditModal'
import PreviewLoader from './PreviewLoader'
import { HealthCheckStatus } from '../types/electron'
import bgImage from '../assets/images/bg.jpg'
import noiseBgImage from '../assets/images/noise_bg.png'

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
  const [previewLoading, setPreviewLoading] = useState(true)
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

    setPreviewLoading(true)

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
            // Wait a bit for the preview to actually load before hiding loader
            setTimeout(() => setPreviewLoading(false), 500)
            return // Success!
          } catch (error) {
            console.error('Failed to create desktop preview:', error)
            setPreviewFailed(true)
            setPreviewLoading(false)
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
      setPreviewLoading(false)
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
          /* Wrapper for images - SOLID BLUE BORDER */
          .edit-mode-wrapper {
            display: inline-block;
            position: relative;
            border: 2px solid rgba(59, 130, 246, 0.4);
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 8px;
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.1);
            overflow: hidden;
          }

          .edit-mode-wrapper:hover {
            border-color: rgba(59, 130, 246, 0.6);
            box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2), 0 8px 24px rgba(59, 130, 246, 0.2);
          }

          /* Dark overlay on hover with blur backdrop */
          .edit-mode-wrapper::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(2px);
            pointer-events: none;
            z-index: 1;
            opacity: 0;
            transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border-radius: 6px;
          }

          .edit-mode-wrapper:hover::before {
            opacity: 1;
          }

          /* Centered edit icon badge */
          .edit-mode-wrapper::after {
            content: '✏️';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.85);
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border: 3px solid white;
            border-radius: 50%;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4), 0 0 0 4px rgba(59, 130, 246, 0.1);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 2;
            pointer-events: none;
            opacity: 0.5;
          }

          .edit-mode-wrapper:hover::after {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }

          .edit-mode-wrapper img {
            display: block;
            position: relative;
            z-index: 0;
            border-radius: 4px;
          }

          /* Text editing wrapper - DOTTED PURPLE BORDER */
          .edit-mode-text-wrapper {
            position: relative;
            display: inline-block;
            cursor: text;
            outline: 2px dashed rgba(147, 51, 234, 0.4);
            outline-offset: 2px;
            transition: all 0.2s ease;
            border-radius: 3px;
          }

          .edit-mode-text-wrapper:hover {
            outline-color: rgba(147, 51, 234, 0.7);
            outline-width: 2px;
            background: rgba(147, 51, 234, 0.06);
          }

          /* Pencil badge for text (smaller, 30% opacity) */
          .edit-mode-text-wrapper::after {
            content: '✏️';
            position: absolute;
            top: -10px;
            right: -10px;
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
            border: 2px solid white;
            border-radius: 50%;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
            transition: all 0.2s ease;
            pointer-events: none;
            z-index: 10;
            opacity: 0.3;
          }

          .edit-mode-text-wrapper:hover::after {
            opacity: 1;
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(147, 51, 234, 0.4);
          }

          /* Active editing state */
          .edit-mode-text-editing {
            outline: 2px solid rgba(147, 51, 234, 0.8) !important;
            background: rgba(147, 51, 234, 0.1) !important;
          }

          /* Style for contentEditable elements */
          [contenteditable="true"] {
            outline: none;
            caret-color: rgb(147, 51, 234);
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

            // === TEXT EDITING ===
            console.log('[Edit Mode] TEXT EDITING SCRIPT STARTED');
            window.__editModeTextScriptLoaded = true;

            // Wrap all text elements with edit mode wrapper
            const textSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, label, div';
            const textElements = document.querySelectorAll(textSelectors);
            console.log('[Edit Mode] Found', textElements.length, 'text elements to wrap');
            const textWrappers = [];

            textElements.forEach(el => {
              // Skip if:
              // - already wrapped
              // - empty or whitespace only
              // - contains img elements (those are handled separately)
              // - is inside another text wrapper (avoid nested wrappers)
              // - is a script or style element
              // - contains OTHER text elements (is a container, not actual text)
              if (
                el.classList.contains('edit-mode-text-wrapped') ||
                !el.textContent?.trim() ||
                el.querySelector('img') ||
                el.closest('.edit-mode-text-wrapper') ||
                el.tagName === 'SCRIPT' ||
                el.tagName === 'STYLE'
              ) {
                return;
              }

              // Skip containers that have child text elements
              // Only wrap leaf text nodes (actual editable text)
              const hasChildTextElements = el.querySelector('h1, h2, h3, h4, h5, h6, p, span, a, button');
              if (hasChildTextElements) {
                return;
              }

              // Create wrapper
              const wrapper = document.createElement('span');
              wrapper.className = 'edit-mode-text-wrapper';
              wrapper.dataset.originalTag = el.tagName;
              wrapper.style.display = window.getComputedStyle(el).display === 'block' ? 'block' : 'inline-block';

              // Insert wrapper before element
              el.parentNode.insertBefore(wrapper, el);

              // Move element into wrapper
              wrapper.appendChild(el);

              // Mark as wrapped
              el.classList.add('edit-mode-text-wrapped');

              textWrappers.push(wrapper);
            });

            // Helper to generate unique CSS selector for an element
            function getUniqueSelector(element) {
              // If element has an ID, use it (most specific)
              if (element.id) {
                return '#' + element.id;
              }

              // Build path from element to root
              const path = [];
              let current = element;

              while (current && current !== document.body) {
                let selector = current.tagName.toLowerCase();

                // Add classes if they exist
                if (current.className && typeof current.className === 'string') {
                  const classes = current.className.trim().split(/\\s+/)
                    .filter(c => c && !c.startsWith('edit-mode')); // Skip our edit mode classes
                  if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                  }
                }

                // Add nth-child if needed for uniqueness
                const parent = current.parentElement;
                if (parent) {
                  const siblings = Array.from(parent.children).filter(
                    child => child.tagName === current.tagName
                  );
                  if (siblings.length > 1) {
                    const index = siblings.indexOf(current) + 1;
                    selector += ':nth-of-type(' + index + ')';
                  }
                }

                path.unshift(selector);
                current = parent;
              }

              return path.join(' > ');
            }

            // Click handler for text editing
            const textClickHandler = function(e) {
              const wrapper = e.target.closest('.edit-mode-text-wrapper');
              if (wrapper && !e.target.closest('.edit-mode-wrapper')) { // Don't interfere with image clicks
                const textEl = wrapper.querySelector('.edit-mode-text-wrapped');
                if (textEl && textEl.contentEditable !== 'true') {
                  e.preventDefault();
                  e.stopPropagation();

                  // Make contentEditable
                  textEl.contentEditable = 'true';
                  textEl.focus();

                  // Select all text
                  const range = document.createRange();
                  range.selectNodeContents(textEl);
                  const selection = window.getSelection();
                  selection.removeAllRanges();
                  selection.addRange(range);

                  wrapper.classList.add('edit-mode-text-editing');

                  // Store original content for cancel
                  textEl.dataset.originalContent = textEl.textContent;

                  // Save function (called on blur or Enter)
                  const saveChanges = function() {
                    const newContent = textEl.textContent;
                    const originalContent = textEl.dataset.originalContent;

                    console.log('[Edit Mode] saveChanges called');
                    console.log('  Original:', originalContent);
                    console.log('  New:', newContent);

                    // Only save if content actually changed
                    if (newContent !== originalContent) {
                      console.log('[Edit Mode] Content changed, sending to backend...');
                      // Get comprehensive element information
                      const elementInfo = {
                        tag: textEl.tagName.toLowerCase(),
                        id: textEl.id || null,
                        className: textEl.className || null,
                        dataAttributes: {},
                        textContent: originalContent,
                        selector: getUniqueSelector(textEl)
                      };

                      // Collect data attributes
                      Array.from(textEl.attributes).forEach(attr => {
                        if (attr.name.startsWith('data-')) {
                          elementInfo.dataAttributes[attr.name] = attr.value;
                        }
                      });

                      window.__textEditData = {
                        elementInfo: elementInfo,
                        originalContent: originalContent,
                        newContent: newContent
                      };
                      window.__textEditRequested = true;

                      console.log('[Edit Mode] Data sent to polling mechanism');
                      console.log('  Selector:', elementInfo.selector);

                      // Update the original content to the new value
                      textEl.dataset.originalContent = newContent;

                      // Show brief "Saved" indicator
                      showSavedIndicator(wrapper);
                    } else {
                      console.log('[Edit Mode] No changes detected, skipping save');
                    }
                  };

                  // Handle blur (save and exit editing)
                  const blurHandler = function() {
                    saveChanges();
                    textEl.contentEditable = 'false';
                    wrapper.classList.remove('edit-mode-text-editing');
                    textEl.removeEventListener('blur', blurHandler);
                    textEl.removeEventListener('keydown', keyDownHandler, true);
                    textEl.removeEventListener('keypress', keyPressHandler, true);
                  };

                  // Handle keydown for Enter and Escape
                  const keyDownHandler = function(e) {
                    console.log('[Edit Mode] keyDownHandler called, key:', e.key, 'shiftKey:', e.shiftKey);

                    // Enter key without Shift: save and exit editing (like clicking outside)
                    if (e.key === 'Enter' && !e.shiftKey) {
                      console.log('[Edit Mode] Enter detected (no shift), saving and exiting...');
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();

                      console.log('[Edit Mode] Calling saveChanges...');
                      saveChanges();

                      // Exit editing mode (blur)
                      console.log('[Edit Mode] Blurring element to exit edit mode...');
                      textEl.blur();
                      return false;
                    }
                    // Shift+Enter: allow line break (default behavior)
                    // No need to handle, just let it happen

                    // Escape key (cancel)
                    if (e.key === 'Escape') {
                      console.log('[Edit Mode] Escape pressed, cancelling...');
                      e.preventDefault();
                      e.stopPropagation();
                      textEl.textContent = textEl.dataset.originalContent;
                      textEl.blur();
                    }
                  };

                  // Also prevent Enter on keypress as backup
                  const keyPressHandler = function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      return false;
                    }
                  };

                  // Helper to show "Saved" indicator
                  function showSavedIndicator(wrapper) {
                    // Remove existing indicator if any
                    const existing = wrapper.querySelector('.edit-mode-saved-indicator');
                    if (existing) existing.remove();

                    // Create and show indicator
                    const indicator = document.createElement('div');
                    indicator.className = 'edit-mode-saved-indicator';
                    indicator.textContent = '✓ Saved';
                    indicator.style.cssText = 'position: absolute; top: -25px; right: 0; background: rgba(34, 197, 94, 0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; z-index: 1000; pointer-events: none;';
                    wrapper.appendChild(indicator);

                    // Fade out and remove after 1.5s
                    setTimeout(() => {
                      indicator.style.transition = 'opacity 0.3s';
                      indicator.style.opacity = '0';
                      setTimeout(() => indicator.remove(), 300);
                    }, 1500);
                  }

                  console.log('[Edit Mode] Attaching event listeners to element:', textEl.tagName, textEl.className);

                  // Test with alert to ensure this code runs
                  // alert('Event listeners being attached to: ' + textEl.tagName);

                  textEl.addEventListener('blur', blurHandler);
                  textEl.addEventListener('keydown', keyDownHandler, true); // Capture phase
                  textEl.addEventListener('keypress', keyPressHandler, true); // Backup prevention
                  console.log('[Edit Mode] Event listeners attached successfully');
                }
              }
            };

            document.addEventListener('click', textClickHandler, true);

            // Prevent all hotkeys when contentEditable is active
            // EXCEPT Enter and Escape which we need for save/cancel
            const preventHotkeysHandler = function(e) {
              // Check if we're editing text
              if (e.target && e.target.isContentEditable) {
                // Allow Enter and Escape to pass through (we handle these in our element handler)
                if (e.key === 'Enter' || e.key === 'Escape') {
                  return; // Let it through
                }
                // Stop all other events from reaching the main window
                e.stopPropagation();
              }
            };

            // Capture phase to intercept before it reaches the window
            document.addEventListener('keydown', preventHotkeysHandler, true);

            // Cleanup function
            window._editModeCleanup = function() {
              // Remove click listeners
              document.removeEventListener('click', clickHandler, true);
              document.removeEventListener('click', textClickHandler, true);
              document.removeEventListener('keydown', preventHotkeysHandler, true);

              // Unwrap images
              document.querySelectorAll('.edit-mode-wrapper').forEach(wrapper => {
                const img = wrapper.querySelector('img');
                if (img) {
                  img.classList.remove('edit-mode-wrapped');
                  wrapper.parentNode.insertBefore(img, wrapper);
                  wrapper.remove();
                }
              });

              // Unwrap text elements
              document.querySelectorAll('.edit-mode-text-wrapper').forEach(wrapper => {
                const textEl = wrapper.querySelector('.edit-mode-text-wrapped');
                if (textEl) {
                  textEl.classList.remove('edit-mode-text-wrapped');
                  textEl.contentEditable = 'false';
                  wrapper.parentNode.insertBefore(textEl, wrapper);
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

  // Poll for text edit events from BrowserView
  useEffect(() => {
    if (!useBrowserView || !projectId || !editModeEnabled) return

    const pollInterval = setInterval(async () => {
      try {
        const result = await window.electronAPI?.preview.executeJavaScript(
          projectId,
          `
            if (window.__textEditRequested) {
              const data = window.__textEditData;
              window.__textEditRequested = false;
              window.__textEditData = null;
              data;
            } else {
              null;
            }
          `
        )

        if (result?.result) {
          const { elementInfo, originalContent, newContent } = result.result

          // Find and update the text in source files using element selector
          try {
            const updateResult = await window.electronAPI?.files.replaceTextBySelector(
              projectId,
              elementInfo,
              originalContent,
              newContent
            )

            if (updateResult?.success) {
              console.log('✅ Text updated successfully in', updateResult.filesModified, 'file(s)')
              console.log('   Selector:', elementInfo.selector)
              console.log('   ', originalContent, '→', newContent)
            } else {
              console.warn('⚠️ Failed to update text:', updateResult?.error)
            }
          } catch (error) {
            console.error('❌ Error updating text:', error)
          }
        }
      } catch (error) {
        // Silently ignore - preview might not be ready
      }
    }, 100) // Poll every 100ms

    return () => clearInterval(pollInterval)
  }, [useBrowserView, projectId, editModeEnabled])

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
    setPreviewLoading(true)

    // Retry preview creation
    const rect = browserViewRef.current?.getBoundingClientRect()
    if (!rect) {
      console.error('Cannot retry - DOM bounds still unavailable')
      setPreviewFailed(true)
      setPreviewLoading(false)
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
      setTimeout(() => setPreviewLoading(false), 500)
    } catch (error) {
      console.error('Failed to retry preview creation:', error)
      setPreviewFailed(true)
      setPreviewLoading(false)
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
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage: `url(${noiseBgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'soft-light',
            }}
          />
          {/* Browser label */}
          <div className="text-[12px] text-gray-500 font-medium px-2">
            CodeDeck Browser
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
          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-25 pointer-events-none"
            style={{
              backgroundImage: `url(${noiseBgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              mixBlendMode: 'soft-light',
            }}
          />
          {/* Inner area for BrowserView positioning */}
          <div
            ref={browserViewRef}
            className="w-full h-full bg-white relative"
          >
            {/* Frozen background overlay - positioned exactly where BrowserView appears */}
            <FrozenBackground />

            {/* Loading animation */}
            {previewLoading && !previewFailed && <PreviewLoader />}

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
