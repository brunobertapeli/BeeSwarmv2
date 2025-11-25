import { motion, AnimatePresence } from 'framer-motion'
import { Github, X } from 'lucide-react'
import noiseBgImage from '../assets/images/noise_bg.png'

interface GitHubSheetProps {
  isOpen: boolean
  onClose: () => void
}

function GitHubSheet({ isOpen, onClose }: GitHubSheetProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{
            type: 'spring',
            damping: 25,
            stiffness: 300,
            mass: 0.8
          }}
          className="fixed bottom-0 left-0 right-0 h-[200px] z-[103] border-t border-gray-700/50"
        >
          <div className="w-full h-full backdrop-blur-xl relative overflow-hidden" style={{ backgroundColor: '#24292F' }}>
            {/* Noise texture overlay */}
            <div
              className="absolute inset-0 opacity-50 pointer-events-none"
              style={{
                backgroundImage: `url(${noiseBgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                mixBlendMode: 'soft-light',
              }}
            />

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="absolute top-3 right-3 p-2 hover:bg-white/10 rounded-lg transition-all z-20"
            >
              <X size={18} className="text-gray-400 hover:text-white transition-colors" />
            </button>

            {/* Content */}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <div className="flex items-center gap-3">
                <Github size={32} className="text-white" />
                <span className="text-2xl font-medium text-white">github</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default GitHubSheet
