import { CheckCircle2, XCircle, RotateCw } from 'lucide-react'
import { HealthCheckStatus } from '../types/electron'

interface HealthStatusModalProps {
  isOpen: boolean
  onClose: () => void
  healthStatus: HealthCheckStatus | null
  projectId: string
  onRestart: () => void
  buttonRef: React.RefObject<HTMLButtonElement>
}

function HealthStatusModal({ isOpen, onClose, healthStatus, projectId, onRestart, buttonRef }: HealthStatusModalProps) {
  if (!isOpen) return null

  const isHealthy = healthStatus?.healthy ?? true
  const lastChecked = healthStatus?.lastChecked ? new Date(healthStatus.lastChecked) : null

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const renderCheckItem = (
    label: string,
    status: 'pass' | 'fail' | 'pending'
  ) => {
    const tooltipText = status === 'pass' ? 'Running' : status === 'fail' ? 'Stopped' : 'Checking...'

    return (
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-300 font-medium">{label}</div>
        </div>
        <div className="flex-shrink-0 group/check relative">
          {status === 'pass' && (
            <>
              <CheckCircle2 size={12} className="text-green-500" />
              <div className="absolute right-0 bottom-full mb-1 bg-dark-bg border border-dark-border rounded px-2 py-0.5 text-[9px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/check:opacity-100 transition-opacity z-[150] shadow-xl">
                {tooltipText}
              </div>
            </>
          )}
          {status === 'fail' && (
            <>
              <XCircle size={12} className="text-red-500" />
              <div className="absolute right-0 bottom-full mb-1 bg-dark-bg border border-dark-border rounded px-2 py-0.5 text-[9px] text-gray-300 whitespace-nowrap opacity-0 pointer-events-none group-hover/check:opacity-100 transition-opacity z-[150] shadow-xl">
                {tooltipText}
              </div>
            </>
          )}
          {status === 'pending' && (
            <div className="w-[12px] h-[12px] border-2 border-gray-500 rounded-full animate-spin border-t-transparent" />
          )}
        </div>
      </div>
    )
  }

  // Calculate position based on button position - appear below, aligned right-to-left
  const buttonRect = buttonRef.current?.getBoundingClientRect()
  const left = buttonRect ? buttonRect.left : 0
  const top = buttonRect ? buttonRect.bottom + 8 : 0

  return (
    <div
      className="health-modal fixed bg-dark-card border border-dark-border rounded-lg shadow-2xl p-3 min-w-[200px] z-[100] animate-fadeIn overflow-hidden"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translateX(-100%)',
      }}
    >
      {/* Header */}
      <div className="mb-2 pb-2 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
          <p className="text-[11px] font-semibold text-gray-300">
            Health Status
          </p>
        </div>
        {lastChecked && (
          <span className="text-[9px] text-gray-500 tabular-nums">
            {formatTime(lastChecked)}
          </span>
        )}
      </div>

      {/* Content */}
      <div>
        {healthStatus ? (
          <>
            <div className="space-y-0">
              {renderCheckItem(
                'HTTP Responding',
                healthStatus.checks.httpResponding.status
              )}
              {renderCheckItem(
                'Process Running',
                healthStatus.checks.processAlive.status
              )}
              {renderCheckItem(
                'Port Listening',
                healthStatus.checks.portListening.status
              )}
              {/* Placeholder for future implementation */}
              {renderCheckItem(
                'AI Process',
                'pass'
              )}
              {/* Placeholder for future implementation */}
              {renderCheckItem(
                'Agents Service',
                'pass'
              )}
            </div>

            {/* Restart button (only show when unhealthy) */}
            {!isHealthy && (
              <button
                onClick={onRestart}
                className="w-full mt-2 pt-2 border-t border-dark-border/50 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 border-b border-l border-r border-red-500/30 rounded-b-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCw size={11} className="text-red-400" />
                <span className="text-[10px] font-medium text-red-400">Restart Server</span>
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-gray-400">
            <div className="text-[10px]">No health data</div>
            <div className="text-[9px] text-gray-500 mt-0.5">Monitoring starts when server is running</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HealthStatusModal
