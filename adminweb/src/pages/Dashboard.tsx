import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardMetrics } from '../types';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<DashboardMetrics>('/admin/dashboard');
      setMetrics(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cards = metrics ? [
    { label: 'Total Users', value: metrics.totalUsers, color: 'bg-blue-500' },
    { label: 'Customers', value: metrics.totalCustomers, color: 'bg-green-500' },
    { label: 'Providers', value: metrics.totalProviders, color: 'bg-purple-500' },
    { label: 'Active Users', value: metrics.activeUsers, color: 'bg-teal-500' },
    { label: 'Bookings', value: metrics.totalBookings, color: 'bg-orange-500' },
    { label: 'Payments', value: metrics.totalPayments, color: 'bg-pink-500' },
  ] : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading dashboard...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-xl shadow p-6">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-white text-xl mb-3`}>
                {card.label[0]}
              </div>
              <p className="text-gray-500 text-sm">{card.label}</p>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
