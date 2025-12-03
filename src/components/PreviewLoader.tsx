import './PreviewLoader.css'

interface PreviewLoaderProps {
  showText?: boolean
}

function PreviewLoader({ showText = true }: PreviewLoaderProps) {
  return (
    <div className="preview-loader">
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
