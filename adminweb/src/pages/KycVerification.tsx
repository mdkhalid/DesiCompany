import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface KycDoc { id: string; providerId: string; providerName: string; documentType: string; status: string; createdAt: string; }

export default function KycVerification() {
  const [docs, setDocs] = useState<KycDoc[]>([]);

  useEffect(() => {
    api.get<KycDoc[]>('/kyc/documents').then(setDocs).catch(console.error);
  }, []);

  async function updateStatus(id: string, status: string) {
    await api.patch(`/kyc/documents/${id}`, { status });
    setDocs(docs.map((d) => (d.id === id ? { ...d, status } : d)));
  }

  const pending = docs.filter((d) => d.status === 'pending' || d.status === 'under_review');
  const others = docs.filter((d) => !['pending', 'under_review'].includes(d.status));

  function renderDoc(doc: KycDoc) {
    return (
      <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
        <div>
          <p className="font-medium">{doc.providerName}</p>
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
      {pending.length > 0 && <div className="mb-6"><h2 className="font-semibold mb-3">Pending ({pending.length})</h2><div className="space-y-2">{pending.map(renderDoc)}</div></div>}
      <div><h2 className="font-semibold mb-3">Processed ({others.length})</h2><div className="space-y-2">{others.map(renderDoc)}</div></div>
    </div>
  );
}
