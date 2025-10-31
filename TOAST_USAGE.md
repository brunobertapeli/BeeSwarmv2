# Toast Notification System - Usage Guide

## Overview
A complete toast notification system built with Zustand, React, and Tailwind CSS. Features 4 variants (success, error, warning, info) with auto-dismiss, progress bars, and smooth animations.

## Files Created
- `src/store/toastStore.ts` - Zustand store for toast state management
- `src/components/Toast.tsx` - Individual toast component with animations
- `src/components/ToastContainer.tsx` - Container that renders all toasts
- `src/hooks/useToast.ts` - Convenient hook for triggering toasts

## How to Use

### Basic Usage

```tsx
import { useToast } from '../hooks/useToast'

function MyComponent() {
  const toast = useToast()

  const handleAction = () => {
    // Success toast
    toast.success('Action completed!', 'Optional message goes here')

    // Error toast
    toast.error('Something went wrong', 'Please try again')

    // Warning toast
    toast.warning('Be careful!', 'This action cannot be undone')

    // Info toast
    toast.info('Did you know?', 'You can use keyboard shortcuts')
  }

  return <button onClick={handleAction}>Show Toast</button>
}
```

### Custom Duration

```tsx
// Toast that stays for 10 seconds
toast.success('Long message', 'This will stay for 10 seconds', 10000)

// Toast that never auto-dismisses
toast.info('Sticky message', 'Click X to close', 0)
```

### All Toast Variants

```tsx
const toast = useToast()

// Success - Green
toast.success('Success!', 'Operation completed successfully')

// Error - Red
toast.error('Error!', 'Something went wrong')

// Warning - Yellow
toast.warning('Warning!', 'Proceed with caution')

// Info - Blue
toast.info('Info', 'Here is some information')
```

## Examples in Codebase

### Login Component (src/components/Login.tsx)
```tsx
const handleLogin = (provider: string) => {
  toast.success('Welcome back!', `Logging in with ${provider}...`)
  onLoginSuccess()
}
```

### ProjectView Component (src/components/ProjectView.tsx)
```tsx
// Success toast on project switch
toast.success('Project switched', `Now viewing ${project?.name}`)

// Info toast on chat click
toast.info('Starting conversation...', 'Claude is ready to help!')

// Success toast on project creation
toast.success('Project created!', `${projectName} is being set up...`)
```

### ProjectSettings Component (src/components/ProjectSettings.tsx)
```tsx
// Success toast on Netlify connect
toast.success('Netlify connected!', 'You can now deploy your project')

// Warning toast on disconnect
toast.warning('Netlify disconnected', 'You can reconnect anytime')

// Error toast on delete
toast.error('Project deleted', `${projectName} has been permanently removed`)
```

## Features

### Auto-Dismiss
- Default duration: 5000ms (5 seconds)
- Customizable per toast
- Set to 0 for persistent toasts

### Progress Bar
- Visual countdown timer at the top of each toast
- Color matches toast variant
- Smooth animation

### Manual Dismiss
- X button in top-right corner
- Click to close immediately

### Stacking
- Maximum 5 toasts on screen
- Oldest toast removed when limit reached
- Positioned top-right with 12px spacing

### Animations
- Slide in from right with fade (300ms)
- Slide out to right with fade (300ms)
- Smooth transitions

### Variants & Colors
- **Success**: Green (#10B981) - CheckCircle icon
- **Error**: Red (#EF4444) - AlertCircle icon
- **Warning**: Yellow (#F59E0B) - AlertTriangle icon
- **Info**: Blue (#3B82F6) - Info icon

## Advanced Usage

### Direct Store Access (if needed)
```tsx
import { useToastStore } from '../store/toastStore'

function MyComponent() {
  const { toasts, removeToast, clearAll } = useToastStore()

  return (
    <div>
      <p>Active toasts: {toasts.length}</p>
      <button onClick={clearAll}>Clear All Toasts</button>
    </div>
  )
}
```

### Custom Toast Object
```tsx
import { useToastStore } from '../store/toastStore'

function MyComponent() {
  const { addToast } = useToastStore()

  const showCustomToast = () => {
    addToast({
      type: 'success',
      title: 'Custom Toast',
      message: 'With full control',
      duration: 3000
    })
  }

  return <button onClick={showCustomToast}>Show Custom</button>
}
```

## Customization

### Change Default Duration
Edit `src/store/toastStore.ts`:
```tsx
duration: toast.duration || 3000, // Change from 5000 to 3000
```

### Change Max Toasts
Edit `src/store/toastStore.ts`:
```tsx
if (toasts.length > 3) { // Change from 5 to 3
  toasts.shift()
}
```

### Change Position
Edit `src/components/ToastContainer.tsx`:
```tsx
// Top-right (default)
<div className="fixed top-4 right-4 z-[200]">

// Top-center
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200]">

// Bottom-right
<div className="fixed bottom-4 right-4 z-[200]">
```

### Change Colors
Edit `src/components/Toast.tsx` in the `TOAST_CONFIG` object:
```tsx
const TOAST_CONFIG = {
  success: {
    // ... change colors here
  }
}
```

## Notes

- Toast system is always mounted in `App.tsx`
- Toasts appear above all UI (z-index: 200)
- No limit on message length
- Fully accessible with keyboard (Enter/Space to close)
- Mobile responsive

## Demo

Try the app and:
1. Login - see success toast
2. Switch projects - see success toast
3. Click chat/images - see info toasts
4. Create new project - see success toast
5. Connect/disconnect Netlify - see success/warning toasts
6. Delete project - see error toast
7. Save settings - see success toast

Enjoy your new toast notification system! 🎉
