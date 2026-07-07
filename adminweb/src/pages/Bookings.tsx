import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { Booking } from '../types';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { notify } from '../services/notify';

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const data = await api.get<{ bookings: Booking[]; total: number; page: number; limit: number; totalPages: number }>(`/admin/bookings?${params}`);
      setBookings(data.bookings);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  const stableLoad = useCallback(load, [page, statusFilter, search]);

  useEffect(() => { stableLoad(); }, [stableLoad]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilter(f: string) {
    setStatusFilter(f);
    setPage(1);
  }

  const statusColors: Record<string, string> = {
    requested: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-blue-100 text-blue-700',
    on_the_way: 'bg-indigo-100 text-indigo-700',
    working: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    rejected: 'bg-gray-100 text-gray-500',
  };

  const statusOptions = ['all', 'requested', 'accepted', 'on_the_way', 'working', 'completed', 'cancelled', 'rejected'];

  const filtered = bookings;

  function toggleBookingSelection(bookingId: string) {
    setSelectedBookings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  }

  function toggleAllBookings() {
    if (selectedBookings.size === filtered.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(filtered.map((b) => b.id)));
    }
  }

  function exportToCSV() {
    const headers = ['ID', 'Customer', 'Provider', 'Status', 'Amount', 'Date'];
    const rows = filtered.map((b) => [
      b.id,
      b.customer?.firstName || b.customer?.user?.phone || '-',
      b.provider?.firstName || b.provider?.user?.phone || '-',
      b.status,
      b.totalAmount,
      new Date(b.scheduledDate).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Bookings exported successfully');
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2"
          >
            📥 Export CSV
          </button>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <SearchInput
          value={search}
          onChange={handleSearchChange}
          placeholder="Search by customer, provider, or ID..."
          className="w-full md:w-80"
        />
        <div className="flex gap-2 flex-wrap">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => handleStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-xs capitalize ${
                statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedBookings.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedBookings.size} bookings selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const selected = filtered.filter((b) => selectedBookings.has(b.id));
                const csv = selected.map((b) => `${b.id},${b.status},${b.totalAmount}`).join('\n');
                navigator.clipboard.writeText(csv);
                notify.success('Booking IDs copied to clipboard');
              }}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              Copy IDs
            </button>
            <button
              onClick={() => setSelectedBookings(new Set())}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {loading && <TableSkeleton rows={8} cols={7} />}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedBookings.size === filtered.length && filtered.length > 0}
                    onChange={toggleAllBookings}
                    className="rounded"
                  />
                </th>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Provider</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Amount</th>
                <th className="text-left p-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className={`border-t hover:bg-gray-50 ${selectedBookings.has(b.id) ? 'bg-blue-50' : ''}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedBookings.has(b.id)}
                      onChange={() => toggleBookingSelection(b.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3 font-mono text-xs">{b.id.slice(0, 8)}</td>
                  <td className="p-3">{b.customer?.firstName || b.customer?.user?.phone || '-'}</td>
                  <td className="p-3">{b.provider?.firstName || b.provider?.user?.phone || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[b.status] || 'bg-gray-100'}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">₹{Number(b.totalAmount).toFixed(2)}</td>
                  <td className="p-3 text-gray-500">{new Date(b.scheduledDate).toLocaleDateString()}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && (
        <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}
