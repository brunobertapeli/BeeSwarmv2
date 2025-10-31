function TitleBar() {
  return (
    <div
      className="fixed top-0 left-0 right-0 h-12 z-50 flex items-center"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Draggable area - invisible but functional */}
      <div className="flex-1" />

      {/* Non-draggable area for traffic lights on macOS */}
      <div
        className="absolute top-0 left-0 w-20 h-12"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      />
    </div>
  )
}

export default TitleBar
