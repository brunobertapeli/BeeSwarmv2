import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Repeat, Smartphone, RefreshCw } from 'lucide-react'
import { Device, DeviceType, Orientation, MOBILE_DEVICES } from '../types/devices'

interface DeviceSelectorProps {
  viewMode: DeviceType
  selectedDevice: Device
  orientation: Orientation
  onSelectDevice: (device: Device) => void
  onToggleOrientation: () => void
  onRefresh?: () => void
}

function DeviceSelector({
  viewMode,
  selectedDevice,
  orientation,
  onSelectDevice,
  onToggleOrientation,
  onRefresh,
}: DeviceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const devices = MOBILE_DEVICES

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelectDevice = (device: Device) => {
    onSelectDevice(device)
    setIsOpen(false)
  }

  // Get dimensions based on orientation
  const displayWidth = orientation === 'landscape' ? selectedDevice.height : selectedDevice.width
  const displayHeight = orientation === 'landscape' ? selectedDevice.width : selectedDevice.height

  return (
    <div ref={dropdownRef} className="fixed z-[60] top-16 left-1/2 -translate-x-1/2 transition-all duration-300 animate-fadeIn">
      {/* Compact Bar */}
      <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border rounded-full shadow-xl px-3 py-2 flex items-center gap-2">
        {/* Device Icon */}
        <Smartphone size={14} className="text-gray-400 flex-shrink-0" />

        {/* Dropdown Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 hover:text-primary transition-colors group"
        >
          <span className="text-[12px] font-medium text-gray-300 group-hover:text-primary">
            {selectedDevice.name}
          </span>
          <span className="text-[11px] text-gray-500">
            {displayWidth} × {displayHeight}
          </span>
          <ChevronDown
            size={14}
            className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-dark-border" />

        {/* Refresh Button */}
        {onRefresh && (
          <>
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-dark-bg/50 rounded transition-colors group"
              title="Refresh preview"
            >
              <RefreshCw size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
            </button>

            {/* Divider */}
            <div className="w-px h-4 bg-dark-border" />
          </>
        )}

        {/* Rotate Button */}
        <button
          onClick={onToggleOrientation}
          className="p-1 hover:bg-dark-bg/50 rounded transition-colors group"
          title={`Rotate to ${orientation === 'portrait' ? 'landscape' : 'portrait'}`}
        >
          <Repeat size={14} className="text-gray-400 group-hover:text-primary transition-colors" />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2">
          <div className="bg-dark-card/95 backdrop-blur-xl border border-dark-border rounded-xl shadow-2xl overflow-hidden min-w-[240px] animate-scaleIn">
            <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
              {devices.map((device) => (
                <button
                  key={device.id}
                  onClick={() => handleSelectDevice(device)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    selectedDevice.id === device.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-gray-300 hover:bg-dark-bg/50 hover:text-white'
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{device.name}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {device.width} × {device.height}
                    </div>
                  </div>
                  {selectedDevice.id === device.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 ml-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeviceSelector
