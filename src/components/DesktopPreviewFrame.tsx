import { useState } from 'react'
import { MoreVertical, Maximize2, Monitor, Smartphone, ExternalLink } from 'lucide-react'

interface DesktopPreviewFrameProps {
  children: React.ReactNode
  port?: number
}

type PreviewSize = 'full' | 'large' | 'medium'

function DesktopPreviewFrame({ children, port }: DesktopPreviewFrameProps) {
  const [previewSize, setPreviewSize] = useState<PreviewSize>('large')
  const [showMenu, setShowMenu] = useState(false)

  // Desktop viewport dimensions (standard laptop size)
  const viewportWidth = 1440
  const viewportHeight = 900

  // Calculate scale based on preview size
  const getScale = () => {
    switch (previewSize) {
      case 'full':
        // Full screen - maximize to fill available space below header
        const fullHeight = (window.innerHeight - 48 - 100) // header + bottom padding
        const fullWidth = window.innerWidth - 40 // side padding
        return Math.min(fullHeight / viewportHeight, fullWidth / viewportWidth, 1)
      case 'large':
        // Large - 85% of available space
        const largeHeight = window.innerHeight * 0.85
        const largeWidth = window.innerWidth * 0.85
        return Math.min(largeHeight / viewportHeight, largeWidth / viewportWidth, 0.85)
      case 'medium':
        // Medium - 60% of available space
        const mediumHeight = window.innerHeight * 0.6
        const mediumWidth = window.innerWidth * 0.7
        return Math.min(mediumHeight / viewportHeight, mediumWidth / viewportWidth, 0.6)
      default:
        return 0.7
    }
  }

  const scale = getScale()

  const handleOpenInBrowser = () => {
    if (port) {
      window.electronAPI?.shell.openExternal(`http://localhost:${port}`)
    }
    setShowMenu(false)
  }

  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-900 via-dark-bg to-gray-900">
      {/* Browser Window Container */}
      <div
        className="relative transition-all duration-500"
        style={{
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Browser Chrome/Frame */}
        <div className="absolute inset-0 rounded-lg bg-dark-card border border-dark-border shadow-2xl overflow-hidden flex flex-col">
          {/* Browser Top Bar */}
          <div className="h-10 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-700 flex items-center px-3 gap-2 flex-shrink-0">
            {/* Traffic Lights */}
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>

            {/* URL Bar */}
            <div className="flex-1 ml-3 bg-gray-950 rounded px-3 py-1.5 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-[11px] text-gray-500 font-mono">localhost:8888</span>
            </div>

            {/* Browser Controls - Menu Button */}
            <div className="relative flex gap-1">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors"
              >
                <MoreVertical size={14} className="text-gray-400" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-[200]" onClick={() => setShowMenu(false)} />

                  {/* Menu */}
                  <div className="absolute top-full right-0 mt-2 w-48 bg-dark-card border border-dark-border rounded-lg shadow-xl z-[201] overflow-hidden">
                    {/* Size Options */}
                    <div className="p-2 border-b border-dark-border">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide px-2 pb-1">Preview Size</p>
                      <button
                        onClick={() => { setPreviewSize('full'); setShowMenu(false) }}
                        className={`w-full px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                          previewSize === 'full' ? 'bg-primary/20 text-primary' : 'text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <Maximize2 size={14} />
                        Full Screen
                      </button>
                      <button
                        onClick={() => { setPreviewSize('large'); setShowMenu(false) }}
                        className={`w-full px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                          previewSize === 'large' ? 'bg-primary/20 text-primary' : 'text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <Monitor size={14} />
                        Large (85%)
                      </button>
                      <button
                        onClick={() => { setPreviewSize('medium'); setShowMenu(false) }}
                        className={`w-full px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${
                          previewSize === 'medium' ? 'bg-primary/20 text-primary' : 'text-gray-300 hover:bg-gray-700/50'
                        }`}
                      >
                        <Smartphone size={14} />
                        Medium (60%)
                      </button>
                    </div>

                    {/* Open in Browser */}
                    <div className="p-2">
                      <button
                        onClick={handleOpenInBrowser}
                        className="w-full px-3 py-2 rounded flex items-center gap-2 text-sm text-gray-300 hover:bg-gray-700/50 transition-colors"
                      >
                        <ExternalLink size={14} />
                        Open in Browser
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Browser Content Area */}
          <div className="flex-1 bg-white overflow-hidden relative">
            {/* Preview Content */}
            <div className="absolute inset-0">
              {children}
            </div>
          </div>
        </div>

        {/* Frame Shadow */}
        <div className="absolute inset-0 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-none" />
      </div>

      {/* Preview Info Badge */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-full">
        <p className="text-[11px] text-gray-400">
          Desktop Preview • {viewportWidth} × {viewportHeight}
          {scale < 1 && ` • ${Math.round(scale * 100)}%`}
        </p>
      </div>
    </div>
  )
}

export default DesktopPreviewFrame
