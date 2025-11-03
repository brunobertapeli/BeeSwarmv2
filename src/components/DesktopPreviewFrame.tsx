import { useState } from 'react'
import { RotateCw, Maximize2, Monitor, MonitorSmartphone, ExternalLink } from 'lucide-react'
import bgImage from '../assets/images/bg.jpg'

interface DesktopPreviewFrameProps {
  children: React.ReactNode
  port?: number
}

type PreviewSize = 'full' | 'large' | 'medium'

function DesktopPreviewFrame({ children, port }: DesktopPreviewFrameProps) {
  const [previewSize, setPreviewSize] = useState<PreviewSize>('large')

  // Desktop viewport dimensions (standard laptop size)
  const viewportWidth = 1440
  const viewportHeight = 900

  // Calculate scale based on preview size
  const getScale = () => {
    switch (previewSize) {
      case 'full':
        // Full screen - fill entire space below header
        const fullHeight = window.innerHeight - 48 // Subtract header height
        const fullWidth = window.innerWidth
        return Math.min(fullHeight / viewportHeight, fullWidth / viewportWidth)
      case 'large':
        // Large - 80% of available space, centered
        return 0.80
      case 'medium':
        // Medium - 70% of available space, positioned near top
        return 0.66
      default:
        return 0.7
    }
  }

  const scale = getScale()

  const handleOpenInBrowser = () => {
    if (port) {
      window.electronAPI?.shell.openExternal(`http://localhost:${port}`)
    }
  }

  const handleRefresh = () => {
    // Trigger iframe reload
    const iframe = document.querySelector('iframe')
    if (iframe) {
      iframe.src = iframe.src
    }
  }

  return (
    <div className={`absolute inset-0 flex ${
      previewSize === 'medium' ? 'items-start justify-center' : 'items-center justify-center'
    }`}>
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-blue-950 to-black" />
      <div className="absolute inset-0 bg-black/40" />

      {/* Dot Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(139, 92, 246, 0.5) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Browser Window Container */}
      <div
        className={`relative ${previewSize === 'full' ? 'w-full h-full' : ''}`}
        style={{
          width: previewSize === 'full' ? '100%' : `${viewportWidth}px`,
          height: previewSize === 'full' ? '100%' : `${viewportHeight}px`,
          transform: previewSize === 'full' ? 'none' : `scale(${scale})`,
          transition: 'transform 0.5s ease',
          marginTop: previewSize === 'medium' ? '-130px' : '0', // Pull up closer to header
        }}
      >
        {/* Browser Chrome/Frame */}
        <div className="absolute inset-0 rounded-lg bg-dark-card border border-dark-border shadow-2xl overflow-hidden flex flex-col">
          {/* Background Image */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Browser Top Bar */}
          <div className="h-10 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-gray-700 flex items-center px-3 gap-2 flex-shrink-0 relative z-10">
            {/* URL Bar */}
            <div className="flex-1 bg-gray-950 rounded px-3 py-1.5 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-[11px] text-gray-500 font-mono">localhost:8888</span>
            </div>

            {/* Browser Controls - Icon Buttons */}
            <div className="flex gap-1">
              {/* Refresh */}
              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded hover:bg-gray-700 flex items-center justify-center transition-colors group"
                title="Refresh"
              >
                <RotateCw size={13} className="text-gray-400 group-hover:text-gray-200 transition-colors" />
              </button>

              {/* Full Screen */}
              <button
                onClick={() => setPreviewSize('full')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                  previewSize === 'full' ? 'bg-primary/20' : 'hover:bg-gray-700'
                }`}
                title="Full Screen"
              >
                <Maximize2 size={13} className={`transition-colors ${
                  previewSize === 'full' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-200'
                }`} />
              </button>

              {/* Large Size */}
              <button
                onClick={() => setPreviewSize('large')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                  previewSize === 'large' ? 'bg-primary/20' : 'hover:bg-gray-700'
                }`}
                title="Large (85%)"
              >
                <Monitor size={14} className={`transition-colors ${
                  previewSize === 'large' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-200'
                }`} />
              </button>

              {/* Medium Size */}
              <button
                onClick={() => setPreviewSize('medium')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors group ${
                  previewSize === 'medium' ? 'bg-primary/20' : 'hover:bg-gray-700'
                }`}
                title="Medium (60%)"
              >
                <MonitorSmartphone size={13} className={`transition-colors ${
                  previewSize === 'medium' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-200'
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

          {/* Browser Content Area */}
          <div className="flex-1 bg-white overflow-hidden relative z-10">
            {/* Preview Content */}
            <div className="absolute inset-0">
              {children}
            </div>
          </div>
        </div>

        {/* Frame Shadow */}
        <div className="absolute inset-0 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-none" />
      </div>
    </div>
  )
}

export default DesktopPreviewFrame
