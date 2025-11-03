import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

// Generate unique ID for each toast
const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateId()
    const newToast: Toast = {
      id,
      ...toast,
      duration: toast.duration || 4000, // Default 4 seconds (20% faster)
    }

    set((state) => {
      // Limit to 5 toasts max, remove oldest if needed
      const toasts = [...state.toasts, newToast]
      if (toasts.length > 5) {
        toasts.shift()
      }
      return { toasts }
    })

    // Auto-remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, newToast.duration)
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearAll: () => {
    set({ toasts: [] })
  },
}))
