import { useToastStore } from '../store/toastStore'
import Toast from './Toast'

function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onClose={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
