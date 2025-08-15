'use client'

import { useState, useEffect } from 'react'
import { 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import DashboardLogin from '../../components/DashboardLogin'
import { AnalyticsSummary } from '../../types'

interface TimeRangeOption {
  value: string
  label: string
}

const timeRangeOptions: TimeRangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
  { value: 'quarter', label: 'Last 90 days' },
  { value: 'year', label: 'Last year' }
]

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316', '#EC4899']

export default function SiteAnalyticsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [timeRange, setTimeRange] = useState('month')
  const [error, setError] = useState('')

  const handleLogin = async (password: string): Promise<boolean> => {
    setIsLoading(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin
      console.log('Login attempt to:', `${apiUrl}/api/analytics/auth/dashboard`)
      const response = await fetch(`${apiUrl}/api/analytics/auth/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for cookies
        body: JSON.stringify({ password }),
      })

      if (response.ok) {
        setIsAuthenticated(true)
        return true
      }
      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAnalyticsData = async () => {
    if (!isAuthenticated) return

    setIsLoading(true)
    setError('')
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin
      const response = await fetch(`${apiUrl}/api/analytics/stats?period=${timeRange}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false)
          return
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      setData(result.data)
    } catch (error) {
      console.error('Failed to fetch analytics data:', error)
      setError('Failed to load analytics data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin
      await fetch(`${apiUrl}/api/analytics/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setIsAuthenticated(false)
      setData(null)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalyticsData()
    }
  }, [isAuthenticated, timeRange])

  if (!isAuthenticated) {
    return <DashboardLogin onLogin={handleLogin} isLoading={isLoading} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Site Analytics</h1>
              <p className="mt-2 text-sm text-gray-700">
                Comprehensive website traffic and visitor analytics
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                disabled={isLoading}
              >
                {timeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {isLoading && !data && (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
            <p className="mt-4 text-gray-600">Loading analytics data...</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Total Page Views</div>
                <div className="text-2xl font-bold text-gray-900">{data.totalPageViews.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Unique Visitors</div>
                <div className="text-2xl font-bold text-gray-900">{data.totalUniqueVisitors.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Avg Daily Views</div>
                <div className="text-2xl font-bold text-gray-900">{data.avgDailyViews.toLocaleString()}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm font-medium text-gray-500">Avg Session Duration</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Math.round(data.avgSessionDuration / 60)}m {data.avgSessionDuration % 60}s
                </div>
              </div>
            </div>

            {/* Daily Traffic Chart */}
            <div className="bg-white rounded-lg shadow mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Daily Traffic</h3>
              </div>
              <div className="p-6">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString()}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value, name) => [value, name === 'views' ? 'Page Views' : 'Unique Visitors']}
                      />
                      <Area
                        type="monotone"
                        dataKey="views"
                        stackId="1"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.6}
                      />
                      <Area
                        type="monotone"
                        dataKey="uniqueVisitors"
                        stackId="2"
                        stroke="#10B981"
                        fill="#10B981"
                        fillOpacity={0.6}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Countries */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Countries</h3>
                </div>
                <div className="p-6">
                  {data.topCountries.length > 0 ? (
                    <div className="space-y-4">
                      {data.topCountries.map((country, index) => (
                        <div key={country.country} className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-4 h-4 bg-blue-500 rounded mr-3" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                            <span className="font-medium">{country.country}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{country.views.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">{country.percentage}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No country data available</p>
                  )}
                </div>
              </div>

              {/* Top Pages */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Pages</h3>
                </div>
                <div className="p-6">
                  {data.topPages.length > 0 ? (
                    <div className="space-y-4">
                      {data.topPages.map((page) => (
                        <div key={page.path} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium truncate max-w-xs">{page.path}</div>
                            <div className="text-sm text-gray-500">
                              {page.uniqueVisitors} unique visitors
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{page.views.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">
                              {Math.round(page.avgTimeOnPage / 60)}m {page.avgTimeOnPage % 60}s avg
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No page data available</p>
                  )}
                </div>
              </div>

              {/* Device Breakdown */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Device Types</h3>
                </div>
                <div className="p-6">
                  {data.deviceBreakdown.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.deviceBreakdown}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({deviceType, percentage}) => `${deviceType}: ${percentage}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="views"
                          >
                            {data.deviceBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-gray-500">No device data available</p>
                  )}
                </div>
              </div>

              {/* Browser Breakdown */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Top Browsers</h3>
                </div>
                <div className="p-6">
                  {data.browserBreakdown.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.browserBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="browser" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="views" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-gray-500">No browser data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Refresh Button */}
            <div className="mt-8 text-center">
              <button
                onClick={fetchAnalyticsData}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Refreshing...
                  </>
                ) : (
                  'Refresh Data'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}