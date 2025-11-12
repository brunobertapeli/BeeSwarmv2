import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import { useLayoutStore } from '../store/layoutStore'
import { LogOut, Settings, CreditCard, User as UserIcon } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import bgImage from '../assets/images/bg.jpg'

function UserProfile() {
  const { user, logout, currentProjectId } = useAppStore()
  const { setModalFreezeActive, setModalFreezeImage, layoutState } = useLayoutStore()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const toast = useToast()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle modal freeze when dropdown opens/closes
  useEffect(() => {
    const handleFreeze = async () => {
      if (isDropdownOpen && currentProjectId) {
        // Only freeze if in DEFAULT state (browser is visible)
        if (layoutState === 'DEFAULT') {
          const result = await window.electronAPI?.layout.captureModalFreeze(currentProjectId)

          if (result?.success && result.freezeImage) {
            setModalFreezeImage(result.freezeImage)
            setModalFreezeActive(true)
            await window.electronAPI?.preview.hide(currentProjectId)
          }
        }
      } else {
        // Unfreeze when dropdown closes
        setModalFreezeActive(false)
        // Only show browser back if in DEFAULT state
        if (currentProjectId && layoutState === 'DEFAULT') {
          await window.electronAPI?.preview.show(currentProjectId)
        }
      }
    }

    handleFreeze()
  }, [isDropdownOpen, currentProjectId, layoutState, setModalFreezeActive, setModalFreezeImage])

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
    setIsDropdownOpen(false)
  }

  const handleManageSubscription = () => {
    toast.info('Coming soon', 'Subscription management will be available soon')
    setIsDropdownOpen(false)
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
    <div className="relative" ref={dropdownRef}>
      {/* User Profile Button */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg"
      >
        {/* User Avatar */}
        <div className="relative">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-dark-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center ring-2 ring-dark-border">
              <span className="text-white text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="text-left">
          <div className="text-sm font-medium text-white leading-tight">
            {user.name}
          </div>
          <div className="text-xs text-gray-400 leading-tight">
            {getPlanLabel(user.plan)}
          </div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden z-[100]">
          {/* Background Image */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />

          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-dark-border bg-dark-bg/50 relative z-10">
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
          <div className="py-1 relative z-10">
            <button
              onClick={handleManageSubscription}
              className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-dark-bg transition-colors text-sm text-gray-300 hover:text-white"
            >
              <CreditCard size={16} className="text-gray-400" />
              <span>Manage Subscription</span>
            </button>

            <button
              onClick={() => {
                toast.info('Coming soon', 'Settings will be available soon')
                setIsDropdownOpen(false)
              }}
              className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-dark-bg transition-colors text-sm text-gray-300 hover:text-white"
            >
              <Settings size={16} className="text-gray-400" />
              <span>Settings</span>
            </button>

            <div className="border-t border-dark-border my-1"></div>

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-red-500/10 transition-colors text-sm text-red-400 hover:text-red-300"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile
