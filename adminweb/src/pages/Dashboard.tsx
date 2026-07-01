import { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { DashboardMetrics, AnalyticsDashboard } from '../types';
import { CardSkeleton } from '../components/LoadingSkeleton';
import ErrorBoundary from '../components/ErrorBoundary';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [metricsData, analyticsData] = await Promise.all([
        api.get<DashboardMetrics>('/admin/dashboard'),
        api.get<AnalyticsDashboard>(`/admin/analytics?range=${timeRange}`),
      ]);
      setMetrics(metricsData);
      setAnalytics(analyticsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [timeRange]);

  const metricCards = metrics ? [
    { label: 'Total Users', value: metrics.totalUsers, icon: '👥', color: 'bg-blue-500', change: '+12%' },
    { label: 'Customers', value: metrics.totalCustomers, icon: '🛒', color: 'bg-green-500', change: '+8%' },
    { label: 'Providers', value: metrics.totalProviders, icon: '🔧', color: 'bg-purple-500', change: '+15%' },
    { label: 'Active Users', value: metrics.activeUsers, icon: '✅', color: 'bg-teal-500', change: '+5%' },
    { label: 'Total Bookings', value: metrics.totalBookings, icon: '📅', color: 'bg-orange-500', change: '+22%' },
    { label: 'Total Payments', value: metrics.totalPayments, icon: '💰', color: 'bg-pink-500', change: '+18%' },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-sm ${
                timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-2xl`}>
                    {card.icon}
                  </div>
                  <span className="text-green-500 text-sm font-medium">{card.change}</span>
                </div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-2xl font-bold">{card.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          {analytics?.summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow p-6 text-white">
                <p className="text-blue-100 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold">₹{analytics.summary.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow p-6 text-white">
                <p className="text-green-100 text-sm">Avg Booking Value</p>
                <p className="text-3xl font-bold">₹{analytics.summary.avgBookingValue.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow p-6 text-white">
                <p className="text-purple-100 text-sm">Completion Rate</p>
                <p className="text-3xl font-bold">{analytics.summary.completionRate}%</p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow p-6 text-white">
                <p className="text-orange-100 text-sm">Customer Retention</p>
                <p className="text-3xl font-bold">{analytics.summary.customerRetentionRate}%</p>
              </div>
            </div>
          )}

          {/* Charts */}
          <ErrorBoundary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Chart */}
              {analytics?.revenueData && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.revenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} name="Revenue (₹)" />
                      <Line type="monotone" dataKey="commissions" stroke="#10B981" strokeWidth={2} name="Commissions (₹)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Booking Trends */}
              {analytics?.bookingTrends && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Booking Trends</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.bookingTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#3B82F6" name="Total" />
                      <Bar dataKey="completed" fill="#10B981" name="Completed" />
                      <Bar dataKey="cancelled" fill="#EF4444" name="Cancelled" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Customer Retention */}
              {analytics?.customerRetention && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Customer Retention</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.customerRetention}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="newCustomers" stroke="#3B82F6" strokeWidth={2} name="New Customers" />
                      <Line type="monotone" dataKey="returningCustomers" stroke="#10B981" strokeWidth={2} name="Returning" />
                      <Line type="monotone" dataKey="retentionRate" stroke="#F59E0B" strokeWidth={2} name="Retention %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Providers */}
              {analytics?.topProviders && (
                <div className="bg-white rounded-xl shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Top Providers</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analytics.topProviders.slice(0, 5)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#8B5CF6" name="Revenue (₹)" />
                      <Bar dataKey="bookings" fill="#F59E0B" name="Bookings" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </ErrorBoundary>

          {/* Top Providers Table */}
          {analytics?.topProviders && analytics.topProviders.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Top Provider Performance</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Provider</th>
                    <th className="text-left p-3">Bookings</th>
                    <th className="text-left p-3">Revenue</th>
                    <th className="text-left p-3">Rating</th>
                    <th className="text-left p-3">Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topProviders.map((provider) => (
                    <tr key={provider.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{provider.name}</td>
                      <td className="p-3">{provider.bookings}</td>
                      <td className="p-3">₹{provider.revenue.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="flex items-center gap-1">
                          ⭐ {provider.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${provider.completionRate}%` }}
                            />
                          </div>
                          <span>{provider.completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
