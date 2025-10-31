import { useToastStore } from '../store/toastStore'
import type { ToastType } from '../store/toastStore'

interface ToastOptions {
  message?: string
  duration?: number
}

export const useToast = () => {
  const { addToast } = useToastStore()

  const createToast = (type: ToastType, title: string, options?: ToastOptions) => {
    addToast({
      type,
      title,
      message: options?.message,
      duration: options?.duration,
    })
  }

  return {
    success: (title: string, message?: string, duration?: number) =>
      createToast('success', title, { message, duration }),

    error: (title: string, message?: string, duration?: number) =>
      createToast('error', title, { message, duration }),

    warning: (title: string, message?: string, duration?: number) =>
      createToast('warning', title, { message, duration }),

    info: (title: string, message?: string, duration?: number) =>
      createToast('info', title, { message, duration }),

    // Shorthand for common use cases
    toast: (type: ToastType, title: string, options?: ToastOptions) =>
      createToast(type, title, options),
  }
}
