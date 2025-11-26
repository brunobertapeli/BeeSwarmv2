import { useRef, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { LogOut, Settings, CreditCard, User as UserIcon, MessageCircle } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import bgImage from '../assets/images/bg.jpg'
import noiseBgImage from '../assets/images/noise_bg.png'

interface UserProfileProps {
  onClose?: () => void
  excludeElement?: string
  onOpenHelp?: () => void
}

function UserProfile({ onClose = () => {}, excludeElement, onOpenHelp }: UserProfileProps) {
  const { user, session, logout, setAwaitingSubscriptionUpdate } = useAppStore()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Don't close if clicking the excluded element (settings button)
      if (excludeElement && (target as Element).closest?.(excludeElement)) {
        return
      }

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose, excludeElement])

  if (!user) return null

  const handleLogout = async () => {
    try {
      const result = await window.electronAPI?.auth.signOut()

      if (result?.success) {
        await logout() // Now async - clears all storage
        toast.success('Logged out', 'You have been successfully logged out')
      } else {
        toast.error('Logout failed', result?.error || 'Failed to log out')
      }
    } catch (error: any) {
      toast.error('Logout failed', error.message || 'An error occurred')
    }
    onClose()
  }

  const handleManageSubscription = async () => {
    if (user.plan === 'free') {
      // Set flag to refresh subscription on next focus
      setAwaitingSubscriptionUpdate(true)

      // Redirect to pricing page in system browser
      await window.electronAPI?.shell?.openExternal('https://www.codedeckai.com/#pricing')
      onClose()
      return
    }

    // For plus/premium users, open Stripe portal in system browser
    try {
      const result = await window.electronAPI?.auth.createStripePortal(session)

      if (result?.success && result.url) {
        // Set flag to refresh subscription on next focus
        setAwaitingSubscriptionUpdate(true)

        await window.electronAPI?.shell?.openExternal(result.url)
      } else {
        toast.error('Portal Error', result?.error || 'Failed to open subscription portal')
      }
    } catch (error: any) {
      toast.error('Portal Error', error.message || 'An error occurred')
    }
    onClose()
  }

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'premium':
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
      case 'plus':
        return 'bg-primary'
      default:
        return 'bg-gray-500'
    }
  }

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'premium':
        return 'Premium'
      case 'plus':
        return 'Plus'
      default:
        return 'Free'
    }
  }

  return (
    <div ref={dropdownRef}>
      {/* Dropdown Menu */}
      <div
        className="w-72 bg-dark-card border border-dark-border rounded-lg shadow-2xl mt-2 relative overflow-hidden"
      >
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

          {/* User Info Header */}
          <div className="px-6 py-4 border-b border-dark-border relative z-10">
            <div className="flex items-center gap-3">
              {user.photoUrl ? (
                <img
                  src={user.photoUrl}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
                  <span className="text-white text-base font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {user.name}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {user.email}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center ${getPlanBadgeColor(user.plan)} rounded-md px-2 py-0.5 text-[10px] font-semibold text-white uppercase tracking-wide`}
                  >
                    {getPlanLabel(user.plan)} Plan
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2 px-2 relative z-10">
            <button
              onClick={() => {
                onOpenHelp?.()
                onClose()
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/90 hover:text-white"
            >
              <MessageCircle size={18} className="text-white/70" />
              <span className="font-medium">Help & Support</span>
            </button>

            <button
              onClick={handleManageSubscription}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/90 hover:text-white"
            >
              <CreditCard size={18} className="text-white/70" />
              <span className="font-medium">
                {user.plan === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
              </span>
            </button>

            <button
              onClick={() => {
                toast.info('Coming soon', 'Settings will be available soon')
                onClose()
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/90 hover:text-white"
            >
              <Settings size={18} className="text-white/70" />
              <span className="font-medium">Settings</span>
            </button>

            <div className="border-t border-white/10 my-2"></div>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-500/20 rounded-lg transition-colors text-sm text-red-300 hover:text-red-200"
            >
              <LogOut size={18} />
              <span className="font-medium">Log Out</span>
            </button>
          </div>
        </div>
    </div>
  )
}

export default UserProfile
