import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { PaymentGateway } from '../types';

export default function PaymentGateways() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('razorpay');
  const [displayName, setDisplayName] = useState('');
  const [credentials, setCredentials] = useState('{}');
  const [error, setError] = useState('');

  const load = useCallback(() => { api.get<PaymentGateway[]>('/admin/payment-gateways').then(setGateways).catch(console.error); }, []);

  useEffect(() => { load(); }, [load]);

  async function addGateway() {
    try {
      setError('');
      let creds: Record<string, string>;
      try { creds = JSON.parse(credentials); } catch { setError('Invalid JSON in credentials'); return; }
      await api.post('/admin/payment-gateways', { type, displayName, credentials: creds });
      setShowForm(false); setDisplayName(''); setCredentials('{}');
      load();
    } catch (e: any) { setError(e.message); }
  }

  async function setDefault(id: string) {
    await api.patch(`/admin/payment-gateways/${id}/default`, {});
    load();
  }

  async function toggleActive(gw: PaymentGateway) {
    await api.patch(`/admin/payment-gateways/${gw.id}`, { isActive: !gw.isActive });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this gateway?')) return;
    await api.delete(`/admin/payment-gateways/${id}`);
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payment Gateways</h1>
      <button onClick={() => setShowForm(!showForm)} className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{showForm ? 'Cancel' : 'Add Gateway'}</button>
      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow mb-6 space-y-3">
          {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{error}</div>}
          <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-lg px-3 py-2 w-full"><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option><option value="cash">Cash</option></select>
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <textarea className="border rounded-lg px-3 py-2 w-full font-mono text-sm" rows={4} placeholder='{"key_id":"...","key_secret":"..."}' value={credentials} onChange={(e) => setCredentials(e.target.value)} />
          <button onClick={addGateway} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save</button>
        </div>
      )}
      <div className="grid gap-4">
        {gateways.map((gw) => (
          <div key={gw.id} className="bg-white p-4 rounded-xl shadow flex items-center justify-between">
            <div>
              <p className="font-semibold">{gw.displayName} <span className="text-gray-400 text-sm">({gw.type})</span></p>
              <p className="text-sm text-gray-500">Fingerprint: {gw.credentialFingerprint}</p>
              <div className="flex gap-3 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${gw.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{gw.isActive ? 'Active' : 'Inactive'}</span>
                {gw.isDefault && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Default</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {!gw.isDefault && <button onClick={() => setDefault(gw.id)} className="text-sm text-blue-600 hover:underline">Set Default</button>}
              <button onClick={() => toggleActive(gw)} className="text-sm hover:underline">{gw.isActive ? 'Disable' : 'Enable'}</button>
              {!gw.isDefault && <button onClick={() => remove(gw.id)} className="text-sm text-red-600 hover:underline">Delete</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
