import { useState, useRef, useEffect } from 'react'
import { X, TrendingUp, Users, Eye, Clock, Globe, Smartphone, Monitor, Tablet, Settings, ExternalLink, RefreshCw, BarChart3 } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Placeholder data for UI preview
const PLACEHOLDER_DATA = {
  activeUsers: '--',
  stats: { visitors: '--', pageViews: '--', avgTime: '--' },
  trend: [
    { date: 'Mon', visitors: 40 },
    { date: 'Tue', visitors: 55 },
    { date: 'Wed', visitors: 45 },
    { date: 'Thu', visitors: 70 },
    { date: 'Fri', visitors: 60 },
    { date: 'Sat', visitors: 80 },
    { date: 'Sun', visitors: 65 }
  ],
  topPages: [
    { path: '/home', percentage: '--' },
    { path: '/about', percentage: '--' },
    { path: '/contact', percentage: '--' }
  ],
  sources: [
    { name: 'Google', value: '--', color: '#4285F4' },
    { name: 'Direct', value: '--', color: '#34A853' },
    { name: 'Social', value: '--', color: '#FBBC04' },
    { name: 'Referral', value: '--', color: '#EA4335' }
  ],
  devices: [
    { name: 'Desktop', value: '--', color: '#8b5cf6' },
    { name: 'Mobile', value: '--', color: '#ec4899' },
    { name: 'Tablet', value: '--', color: '#06b6d4' }
  ]
}

type TimeRange = 'today' | 'week' | 'month'

interface AnalyticsData {
  activeUsers: number
  stats: {
    visitors: number
    pageViews: number
    avgTime: string
  }
  trend: Array<{ date: string; visitors: number }>
  topPages: Array<{ path: string; views: number; percentage: number }>
  sources: Array<{ name: string; value: number; color: string }>
  devices: Array<{ name: string; value: number; color: string }>
}

function AnalyticsWidget() {
  const { analyticsWidgetPosition, setAnalyticsWidgetPosition, setAnalyticsWidgetEnabled, analyticsWidgetZIndex, bringWidgetToFront } = useLayoutStore()
  const { currentProjectId } = useAppStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [showSettings, setShowSettings] = useState(false)
  const [showGAModal, setShowGAModal] = useState(false)
  const [gaId, setGaId] = useState('')
  const [tempGaId, setTempGaId] = useState('')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  const FIXED_HEIGHT = 405
  const isConnected = gaId.trim().length > 0

  // Load saved GA ID on mount
  useEffect(() => {
    const loadGaId = async () => {
      if (!currentProjectId) return
      try {
        const result = await window.electronAPI?.analytics?.getGaId?.(currentProjectId)
        if (result?.success && result.gaId) {
          setGaId(result.gaId)
        }
      } catch (err) {
        console.error('Failed to load GA ID:', err)
      }
    }
    loadGaId()
  }, [currentProjectId])

  // Fetch analytics data only if GA is connected
  const fetchAnalyticsData = async (showLoadingState = true) => {
    if (!currentProjectId || !isConnected) return

    try {
      if (showLoadingState) setIsLoading(true)
      else setIsRefreshing(true)

      const result = await window.electronAPI?.analytics?.getData?.(currentProjectId, timeRange)

      if (result?.success && result.data) {
        setAnalyticsData(result.data)
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Fetch data when GA is connected and time range changes
  useEffect(() => {
    if (isConnected) {
      fetchAnalyticsData()
    } else {
      setAnalyticsData(null)
    }
  }, [currentProjectId, timeRange, isConnected])

  const handleRefresh = () => {
    if (isConnected) fetchAnalyticsData(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - analyticsWidgetPosition.x,
      y: e.clientY - analyticsWidgetPosition.y
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        const padding = 5
        const headerHeight = 40 + padding
        const bottomReservedArea = 200 + 2
        const minX = padding
        const maxX = window.innerWidth - 600 - padding
        const minY = headerHeight
        const maxY = window.innerHeight - FIXED_HEIGHT - bottomReservedArea - padding

        setAnalyticsWidgetPosition({
          x: Math.max(minX, Math.min(newX, maxX)),
          y: Math.max(minY, Math.min(newY, maxY))
        })
      }
    }

    const handleMouseUp = () => setIsDragging(false)

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, analyticsWidgetPosition, setAnalyticsWidgetPosition])

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  const handleSaveGAId = async () => {
    setGaId(tempGaId)
    setShowGAModal(false)
    // Save to backend
    if (currentProjectId) {
      try {
        await window.electronAPI?.analytics?.saveGaId?.(currentProjectId, tempGaId)
      } catch (err) {
        console.error('Failed to save GA ID:', err)
      }
    }
  }

  const handleOpenGAModal = () => {
    setTempGaId(gaId)
    setShowGAModal(true)
    setShowSettings(false)
  }

  const handleVisitGA = () => {
    window.electronAPI?.shell?.openExternal('https://analytics.google.com')
    setShowSettings(false)
  }

  // Use real data if connected, otherwise placeholder
  const displayData = isConnected && analyticsData ? analyticsData : PLACEHOLDER_DATA
  const currentStats = displayData.stats

  return (
    <div
      ref={widgetRef}
      className="fixed bg-dark-card/95 backdrop-blur-xl border border-dark-border/80 shadow-2xl overflow-hidden"
      style={{
        left: `${analyticsWidgetPosition.x}px`,
        top: `${analyticsWidgetPosition.y}px`,
        width: '600px',
        height: `${FIXED_HEIGHT}px`,
        zIndex: analyticsWidgetZIndex
      }}
      onMouseDown={(e) => { bringWidgetToFront('analytics'); handleMouseDown(e); }}
    >
      {/* Header */}
      <div
        ref={headerRef}
        className="relative px-4 border-b border-dark-border/50 flex items-center justify-between cursor-move select-none"
        style={{ height: '37px', minHeight: '37px' }}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">Analytics</h3>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 bg-dark-bg/50 rounded-lg p-0.5">
            {(['today', 'week', 'month'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={(e) => { e.stopPropagation(); setTimeRange(range) }}
                onMouseDown={(e) => e.stopPropagation()}
                className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                  timeRange === range
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? '7D' : '30D'}
              </button>
            ))}
          </div>

          {/* Active Users */}
          <div className={`flex items-center gap-1.5 rounded-lg px-2 py-0.5 ${isConnected ? 'bg-green-500/10 border border-green-500/20' : 'bg-dark-bg/30 border border-dark-border/30'}`}>
            <div className="relative">
              <Users size={11} className={isConnected ? 'text-green-400' : 'text-gray-500'} />
              {isConnected && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />}
            </div>
            <span className="text-[9px] text-gray-400">Active:</span>
            <span className={`text-[11px] font-bold ${isConnected ? 'text-green-400' : 'text-gray-500'}`}>
              {displayData.activeUsers}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Button */}
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh() }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            disabled={isRefreshing || !isConnected}
            title={isConnected ? 'Refresh analytics data' : 'Connect GA to enable'}
          >
            <RefreshCw size={14} className={`${isConnected ? 'text-gray-400 hover:text-white' : 'text-gray-600'} ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings) }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            >
              <Settings size={14} className="text-gray-400 hover:text-white" />
            </button>

            {showSettings && (
              <div className="absolute top-full right-0 mt-1 bg-dark-card border border-dark-border/80 rounded-lg shadow-xl overflow-hidden z-[200] min-w-[200px]">
                <button
                  onClick={(e) => { e.stopPropagation(); handleOpenGAModal() }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-left text-[11px] text-gray-300 hover:bg-dark-bg/50 transition-colors flex items-center gap-2"
                >
                  <Settings size={12} className="text-gray-400" />
                  {gaId ? 'Update GA ID' : 'Connect Google Analytics'}
                </button>
                {gaId && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleVisitGA() }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full px-3 py-2 text-left text-[11px] text-gray-300 hover:bg-dark-bg/50 transition-colors flex items-center gap-2 border-t border-dark-border/50"
                  >
                    <ExternalLink size={12} className="text-gray-400" />
                    Visit Google Analytics
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setAnalyticsWidgetEnabled(false)}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X size={16} className="text-gray-400 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative p-3 overflow-y-auto scrollbar-thin" style={{ height: `calc(${FIXED_HEIGHT}px - 37px)` }}>

        {/* Not Connected Banner */}
        {!isConnected && (
          <div className="mb-3 bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BarChart3 size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-200">Connect Google Analytics</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Add your GA4 Property ID to see real analytics data</p>
            </div>
            <button
              onClick={handleOpenGAModal}
              className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-xs text-primary font-medium transition-all"
            >
              Connect
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && isConnected && (
          <div className="absolute inset-0 bg-dark-card/80 flex items-center justify-center z-10">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-primary animate-spin" />
              <span className="text-xs text-gray-400">Loading analytics...</span>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        <div className={`grid grid-cols-3 gap-2 mb-3 ${!isConnected ? 'opacity-50' : ''}`}>
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-blue-400" />
              <span className="text-[9px] text-gray-500 uppercase">Visitors</span>
            </div>
            <p className="text-lg font-bold text-gray-200">
              {typeof currentStats.visitors === 'number' ? currentStats.visitors.toLocaleString() : currentStats.visitors}
            </p>
          </div>
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye size={12} className="text-purple-400" />
              <span className="text-[9px] text-gray-500 uppercase">Views</span>
            </div>
            <p className="text-lg font-bold text-gray-200">
              {typeof currentStats.pageViews === 'number' ? currentStats.pageViews.toLocaleString() : currentStats.pageViews}
            </p>
          </div>
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-orange-400" />
              <span className="text-[9px] text-gray-500 uppercase">Avg Time</span>
            </div>
            <p className="text-lg font-bold text-gray-200">{currentStats.avgTime}</p>
          </div>
        </div>

        {/* Visitor Trend Chart */}
        <div className={`bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2.5 mb-3 ${!isConnected ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-primary" />
            <span className="text-[10px] font-medium text-gray-300">Visitor Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={displayData.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} stroke="#404040" />
              <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} stroke="#404040" width={35} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  fontSize: '11px'
                }}
              />
              <Line
                type="monotone"
                dataKey="visitors"
                stroke={isConnected ? '#8b5cf6' : '#4a4a4a'}
                strokeWidth={2}
                dot={{ fill: isConnected ? '#8b5cf6' : '#4a4a4a', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`grid grid-cols-3 gap-2 mb-3 ${!isConnected ? 'opacity-50' : ''}`}>
          {/* Top Pages */}
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe size={12} className="text-blue-400" />
              <span className="text-[9px] text-gray-500 uppercase">Top Pages</span>
            </div>
            <div className="space-y-1.5">
              {displayData.topPages.slice(0, 3).map((page, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 truncate flex-1 mr-1.5" title={page.path}>
                    {page.path}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-300">
                    {typeof page.percentage === 'number' ? `${page.percentage}%` : page.percentage}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={12} className="text-green-400" />
              <span className="text-[9px] text-gray-500 uppercase">Sources</span>
            </div>
            <div className="space-y-1.5">
              {displayData.sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: isConnected ? source.color : '#4a4a4a' }} />
                    <span className="text-[10px] text-gray-400">{source.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-300">
                    {typeof source.value === 'number' ? `${source.value}%` : source.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Device Breakdown */}
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-2">
              <Monitor size={12} className="text-purple-400" />
              <span className="text-[9px] text-gray-500 uppercase">Devices</span>
            </div>
            <div className="space-y-1.5">
              {displayData.devices.map((device, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {device.name === 'Desktop' && <Monitor size={11} className={isConnected ? 'text-purple-400' : 'text-gray-500'} />}
                    {device.name === 'Mobile' && <Smartphone size={11} className={isConnected ? 'text-pink-400' : 'text-gray-500'} />}
                    {device.name === 'Tablet' && <Tablet size={11} className={isConnected ? 'text-cyan-400' : 'text-gray-500'} />}
                    <span className="text-[10px] text-gray-400">{device.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-300">
                    {typeof device.value === 'number' ? `${device.value}%` : device.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GA ID Modal */}
      {showGAModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[300]" onClick={() => setShowGAModal(false)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[301] bg-dark-card border border-dark-border rounded-xl shadow-2xl w-[400px] overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Google Analytics Configuration</h3>
              <button onClick={() => setShowGAModal(false)} className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors">
                <X size={16} className="text-gray-400 hover:text-white" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-2">
                  Google Analytics Property ID
                </label>
                <input
                  type="text"
                  value={tempGaId}
                  onChange={(e) => setTempGaId(e.target.value)}
                  placeholder="e.g., GA4-XXXXXXXXX or 123456789"
                  className="w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-primary/50 transition-colors"
                  autoFocus
                />
                <p className="mt-2 text-[10px] text-gray-500">
                  Enter your Google Analytics 4 property ID to connect your analytics data.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowGAModal(false)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSaveGAId}
                  className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-xs text-primary font-medium transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default AnalyticsWidget
