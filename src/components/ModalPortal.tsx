import { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalPortalProps {
  children: ReactNode
}

/**
 * ModalPortal renders its children into a separate DOM node outside the main React tree.
 * This ensures modals always appear above all other content with consistent z-index layering.
 *
 * Z-index hierarchy:
 * - z-300: All modals (via this portal)
 * - z-200: Toast notifications
 * - z-110: ActionBar
 * - z-102: Bottom section (agents/actionbar container)
 * - z-101: Preview area (browser)
 * - z-90: FrozenBackground (inside browser container)
 */
export function ModalPortal({ children }: ModalPortalProps) {
  const modalRoot = document.getElementById('modal-root')

  if (!modalRoot) {
    console.warn('ModalPortal: modal-root element not found in DOM')
    return null
  }

  return createPortal(children, modalRoot)
}
