import { useState } from 'react'
import { Download, LogIn, RefreshCw, Loader2 } from 'lucide-react'
import { ModalPortal } from './ModalPortal'

export type ClaudeAuthModalState = 'not_installed' | 'not_authenticated' | 'checking' | 'logging_in'

interface ClaudeAuthModalProps {
  isOpen: boolean
  state: ClaudeAuthModalState
  onRetry: () => Promise<void>
  onInstall: () => void
  onLogin: () => Promise<void>
  error?: string
}

export function ClaudeAuthModal({
  isOpen,
  state,
  onRetry,
  onInstall,
  onLogin,
  error
}: ClaudeAuthModalProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  if (!isOpen) return null

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const handleLogin = async () => {
    setIsLoggingIn(true)
    try {
      await onLogin()
    } finally {
      setIsLoggingIn(false)
    }
  }

  const renderContent = () => {
    if (state === 'checking') {
      return (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Checking Claude Code status...</p>
        </div>
      )
    }

    if (state === 'logging_in') {
      return (
        <div className="text-center py-8">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Opening Claude login...</p>
          <p className="text-gray-400 text-sm">Complete the login in your browser, then click Retry below.</p>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="mt-6 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
          >
            {isRetrying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            {isRetrying ? 'Checking...' : 'I completed login - Check again'}
          </button>
        </div>
      )
    }

    if (state === 'not_installed') {
      return (
        <>
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Download className="w-8 h-8 text-orange-400" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-white text-center mb-2">
            Claude Code CLI Required
          </h2>

          <p className="text-gray-400 text-center mb-6 text-sm leading-relaxed">
            CodeDeck uses Claude Code CLI to power AI features.
            Please install it to continue.
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={onInstall}
              className="w-full py-3 px-4 bg-primary hover:bg-primary/80 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Install Claude Code
            </button>

            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRetrying ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <RefreshCw size={18} />
              )}
              {isRetrying ? 'Checking...' : 'I already installed it - Retry'}
            </button>
          </div>
        </>
      )
    }

    // not_authenticated state
    return (
      <>
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-blue-400" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white text-center mb-2">
          Login to Claude Required
        </h2>

        <p className="text-gray-400 text-center mb-6 text-sm leading-relaxed">
          Claude Code CLI is installed, but you need to log in to your
          Anthropic account to use AI features.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/80 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoggingIn ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} />
            )}
            {isLoggingIn ? 'Opening browser...' : 'Login with Claude'}
          </button>

          <button
            onClick={handleRetry}
            disabled={isRetrying || isLoggingIn}
            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRetrying ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            {isRetrying ? 'Checking...' : 'I already logged in - Retry'}
          </button>
        </div>
      </>
    )
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[300] flex items-center justify-center">
        {/* Backdrop - no click to close (blocking modal) */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

        {/* Modal */}
        <div className="relative w-[420px] bg-dark-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
          {renderContent()}
        </div>
      </div>
    </ModalPortal>
  )
}
