import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardMetrics } from '../types';

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    api.get<DashboardMetrics>('/admin/dashboard').then(setMetrics).catch(console.error);
  }, []);

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
    </div>
  );
}
