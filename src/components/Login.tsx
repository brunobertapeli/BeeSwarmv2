import { Mail, Loader2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { useState, useEffect } from 'react'
import type { User } from '../types/auth'
import mainShapeImage from '../assets/images/main_shape.png'
import noiseBgImage from '../assets/images/noise_bg.png'

interface LoginProps {
  onLoginSuccess: (user: User) => void
}

function Login({ onLoginSuccess }: LoginProps) {
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  useEffect(() => {
    // Listen for auth success from popup window
    if (window.electronAPI?.auth) {
      const cleanupSuccess = window.electronAPI.auth.onAuthSuccess((result: { user: User; session?: any }) => {
        setIsLoading(false)
        setLoadingProvider(null)
        toast.success('Welcome!', `Successfully logged in as ${result.user.name}`)
        onLoginSuccess(result.user)
      })

      const cleanupError = window.electronAPI.auth.onAuthError((result: { error?: string }) => {
        setIsLoading(false)
        setLoadingProvider(null)
        toast.error('Login failed', result.error || 'An unknown error occurred')
      })

      return () => {
        cleanupSuccess?.()
        cleanupError?.()
      }
    }
  }, [onLoginSuccess, toast])

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setLoadingProvider('Google')

      const result = await window.electronAPI?.auth.signInWithGoogle()

      if (!result?.success) {
        toast.error('Login failed', result?.error || 'Failed to initiate Google login')
        setIsLoading(false)
        setLoadingProvider(null)
      }
      // Don't show toast here - popup window will handle auth
    } catch (error: any) {
      toast.error('Login failed', error.message || 'An error occurred')
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  const handleFacebookLogin = async () => {
    try {
      setIsLoading(true)
      setLoadingProvider('Facebook')

      const result = await window.electronAPI?.auth.signInWithFacebook()

      if (!result?.success) {
        toast.error('Login failed', result?.error || 'Failed to initiate Facebook login')
        setIsLoading(false)
        setLoadingProvider(null)
      }
    } catch (error: any) {
      toast.error('Login failed', error.message || 'An error occurred')
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  const handleGithubLogin = async () => {
    try {
      setIsLoading(true)
      setLoadingProvider('GitHub')

      const result = await window.electronAPI?.auth.signInWithGithub()

      if (!result?.success) {
        toast.error('Login failed', result?.error || 'Failed to initiate GitHub login')
        setIsLoading(false)
        setLoadingProvider(null)
      }
    } catch (error: any) {
      toast.error('Login failed', error.message || 'An error occurred')
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  const handleEmailLogin = () => {
    toast.info('Coming soon', 'Email login will be available in a future update')
  }

  return (
    <div className="w-full h-full bg-[#160042] flex items-center justify-center overflow-hidden relative">
      {/* Fixed shape background */}
      <div
        className="fixed left-0 top-0 w-full h-full z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${mainShapeImage})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="fixed left-0 top-0 w-full h-full z-[1] opacity-70 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseBgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* SVG Gradient Shape */}
      <div className="fixed left-0 top-0 w-full h-full z-[2] overflow-hidden pointer-events-none opacity-40">
        <svg
          className="absolute left-0 bottom-[-100px] w-full right-0"
          height={1192}
          viewBox="0 0 1920 1192"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke="url(#paint0_linear_login)"
            strokeWidth={7}
            strokeDasharray="10 10"
            d="M-40.9996 902C-8.39405 961.001 87.0357 1262.13 234 1171.5C385.21 1078.25 424.961 618.039 479.564 680.288C534.166 742.538 625.164 842.979 735.172 706.451C845.181 569.923 839.697 412.37 1093.03 631.043C1346.36 849.717 1371.47 413.985 1477.97 274.534C1584.48 135.083 1738.61 381.41 1830.32 343.155C1922.04 304.9 1862.93 -74.0337 2236.96 18.2495"
          />
          <defs>
            <linearGradient
              id="paint0_linear_login"
              x1="2117.79"
              y1="34.1404"
              x2="83.2194"
              y2="768.35"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset={0} stopColor="rgba(200, 189, 255)" />
              <stop offset="0.13824" stopColor="#BAA6FF" />
              <stop offset="0.337481" stopColor="#6721FF" />
              <stop offset="0.900573" stopColor="#180048" />
              <stop offset={1} stopColor="#00CBFF" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Login Modal */}
      <div className="relative z-10 bg-[#160042]/20 backdrop-blur-sm border border-white/20 rounded-2xl p-10 w-[480px] shadow-2xl">
        {/* Logo/Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 4L8 12L16 20L24 12L16 4Z" fill="white" opacity="0.9"/>
              <path d="M16 14L10 20L16 26L22 20L16 14Z" fill="white" opacity="0.7"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="banner-title" style={{ fontSize: '42px', marginBottom: '12px' }}>
          Welcome to CodeDeck
        </h1>
        <p className="banner-subtitle" style={{ marginBottom: '40px' }}>
          Sign in to start building your apps
        </p>

        {/* Social Login Buttons */}
        <div className="space-y-3">
          {/* Google Login */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-800 font-medium py-3.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.9895 10.1871C19.9895 9.36767 19.9214 8.76973 19.7742 8.14966H10.1992V11.848H15.8195C15.7062 12.7671 15.0943 14.1512 13.7346 15.0813L13.7155 15.2051L16.7429 17.4969L16.9527 17.5174C18.879 15.7789 19.9895 13.221 19.9895 10.1871Z" fill="#4285F4"/>
              <path d="M10.1993 19.9313C12.9527 19.9313 15.2643 19.0454 16.9527 17.5174L13.7346 15.0813C12.8734 15.6682 11.7176 16.0779 10.1993 16.0779C7.50243 16.0779 5.21352 14.3395 4.39759 11.9366L4.27799 11.9465L1.13003 14.3273L1.08887 14.4391C2.76588 17.6945 6.21061 19.9313 10.1993 19.9313Z" fill="#34A853"/>
              <path d="M4.39748 11.9366C4.18219 11.3166 4.05759 10.6521 4.05759 9.96565C4.05759 9.27909 4.18219 8.61473 4.38615 7.99466L4.38045 7.8626L1.19304 5.44366L1.08875 5.49214C0.397576 6.84305 0.000976562 8.36008 0.000976562 9.96565C0.000976562 11.5712 0.397576 13.0882 1.08875 14.4391L4.39748 11.9366Z" fill="#FBBC05"/>
              <path d="M10.1993 3.85336C12.1142 3.85336 13.406 4.66168 14.1425 5.33717L17.0207 2.59107C15.253 0.985496 12.9527 0 10.1993 0C6.2106 0 2.76588 2.23672 1.08887 5.49214L4.38626 7.99466C5.21352 5.59183 7.50242 3.85336 10.1993 3.85336Z" fill="#EB4335"/>
            </svg>
            {loadingProvider === 'Google' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : null}
            <span>Continue with Google</span>
          </button>

          {/* Facebook Login */}
          <button
            onClick={handleFacebookLogin}
            disabled={isLoading}
            className="w-full bg-[#1877F2] hover:bg-[#0C63D4] text-white font-medium py-3.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 10C20 4.477 15.523 0 10 0S0 4.477 0 10c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V10h2.54V7.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V10h2.773l-.443 2.89h-2.33v6.988C16.343 19.128 20 14.991 20 10z" fill="white"/>
            </svg>
            {loadingProvider === 'Facebook' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : null}
            <span>Continue with Facebook</span>
          </button>

          {/* GitHub Login */}
          <button
            onClick={handleGithubLogin}
            disabled={isLoading}
            className="w-full bg-[#24292e] hover:bg-[#1b1f23] text-white font-medium py-3.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z" fill="white"/>
            </svg>
            {loadingProvider === 'GitHub' ? (
              <Loader2 className="animate-spin" size={20} />
            ) : null}
            <span>Continue with GitHub</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-dark-border"></div>
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-dark-border"></div>
        </div>

        {/* Email Login */}
        <button
          onClick={handleEmailLogin}
          disabled={isLoading}
          className="w-full bg-dark-bg border border-dark-border hover:border-primary/50 text-white font-medium py-3.5 px-4 rounded-lg flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Mail size={20} className="text-gray-400" />
          <span>Continue with Email</span>
        </button>

        {/* Terms */}
        <p className="text-xs text-gray-500 text-center mt-8 leading-relaxed">
          By continuing, you agree to CodeDeck's{' '}
          <a href="https://www.codedeckai.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="https://www.codedeckai.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  )
}

export default Login
