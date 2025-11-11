import { useLayoutStore } from '../store/layoutStore'
import { useEffect } from 'react'

function FrozenBackground() {
  const { modalFreezeActive, modalFreezeImage, layoutState } = useLayoutStore()

  useEffect(() => {
    console.log('🖼️ [FROZEN BACKGROUND] State changed:', {
      modalFreezeActive,
      hasImage: !!modalFreezeImage,
      layoutState,
      willRender: modalFreezeActive && !!modalFreezeImage,
      timestamp: new Date().toISOString()
    })
  }, [modalFreezeActive, modalFreezeImage, layoutState])

  if (!modalFreezeActive || !modalFreezeImage) {
    console.log('⚪ [FROZEN BACKGROUND] Not rendering (inactive or no image)')
    return null
  }

  console.log('🟢 [FROZEN BACKGROUND] RENDERING freeze overlay')
  return (
    <div
      className="absolute inset-0 z-[90] pointer-events-none"
      style={{
        backgroundImage: `url(${modalFreezeImage})`,
        backgroundSize: '100% 100%', // Stretch to exact container size (1:1)
        backgroundPosition: 'top left',
        backgroundRepeat: 'no-repeat',
        filter: 'blur(8px) saturate(0.7) brightness(0.8)',
        WebkitFilter: 'blur(8px) saturate(0.7) brightness(0.8)',
      }}
    />
  )
}

export default FrozenBackground
