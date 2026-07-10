import { useEffect, useState } from 'react';
import { api, downloadCsv } from '../services/api';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { CardSkeleton } from '../components/LoadingSkeleton';
import ErrorBoundary from '../components/ErrorBoundary';

interface DashboardMetrics {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  totalBookings: number;
  totalPayments: number;
  activeUsers: number;
}

interface AnalyticsOverview {
  totalBookings: number;
  todayBookings: number;
  weekBookings: number;
  monthBookings: number;
  totalUsers: number;
  totalProviders: number;
  totalCustomers: number;
  totalRevenue: number;
  monthRevenue: number;
  averageRating: number;
  gracePromoCost: number;
}

interface AnalyticsData {
  overview?: AnalyticsOverview;
  recentBookings?: unknown[];
  topProviders?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    averageRating: number;
    totalReviews: number;
  }>;
  bookingsByStatus?: Record<string, number>;
  dailyBookingsTrend?: Array<{ date: string; count: string }>;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [metricsData, analyticsData] = await Promise.all([
        api.get<DashboardMetrics>('/admin/dashboard'),
        api.get<AnalyticsData>(`/admin/analytics?range=${timeRange}`),
      ]);
      setMetrics(metricsData);
      setAnalytics(analyticsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const metricCards = metrics
    ? [
        { label: 'Total Users', value: metrics.totalUsers, icon: '👥', color: 'bg-blue-500' },
        { label: 'Customers', value: metrics.totalCustomers, icon: '🛒', color: 'bg-green-500' },
        { label: 'Providers', value: metrics.totalProviders, icon: '🔧', color: 'bg-purple-500' },
        { label: 'Active Users', value: metrics.activeUsers, icon: '✅', color: 'bg-teal-500' },
        { label: 'Total Bookings', value: metrics.totalBookings, icon: '📅', color: 'bg-orange-500' },
        { label: 'Total Payments', value: metrics.totalPayments, icon: '💰', color: 'bg-pink-500' },
      ]
    : [];

  const overview = analytics?.overview;
  const bookingsByStatus = analytics?.bookingsByStatus || {};
  const dailyBookingsTrend = analytics?.dailyBookingsTrend || [];
  const topProviders = analytics?.topProviders || [];

  // Safe value renderer
  const safeValue = (v: unknown, fallback = 0): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return isNaN(n) ? fallback : n;
    }
    return fallback;
  };

  // Render bookings trend chart
  const renderBookingsTrendChart = () => {
    if (dailyBookingsTrend.length === 0) return null;
    const chartData = dailyBookingsTrend.map((row) => ({
      date: row.date,
      bookings: safeValue(row.count),
    }));
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Bookings Trend (Last {timeRange === '90d' ? '90' : timeRange === '7d' ? '7' : '30'} days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="bookings"
              stroke="#3B82F6"
              strokeWidth={2}
              name="Bookings"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Render bookings by status chart
  const renderBookingsByStatusChart = () => {
    const entries = Object.entries(bookingsByStatus);
    if (entries.length === 0) return null;
    const chartData = entries.map(([status, count]) => ({
      status,
      count: safeValue(count),
    }));
    return (
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Bookings by Status</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="status" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3B82F6" name="Bookings" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

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
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
          <button
            onClick={load}
            className="px-3 py-1 rounded-lg text-sm border hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => downloadCsv('/admin/analytics/grace/csv', `grace-promo-report-${Date.now()}.csv`).catch(() => {})}
            className="px-3 py-1 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
            title="Export grace-period promo cost report (CSV)"
          >
            ⬇ Grace Report
          </button>
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
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-2xl`}
                  >
                    {card.icon}
                  </div>
                </div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-2xl font-bold">
                  {safeValue(card.value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Overview Summary */}
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow p-6 text-white">
                <p className="text-blue-100 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold">
                  ₹{safeValue(overview.totalRevenue).toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow p-6 text-white">
                <p className="text-green-100 text-sm">Month Revenue</p>
                <p className="text-3xl font-bold">
                  ₹{safeValue(overview.monthRevenue).toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl shadow p-6 text-white">
                <p className="text-purple-100 text-sm">Today's Bookings</p>
                <p className="text-3xl font-bold">
                  {safeValue(overview.todayBookings).toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl shadow p-6 text-white">
                <p className="text-orange-100 text-sm">Avg Rating</p>
                <p className="text-3xl font-bold">
                  ⭐ {safeValue(overview.averageRating).toFixed(1)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow p-6 text-white">
                <p className="text-red-100 text-sm">Grace Promo Cost (mo)</p>
                <p className="text-3xl font-bold">
                  ₹{safeValue(overview.gracePromoCost).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <ErrorBoundary>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {renderBookingsTrendChart()}
              {renderBookingsByStatusChart()}
            </div>
          </ErrorBoundary>

          {/* Top Providers Table */}
          {topProviders.length > 0 && (
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Top Providers</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3">Provider</th>
                    <th className="text-left p-3">Rating</th>
                    <th className="text-left p-3">Reviews</th>
                    <th className="text-left p-3">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {topProviders.slice(0, 10).map((provider) => (
                    <tr key={provider.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">
                        {provider.firstName} {provider.lastName}
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1">
                          ⭐ {safeValue(provider.averageRating).toFixed(1)}
                        </span>
                      </td>
                      <td className="p-3">{safeValue(provider.totalReviews)}</td>
                      <td className="p-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {metricCards.length === 0 && !overview && (
            <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
              No data available. Start adding customers and providers to see analytics.
            </div>
          )}
        </>
      )}
    </div>
  );
}
