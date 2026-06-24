import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface KycProvider { id: string; firstName: string; lastName: string; user?: { phone: string }; }
interface KycDoc { id: string; provider: KycProvider; documentType: string; status: string; remarks?: string; reviewedAt?: string; createdAt: string; }

export default function KycVerification() {
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<KycDoc[]>('/kyc');
      setDocs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load KYC documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    setActionError('');
    if (!confirm(`Are you sure you want to ${status} this KYC document?`)) return;
    try {
      const remarks = status === 'rejected' ? prompt('Reason for rejection:') : undefined;
      if (status === 'rejected' && !remarks) { setActionError('Rejection reason is required'); return; }
      const updated = await api.patch<KycDoc>(`/kyc/${id}/status`, { status, remarks });
      setDocs((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  const pending = docs.filter((d) => d.status === 'pending' || d.status === 'under_review');
  const others = docs.filter((d) => !['pending', 'under_review'].includes(d.status));

  function renderDoc(doc: KycDoc) {
    return (
      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">{doc.provider?.firstName} {doc.provider?.lastName}</p>
          <p className="text-sm text-gray-500">{doc.documentType}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === 'approved' ? 'bg-green-100 text-green-700' : doc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{doc.status}</span>
        </div>
        <div className="flex gap-2">
          {doc.status === 'pending' && (
            <>
              <button onClick={() => updateStatus(doc.id, 'approved')} className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">Approve</button>
              <button onClick={() => updateStatus(doc.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Reject</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">KYC Verification</h1>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading KYC documents...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {pending.length > 0 && <div className="mb-6"><h2 className="font-semibold mb-3">Pending ({pending.length})</h2><div className="space-y-2">{pending.map(renderDoc)}</div></div>}
          <div><h2 className="font-semibold mb-3">Processed ({others.length})</h2><div className="space-y-2">{others.map(renderDoc)}</div></div>
        </>
      )}
    </div>
  );
}
