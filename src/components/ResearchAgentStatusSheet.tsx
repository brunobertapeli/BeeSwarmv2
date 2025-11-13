import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import bgImage from '../assets/images/bg.jpg'

interface ResearchAgentStatusSheetProps {
  projectId?: string
  researchAgentRef?: React.RefObject<HTMLDivElement>
}

function ResearchAgentStatusSheet({ projectId, researchAgentRef }: ResearchAgentStatusSheetProps) {
  const { layoutState, setModalFreezeActive, setModalFreezeImage } = useLayoutStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [researchAgentHeight, setResearchAgentHeight] = useState(0)
  const statusSheetRef = useRef<HTMLDivElement>(null)

  // Track research agent height for positioning
  useEffect(() => {
    if (!researchAgentRef?.current) return

    const updateHeight = () => {
      const height = researchAgentRef.current?.offsetHeight || 0
      setResearchAgentHeight(height)
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(researchAgentRef.current)

    return () => observer.disconnect()
  }, [researchAgentRef])

  // Show after a brief delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  // Handle preview freeze when expanding/collapsing
  useEffect(() => {
    const handlePreviewVisibility = async () => {
      if (!projectId) {
        return
      }

      // DEFAULT state: Control preview visibility based on expanded state
      if (layoutState === 'DEFAULT') {
        if (isExpanded) {
          // StatusSheet expanded in DEFAULT → activate freeze, hide preview
          try {
            const result = await window.electronAPI?.layout.captureModalFreeze(projectId)

            if (result?.success && result.freezeImage && isExpanded && layoutState === 'DEFAULT') {
              setModalFreezeImage(result.freezeImage)
              setModalFreezeActive(true)
              await window.electronAPI?.preview.hide(projectId)
            }
          } catch (error) {
            console.error('Failed to capture freeze image:', error)
          }
        } else {
          // StatusSheet collapsed in DEFAULT → deactivate freeze, show preview
          setModalFreezeActive(false)
          await window.electronAPI?.preview.show(projectId)
        }
      }
    }

    handlePreviewVisibility()
  }, [layoutState, isExpanded, projectId, setModalFreezeActive, setModalFreezeImage])

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  // Auto-collapse when clicking outside
  useEffect(() => {
    if (!isExpanded) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Check if click is inside StatusSheet
      const clickedInsideSheet = statusSheetRef.current?.contains(target)

      // Check if click is inside ResearchAgent
      const clickedInsideAgent = researchAgentRef?.current?.contains(target)

      // If clicked outside both, collapse
      if (!clickedInsideSheet && !clickedInsideAgent) {
        setIsExpanded(false)
      }
    }

    // Add listener with slight delay to avoid collapsing on the expand click itself
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isExpanded, researchAgentRef])

  // Calculate bottom position based on research agent height
  const baseOffset = -21 // Gap between research agent and status sheet
  const bottomPosition = isVisible
    ? (researchAgentHeight > 0 ? researchAgentHeight + baseOffset : 95)
    : (researchAgentHeight > 0 ? researchAgentHeight - 14 : 75)

  // For now, always show (in production, check if has research history)
  const shouldRender = true
  const hasHistory = false // Placeholder - will be true when research agent has activity

  return (
    <>
      {shouldRender && (
        <div
          className={`fixed left-0 z-[99] pointer-events-none w-1/3 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            bottom: `${bottomPosition}px`,
            transition: 'opacity 300ms ease-out'
          }}
        >
          <div
            ref={statusSheetRef}
            className="bg-dark-card border border-dark-border shadow-2xl w-full overflow-hidden pb-4 relative pointer-events-auto"
            style={{
              boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Background Image */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Collapsed State - Single Clickable Row */}
            {!isExpanded && (
              <div
                className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors relative z-10"
                onClick={handleToggleExpand}
              >
                <span className="text-xs text-gray-400 flex-1">Research Agent Status</span>
                <ChevronUp size={14} className="text-gray-400" />
              </div>
            )}

            {/* Expanded State */}
            {isExpanded && (
              <div className="relative z-10">
                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-dark-border/50"
                  onClick={handleToggleExpand}
                >
                  <span className="text-xs text-gray-200 font-medium flex-1">Research Agent Activity</span>
                  <ChevronDown size={14} className="text-gray-400" />
                </div>

                {/* Content */}
                <div className="px-4 py-4 max-h-[300px] overflow-y-auto">
                  {!hasHistory ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-gray-500">No research activity yet</p>
                      <p className="text-[10px] text-gray-600 mt-1">Send a message to start</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Placeholder for future research history */}
                      <div className="text-xs text-gray-400">
                        Research history will appear here...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default ResearchAgentStatusSheet
