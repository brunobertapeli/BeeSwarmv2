import { Device, Orientation } from '../types/devices'

interface DeviceFrameProps {
  device: Device
  orientation: Orientation
  children: React.ReactNode
}

function DeviceFrame({ device, orientation, children }: DeviceFrameProps) {
  // Calculate dimensions based on orientation
  const width = orientation === 'portrait' ? device.width : device.height
  const height = orientation === 'portrait' ? device.height : device.width

  // Calculate scale to fit screen (max 90% of viewport height)
  const maxHeight = window.innerHeight * 0.7 // 70% of viewport height
  const scale = Math.min(1, maxHeight / height)

  return (
    <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-900 via-dark-bg to-gray-900">
      {/* Device Container */}
      <div
        className="relative transition-all duration-500"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `scale(${scale})`,
        }}
      >
        {/* Device Frame/Bezel */}
        <div className="absolute inset-0 rounded-[36px] bg-dark-card border-[14px] border-gray-900 shadow-2xl overflow-hidden">
          {/* Screen Notch (for iPhones) */}
          {device.name.includes('iPhone') && device.name !== 'iPhone SE' && orientation === 'portrait' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[26px] bg-gray-900 rounded-b-2xl z-10" />
          )}

          {/* Device Screen */}
          <div className="w-full h-full bg-white rounded-[22px] overflow-hidden relative">
            {/* Preview Content */}
            <div className="absolute inset-0">
              {children}
            </div>
          </div>

          {/* Home Indicator (for modern iPhones) */}
          {device.name.includes('iPhone') && device.name !== 'iPhone SE' && orientation === 'portrait' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-gray-700 rounded-full" />
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

      {/* Device Info Badge */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-dark-card/90 backdrop-blur-sm border border-dark-border rounded-full">
        <p className="text-[11px] text-gray-400">
          {device.name} • {width} × {height}
          {scale < 1 && ` • ${Math.round(scale * 100)}%`}
        </p>
      </div>
    </div>
  )
}

export default DeviceFrame
