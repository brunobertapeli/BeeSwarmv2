import { useState, useEffect } from 'react'
import { Device, Orientation } from '../types/devices'
import bgImage from '../assets/images/bg.jpg'

interface DeviceFrameProps {
  device: Device
  orientation: Orientation
  children: React.ReactNode
}

// Layout constants
const ACTION_BAR_HEIGHT = 110
const TOP_OFFSET = 64        // Below header + DeviceSelector
const SIDE_PADDING = 32      // 16px on each side
const SCALE_PADDING = 0.95   // 5% breathing room

function DeviceFrame({ device, orientation, children }: DeviceFrameProps) {
  // Calculate dimensions based on orientation
  const width = orientation === 'portrait' ? device.width : device.height
  const height = orientation === 'portrait' ? device.height : device.width

  // Calculate scale to fit both width and height constraints
  const calculateScale = (): number => {
    const availableHeight = window.innerHeight - TOP_OFFSET - ACTION_BAR_HEIGHT
    const availableWidth = window.innerWidth - SIDE_PADDING

    const scaleByHeight = (availableHeight / height) * SCALE_PADDING
    const scaleByWidth = (availableWidth / width) * SCALE_PADDING

    return Math.min(1, scaleByHeight, scaleByWidth)
  }

  const [scale, setScale] = useState(calculateScale())

  // Recalculate scale on window resize or device/orientation change
  useEffect(() => {
    const newScale = calculateScale()
    setScale(newScale)

    const handleResize = () => {
      setScale(calculateScale())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [width, height])

  return (
    <div className="relative w-full h-full">
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

      {/* Device Container */}
      <div
        className="absolute left-1/2 transition-transform duration-500"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          top: `${TOP_OFFSET}px`,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Device Frame/Bezel */}
        <div className="absolute inset-0 rounded-[36px] bg-dark-card border-[14px] border-gray-900 shadow-2xl overflow-hidden">
          {/* Background Image */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* Screen Notch (for iPhones) */}
          {device.name.includes('iPhone') && device.name !== 'iPhone SE' && orientation === 'portrait' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[26px] bg-gray-900 rounded-b-2xl z-10" />
          )}

          {/* Device Screen */}
          <div className="w-full h-full bg-white rounded-[22px] overflow-hidden relative z-10">
            {/* Preview Content */}
            <div className="absolute inset-0">
              {children}
            </div>
          </div>

          {/* Home Indicator (for modern iPhones) */}
          {device.name.includes('iPhone') && device.name !== 'iPhone SE' && orientation === 'portrait' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-gray-700 rounded-full z-10" />
          )}
        </div>

        {/* Device Power Button (right side) */}
        <div className="absolute right-[-3px] top-[120px] w-[3px] h-[60px] bg-gray-800 rounded-r-sm" />

        {/* Device Volume Buttons (left side) */}
        <div className="absolute left-[-3px] top-[100px] w-[3px] h-[30px] bg-gray-800 rounded-l-sm" />
        <div className="absolute left-[-3px] top-[140px] w-[3px] h-[30px] bg-gray-800 rounded-l-sm" />

        {/* Device Shadow */}
        <div className="absolute inset-0 rounded-[36px] shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-none" />
      </div>
    </div>
  )
}

export default DeviceFrame
