import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import type { Toast as ToastType } from '../store/toastStore'

interface ToastProps {
  toast: ToastType
  onClose: () => void
}

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
    iconClass: 'text-primary',
    progressClass: 'bg-primary',
  },
  error: {
    icon: AlertCircle,
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    iconClass: 'text-red-400',
    progressClass: 'bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    iconClass: 'text-yellow-400',
    progressClass: 'bg-yellow-400',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    iconClass: 'text-blue-400',
    progressClass: 'bg-blue-400',
  },
}

function Toast({ toast, onClose }: ToastProps) {
  const [progress, setProgress] = useState(100)
  const [isExiting, setIsExiting] = useState(false)

  const config = TOAST_CONFIG[toast.type]
  const Icon = config.icon

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const interval = 50 // Update every 50ms
      const decrement = (interval / toast.duration) * 100

      const timer = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - decrement
          if (newProgress <= 0) {
            clearInterval(timer)
            return 0
          }
          return newProgress
        })
      }, interval)

      return () => clearInterval(timer)
    }
  }, [toast.duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // Match animation duration
  }

  return (
    <div
      className={`relative w-[380px] ${config.bgClass} backdrop-blur-xl border ${config.borderClass} rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ${
        isExiting
          ? 'translate-x-[400px] opacity-0'
          : 'translate-x-0 opacity-100 animate-slideIn'
      }`}
    >
      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-dark-border/30">
          <div
            className={`h-full ${config.progressClass} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5 pt-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <Icon size={20} className={config.iconClass} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white mb-0.5">{toast.title}</h4>
          {toast.message && (
            <p className="text-xs text-gray-400 leading-relaxed">{toast.message}</p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X size={14} className="text-gray-400 hover:text-white transition-colors" />
        </button>
      </div>
    </div>
  )
}

export default Toast
