import { useState, useRef, useEffect } from 'react'
import { X, TrendingUp, Users, Eye, Clock, Globe, Smartphone, Monitor, Tablet, Settings, ExternalLink, RefreshCw } from 'lucide-react'
import { useLayoutStore } from '../store/layoutStore'
import { useAppStore } from '../store/appStore'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import bgImage from '../assets/images/bg.jpg'

// Mock data - will be replaced with real GA data
const MOCK_DATA = {
  activeUsers: 127,
  stats: {
    today: { visitors: 1247, pageViews: 3891, avgTime: '3m 24s' },
    week: { visitors: 8432, pageViews: 24891, avgTime: '3m 12s' },
    month: { visitors: 34219, pageViews: 98234, avgTime: '3m 18s' }
  },
  trend: [
    { date: 'Jan 15', visitors: 820 },
    { date: 'Jan 16', visitors: 932 },
    { date: 'Jan 17', visitors: 901 },
    { date: 'Jan 18', visitors: 1234 },
    { date: 'Jan 19', visitors: 1050 },
    { date: 'Jan 20', visitors: 1189 },
    { date: 'Jan 21', visitors: 1247 }
  ],
  topPages: [
    { path: '/dashboard', views: 1234, percentage: 32 },
    { path: '/products', views: 891, percentage: 23 },
    { path: '/pricing', views: 567, percentage: 15 },
    { path: '/about', views: 445, percentage: 12 },
    { path: '/contact', views: 323, percentage: 8 }
  ],
  sources: [
    { name: 'Google', value: 45, color: '#4285F4' },
    { name: 'Direct', value: 30, color: '#34A853' },
    { name: 'Social', value: 15, color: '#FBBC04' },
    { name: 'Referral', value: 10, color: '#EA4335' }
  ],
  devices: [
    { name: 'Desktop', value: 58, color: '#8b5cf6' },
    { name: 'Mobile', value: 35, color: '#ec4899' },
    { name: 'Tablet', value: 7, color: '#06b6d4' }
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
  trend: Array<{
    date: string
    visitors: number
  }>
  topPages: Array<{
    path: string
    views: number
    percentage: number
  }>
  sources: Array<{
    name: string
    value: number
    color: string
  }>
  devices: Array<{
    name: string
    value: number
    color: string
  }>
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
  const [error, setError] = useState<string | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const FIXED_HEIGHT = 405

  // Fetch analytics data
  const fetchAnalyticsData = async (showLoadingState = true) => {
    if (!currentProjectId) return

    try {
      if (showLoadingState) {
        setIsLoading(true)
      } else {
        setIsRefreshing(true)
      }
      setError(null)

      const result = await window.electronAPI?.analytics.getData(currentProjectId, timeRange)

      if (result?.success && result.data) {
        setAnalyticsData(result.data)
      } else {
        setError(result?.error || 'Failed to fetch analytics data')
        // Fallback to mock data on error
        setAnalyticsData(MOCK_DATA as AnalyticsData)
      }
    } catch (err) {
      console.error('Error fetching analytics:', err)
      setError('Failed to load analytics')
      // Fallback to mock data on error
      setAnalyticsData(MOCK_DATA as AnalyticsData)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  // Manual refresh
  const handleRefresh = () => {
    fetchAnalyticsData(false)
  }

  // Initial data fetch and when time range changes
  useEffect(() => {
    fetchAnalyticsData()
  }, [currentProjectId, timeRange])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    // Set up new interval (5 minutes = 300000ms)
    refreshIntervalRef.current = setInterval(() => {
      fetchAnalyticsData(false)
    }, 300000)

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [currentProjectId, timeRange])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!headerRef.current?.contains(e.target as Node)) {
      return
    }

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

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, analyticsWidgetPosition, setAnalyticsWidgetPosition, FIXED_HEIGHT])

  // Close settings dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  const handleSaveGAId = () => {
    setGaId(tempGaId)
    setShowGAModal(false)
    // TODO: Save to database/localStorage
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

  // Use fetched data or fallback to mock data
  const displayData = analyticsData || (MOCK_DATA as any)
  // Handle both API response format and MOCK_DATA format
  const currentStats = analyticsData
    ? analyticsData.stats
    : MOCK_DATA.stats[timeRange]

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
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

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
                onClick={(e) => {
                  e.stopPropagation()
                  setTimeRange(range)
                }}
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

          {/* Active Users - Compact */}
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-lg px-2 py-0.5">
            <div className="relative">
              <Users size={11} className="text-green-400" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            </div>
            <span className="text-[9px] text-gray-400">Active Now:</span>
            <span className="text-[11px] font-bold text-green-400">{displayData.activeUsers}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleRefresh()
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            disabled={isRefreshing}
            title="Refresh analytics data"
          >
            <RefreshCw
              size={14}
              className={`text-gray-400 hover:text-white ${isRefreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <div className="relative" ref={settingsRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowSettings(!showSettings)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
            >
              <Settings size={14} className="text-gray-400 hover:text-white" />
            </button>

            {/* Settings Dropdown */}
            {showSettings && (
              <div className="absolute top-full right-0 mt-1 bg-dark-card border border-dark-border/80 rounded-lg shadow-xl overflow-hidden z-[200] min-w-[200px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenGAModal()
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 text-left text-[11px] text-gray-300 hover:bg-dark-bg/50 transition-colors flex items-center gap-2"
                >
                  <Settings size={12} className="text-gray-400" />
                  Enter Your GA ID
                </button>
                {gaId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleVisitGA()
                    }}
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
      <div
        className="relative p-3 overflow-y-auto scrollbar-thin"
        style={{ height: `calc(${FIXED_HEIGHT}px - 37px)` }}
      >
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-blue-400" />
              <span className="text-[9px] text-gray-500 uppercase">Visitors</span>
            </div>
            <p className="text-lg font-bold text-gray-200">{currentStats.visitors.toLocaleString()}</p>
          </div>
          <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Eye size={12} className="text-purple-400" />
              <span className="text-[9px] text-gray-500 uppercase">Views</span>
            </div>
            <p className="text-lg font-bold text-gray-200">{currentStats.pageViews.toLocaleString()}</p>
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
        <div className="bg-dark-bg/30 border border-dark-border/30 rounded-lg p-2.5 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-primary" />
            <span className="text-[10px] font-medium text-gray-300">Visitor Trend</span>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={displayData.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#6b7280', fontSize: 9 }}
                stroke="#404040"
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 9 }}
                stroke="#404040"
                width={35}
              />
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
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
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
                    {page.percentage}%
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
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-[10px] text-gray-400">{source.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-300">{source.value}%</span>
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
                    {device.name === 'Desktop' && <Monitor size={11} className="text-purple-400" />}
                    {device.name === 'Mobile' && <Smartphone size={11} className="text-pink-400" />}
                    {device.name === 'Tablet' && <Tablet size={11} className="text-cyan-400" />}
                    <span className="text-[10px] text-gray-400">{device.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-300">{device.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* GA ID Modal */}
      {showGAModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[300]"
            onClick={() => setShowGAModal(false)}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[301] bg-dark-card border border-dark-border rounded-xl shadow-2xl w-[400px] overflow-hidden">
            {/* Background image */}
            <div
              className="absolute inset-0 opacity-5 pointer-events-none"
              style={{
                backgroundImage: `url(${bgImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Header */}
            <div className="relative px-4 py-3 border-b border-dark-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-200">Google Analytics Configuration</h3>
              <button
                onClick={() => setShowGAModal(false)}
                className="p-1 hover:bg-dark-bg/50 rounded-lg transition-colors"
              >
                <X size={16} className="text-gray-400 hover:text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="relative p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-2">
                  Google Analytics Property ID
                </label>
                <input
                  type="text"
                  value={tempGaId}
                  onChange={(e) => setTempGaId(e.target.value)}
                  placeholder="e.g., GA4-XXXXXXXXX"
                  className="w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-primary/50 transition-colors"
                  autoFocus
                />
                <p className="mt-2 text-[10px] text-gray-500">
                  Enter your Google Analytics 4 property ID to connect your analytics data.
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowGAModal(false)}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                >
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
