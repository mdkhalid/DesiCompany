import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { CommissionConfig } from '../types';

export default function Commissions() {
  const [configs, setConfigs] = useState<CommissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<CommissionConfig[]>('/admin/commissions');
      setConfigs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load commissions');
    } finally {
      setLoading(false);
    }
  }

  const stableLoad = useCallback(load, []);

  useEffect(() => { stableLoad(); }, [stableLoad]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissions</h1>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading commissions...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="text-left p-3">Scope</th><th className="text-left p-3">Type</th><th className="text-left p-3">Value</th><th className="text-left p-3">Status</th></tr></thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="p-3">{c.scope}{c.scopeId ? ` (${c.scopeId.slice(0, 8)})` : ''}</td>
                  <td className="p-3 capitalize">{c.type}</td>
                  <td className="p-3">{c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
