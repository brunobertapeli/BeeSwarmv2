import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

interface DownloadProgress {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export default function UpdateNotification() {
  const [state, setState] = useState<UpdateState>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI?.updates
    if (!api) return

    const cleanups: (() => void)[] = []

    cleanups.push(api.onChecking(() => {
      setState('checking')
    }))

    cleanups.push(api.onAvailable((info: UpdateInfo) => {
      setState('available')
      setUpdateInfo(info)
      setDismissed(false)
    }))

    cleanups.push(api.onNotAvailable(() => {
      setState('idle')
    }))

    cleanups.push(api.onProgress((prog: DownloadProgress) => {
      setState('downloading')
      setProgress(prog)
    }))

    cleanups.push(api.onDownloaded((info: UpdateInfo) => {
      setState('ready')
      setUpdateInfo(info)
    }))

    cleanups.push(api.onError((err: { message: string }) => {
      setState('error')
      setError(err.message)
    }))

    return () => {
      cleanups.forEach(cleanup => cleanup())
    }
  }, [])

  const handleDownload = async () => {
    const api = (window as any).electronAPI?.updates
    if (api) {
      await api.download()
    }
  }

  const handleInstall = () => {
    const api = (window as any).electronAPI?.updates
    if (api) {
      api.install()
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  // Don't show anything if idle, checking silently, or dismissed
  if (state === 'idle' || state === 'checking' || dismissed) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 right-4 z-[9999] max-w-sm"
      >
        <div className="bg-[#1a1d24] border border-[#2a2f3a] rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2f3a]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-white">Update Available</span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-4 py-3">
            {state === 'available' && updateInfo && (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  Version <span className="text-white font-medium">{updateInfo.version}</span> is available.
                </p>
                <button
                  onClick={handleDownload}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Download Update
                </button>
              </>
            )}

            {state === 'downloading' && progress && (
              <>
                <p className="text-sm text-gray-300 mb-2">
                  Downloading update...
                </p>
                <div className="w-full bg-[#2a2f3a] rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {Math.round(progress.percent)}% - {formatBytes(progress.bytesPerSecond)}/s
                </p>
              </>
            )}

            {state === 'ready' && updateInfo && (
              <>
                <p className="text-sm text-gray-300 mb-3">
                  Version <span className="text-white font-medium">{updateInfo.version}</span> is ready to install.
                </p>
                <button
                  onClick={handleInstall}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Restart & Install
                </button>
              </>
            )}

            {state === 'error' && (
              <>
                <p className="text-sm text-red-400 mb-2">
                  Update failed: {error}
                </p>
                <button
                  onClick={handleDismiss}
                  className="w-full px-4 py-2 bg-[#2a2f3a] hover:bg-[#3a3f4a] text-white text-sm font-medium rounded-md transition-colors"
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
