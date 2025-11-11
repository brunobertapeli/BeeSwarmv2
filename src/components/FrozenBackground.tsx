import { useLayoutStore } from '../store/layoutStore'

function FrozenBackground() {
  const { modalFreezeActive, modalFreezeImage, layoutState } = useLayoutStore()

  if (!modalFreezeActive || !modalFreezeImage) {
    return null
  }
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
