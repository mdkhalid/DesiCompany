import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Booking } from '../types';

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    api.get<Booking[]>('/admin/bookings').then(setBookings).catch(() => {
      api.get<Booking[]>('/bookings').then(setBookings).catch(console.error);
    });
  }, []);

  const statusColors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-blue-100 text-blue-700',
    on_the_way: 'bg-indigo-100 text-indigo-700',
    working: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    rejected: 'bg-gray-100 text-gray-500',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bookings</h1>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Provider</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3 font-mono text-xs">{b.id.slice(0, 8)}</td>
                <td className="p-3">{b.customer?.firstName || b.customer?.user?.phone || '-'}</td>
                <td className="p-3">{b.provider?.firstName || b.provider?.user?.phone || '-'}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[b.status] || 'bg-gray-100'}`}>{b.status}</span></td>
                <td className="p-3">₹{Number(b.totalAmount).toFixed(2)}</td>
                <td className="p-3 text-gray-500">{new Date(b.scheduledDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
