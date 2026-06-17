import { useEffect, useState } from 'react';
import { api } from '../services/api';

export default function Commissions() {
  const [configs, setConfigs] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>('/admin/commissions').then(setConfigs).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Commissions</h1>
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
    </div>
  );
}
