import './PreviewLoader.css'
import bgImage from '../assets/images/bg.jpg'
import noiseBgImage from '../assets/images/noise_bg.png'

interface PreviewLoaderProps {
  showText?: boolean
}

function PreviewLoader({ showText = true }: PreviewLoaderProps) {
  return (
    <div className="preview-loader">
      {/* Background Image */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-50 pointer-events-none z-[1]"
        style={{
          backgroundImage: `url(${noiseBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'soft-light',
        }}
      />

      <div className="preview-spinner">
        <div className="rect1" />
        <div className="rect2" />
        <div className="rect3" />
        <div className="rect4" />
        <div className="rect5" />
      </div>
      {showText && <div className="preview-loader-text">Loading your project...</div>}
    </div>
  )
}

export default PreviewLoader
