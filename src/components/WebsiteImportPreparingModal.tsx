import { useEffect, useState } from 'react'
import bgImage from '../assets/images/bg.jpg'

interface WebsiteImportPreparingModalProps {
  show: boolean
  importType: 'template' | 'screenshot' | 'ai'
}

const PHRASES = [
  'Grabbing your data and images...',
  'Preparing everything...',
  'Preparing your prompt...',
  'Starting...'
]

export default function WebsiteImportPreparingModal({ show, importType }: WebsiteImportPreparingModalProps) {
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!show) {
      setProgress(0)
      setCurrentPhrase(0)
      return
    }

    // Change phrase every 800ms
    const phraseInterval = setInterval(() => {
      setCurrentPhrase((prev) => {
        if (prev < PHRASES.length - 1) {
          return prev + 1
        }
        return prev
      })
    }, 800)

    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 1
        if (next >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return next
      })
    }, 40) // Update every 40ms for smooth animation

    return () => {
      clearInterval(phraseInterval)
      clearInterval(progressInterval)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="relative bg-dark-card border border-dark-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl overflow-hidden">
        {/* Background image with low opacity like other modals */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center space-y-5">
          {/* Title */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-3">Preparing Everything</h3>
            <p className="text-sm text-gray-300 min-h-[20px] transition-all duration-300">
              {PHRASES[currentPhrase]}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full">
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  backgroundSize: '200% 100%',
                  animation: 'gradient-x 3s ease infinite'
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">{Math.round(progress)}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}
