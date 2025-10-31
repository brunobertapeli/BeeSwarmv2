import { useState } from 'react'

interface TechIconProps {
  name: string
  label: string
}

// Tech icon configuration with colors and display names
const TECH_CONFIG: Record<string, { color: string; displayName: string }> = {
  react: { color: '#61DAFB', displayName: 'React' },
  node: { color: '#339933', displayName: 'Node.js' },
  mongodb: { color: '#47A248', displayName: 'MongoDB' },
  stripe: { color: '#635BFF', displayName: 'Stripe' },
  supabase: { color: '#3ECF8E', displayName: 'Supabase' },
  materialui: { color: '#007FFF', displayName: 'Material UI' },
}

function TechIcon({ name, label }: TechIconProps) {
  const [isHovered, setIsHovered] = useState(false)
  const techKey = name.toLowerCase()
  const config = TECH_CONFIG[techKey] || { color: '#888888', displayName: label }

  // Get the SVG path
  const svgPath = `/src/assets/tech-icons/${techKey}.svg`

  return (
    <div
      className="relative group"
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
        {/* SVG Icon */}
        <img
          src={svgPath}
          alt={config.displayName}
          className="w-4 h-4 transition-all duration-200"
          style={{
            filter: isHovered ? 'none' : 'grayscale(100%) brightness(0.4) opacity(0.8)',
          }}
        />
      </div>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
          <div className="px-2 py-1 bg-dark-bg/95 backdrop-blur-sm border border-dark-border rounded shadow-xl">
            <span className="text-[10px] text-white whitespace-nowrap font-medium">
              {config.displayName}
            </span>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2">
            <div
              className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-dark-border"
              style={{ marginTop: '-1px' }}
            />
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[3px] border-transparent border-t-dark-bg/95"
              style={{ marginTop: '-4px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default TechIcon
