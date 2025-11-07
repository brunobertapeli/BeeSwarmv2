import { useState } from 'react'
import { getTechConfig } from '../config/techStack'

interface TechIconProps {
  name: string
  label?: string
}

function TechIcon({ name, label }: TechIconProps) {
  const [isHovered, setIsHovered] = useState(false)
  const config = getTechConfig(name)

  // Use display name from config or provided label
  const displayName = label || config.displayName

  // Try to dynamically load the icon, fallback to a colored circle if not found
  let iconSrc = ''
  try {
    iconSrc = `/src/assets/tech-icons/${config.iconFileName}`
  } catch (e) {
    // If icon doesn't exist, we'll show a colored circle with the first letter
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon Container */}
      <div
        className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-200 ${
          isHovered ? 'scale-110' : ''
        }`}
        style={{
          backgroundColor: isHovered ? `${config.color}15` : 'transparent',
        }}
      >
        {/* SVG Icon or Fallback */}
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={displayName}
            className="w-4 h-4 transition-all duration-200"
            style={{
              filter: isHovered ? 'none' : 'grayscale(100%) brightness(1.2) opacity(0.9)',
            }}
            onError={(e) => {
              // Hide image on error
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
            style={{ backgroundColor: config.color }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute left-0 bottom-full mb-1.5 pointer-events-none z-[9999]">
          <div className="px-2 py-1 bg-dark-bg/95 backdrop-blur-sm border border-dark-border rounded text-[10px] text-gray-300 whitespace-nowrap shadow-lg">
            {displayName}
          </div>
        </div>
      )}
    </div>
  )
}

export default TechIcon
