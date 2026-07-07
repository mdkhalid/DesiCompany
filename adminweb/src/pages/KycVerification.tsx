import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface KycProvider {
  id: string;
  firstName: string;
  lastName: string;
  user?: { phone: string; email?: string };
  city?: string;
  state?: string;
}

interface KycDoc {
  id: string;
  provider: KycProvider;
  documentType: string;
  documentUrl: string;
  status: string;
  remarks?: string;
  reviewedAt?: string;
  createdAt: string;
}

interface ProviderGroup {
  provider: KycProvider;
  documents: KycDoc[];
  hasPending: boolean;
  allApproved: boolean;
  anyRejected: boolean;
}

function groupByProvider(docs: KycDoc[]): ProviderGroup[] {
  const map = new Map<string, ProviderGroup>();
  for (const doc of docs) {
    const key = doc.provider?.id || doc.id;
    if (!map.has(key)) {
      map.set(key, {
        provider: doc.provider,
        documents: [],
        hasPending: false,
        allApproved: false,
        anyRejected: false,
      });
    }
    const group = map.get(key)!;
    group.documents.push(doc);
    if (doc.status === 'pending' || doc.status === 'under_review') {
      group.hasPending = true;
    }
    if (doc.status === 'rejected') {
      group.anyRejected = true;
    }
  }
  for (const group of map.values()) {
    group.allApproved =
      group.documents.length > 0 &&
      group.documents.every((d) => d.status === 'approved');
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.hasPending && !b.hasPending) return -1;
    if (!a.hasPending && b.hasPending) return 1;
    return 0;
  });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    under_review: 'bg-blue-100 text-blue-700',
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DocumentTypeIcon({ type }: { type: string }) {
  const lc = type.toLowerCase();
  if (lc.includes('aadhaar') || lc.includes('id') || lc.includes('pan')) {
    return <span className="text-2xl">🪪</span>;
  }
  if (lc.includes('license') || lc.includes('dl')) {
    return <span className="text-2xl">🚗</span>;
  }
  if (lc.includes('passport')) {
    return <span className="text-2xl">📕</span>;
  }
  if (lc.includes('address') || lc.includes('utility')) {
    return <span className="text-2xl">🏠</span>;
  }
  return <span className="text-2xl">📄</span>;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url);
}

export default function KycVerification() {
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

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

  useEffect(() => {
    load();
  }, []);

  async function approveAll(providerId: string, documentIds: string[]) {
    if (
      !confirm(
        `Approve all ${documentIds.length} pending document(s) for this provider? This will mark the provider as verified.`,
      )
    ) {
      return;
    }
    setActionLoading(providerId);
    setActionError('');
    setActionMessage('');
    try {
      const remarks = prompt('Optional remarks for approval:') || undefined;
      const results = await Promise.allSettled(
        documentIds.map((id) =>
          api.patch<KycDoc>(`/kyc/${id}/status`, { status: 'approved', remarks }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        setActionMessage(`Approved ${documentIds.length} document(s) successfully.`);
      } else {
        setActionMessage(`Approved ${documentIds.length - failed} document(s), ${failed} failed.`);
      }
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to approve documents');
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectAll(providerId: string, documentIds: string[]) {
    const remarks = prompt('Reason for rejection (required):');
    if (!remarks || !remarks.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setActionLoading(providerId);
    setActionError('');
    setActionMessage('');
    try {
      const trimmed = remarks.trim();
      const results = await Promise.allSettled(
        documentIds.map((id) =>
          api.patch<KycDoc>(`/kyc/${id}/status`, {
            status: 'rejected',
            remarks: trimmed,
          }),
        ),
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        setActionMessage(`Rejected ${documentIds.length} document(s).`);
      } else {
        setActionMessage(`Rejected ${documentIds.length - failed} document(s), ${failed} failed.`);
      }
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to reject documents');
    } finally {
      setActionLoading(null);
    }
  }

  async function approveOne(id: string) {
    setActionLoading(id);
    setActionError('');
    setActionMessage('');
    try {
      const remarks = prompt('Optional remarks:') || undefined;
      await api.patch<KycDoc>(`/kyc/${id}/status`, { status: 'approved', remarks });
      setActionMessage('Document approved.');
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  }

  async function rejectOne(id: string) {
    const remarks = prompt('Reason for rejection (required):');
    if (!remarks || !remarks.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setActionLoading(id);
    setActionError('');
    setActionMessage('');
    try {
      await api.patch<KycDoc>(`/kyc/${id}/status`, {
        status: 'rejected',
        remarks: remarks.trim(),
      });
      setActionMessage('Document rejected.');
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  }

  const groups = groupByProvider(docs);

  const filteredGroups = groups.filter((g) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return g.hasPending;
    if (filter === 'approved') return g.allApproved && !g.hasPending;
    if (filter === 'rejected')
      return g.anyRejected && !g.hasPending && !g.allApproved;
    return true;
  });

  const pendingCount = groups.filter((g) => g.hasPending).length;
  const approvedCount = groups.filter((g) => g.allApproved && !g.hasPending).length;
  const rejectedCount = groups.filter(
    (g) => g.anyRejected && !g.hasPending && !g.allApproved,
  ).length;

  function renderGroup(group: ProviderGroup) {
    const providerName =
      `${group.provider?.firstName || ''} ${group.provider?.lastName || ''}`.trim();
    const phone = group.provider?.user?.phone || '';
    const email = group.provider?.user?.email || '';
    const pendingDocs = group.documents.filter(
      (d) => d.status === 'pending' || d.status === 'under_review',
    );
    const isLoading = actionLoading === group.provider?.id;
    const overallStatus = group.hasPending
      ? 'pending'
      : group.allApproved
        ? 'approved'
        : group.anyRejected
          ? 'rejected'
          : 'pending';

    return (
      <div
        key={group.provider?.id}
        className="bg-white rounded-xl shadow overflow-x-auto"
      >
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              {(group.provider?.firstName?.[0] || '?').toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {providerName || 'Unknown Provider'}
              </h3>
              <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
                {phone && <span>📱 {phone}</span>}
                {email && <span>✉️ {email}</span>}
                <span>📄 {group.documents.length} document(s)</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={overallStatus} />
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {group.documents.map((doc) => (
            <div
              key={doc.id}
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div
                className="relative bg-gray-100 h-40 flex items-center justify-center cursor-pointer"
                onClick={() =>
                  isImageUrl(doc.documentUrl) && setPreviewImage(doc.documentUrl)
                }
              >
                {isImageUrl(doc.documentUrl) ? (
                  <img
                    src={doc.documentUrl}
                    alt={doc.documentType}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="text-center p-4">
                    <DocumentTypeIcon type={doc.documentType} />
                    <p className="text-xs text-gray-600 mt-1 truncate max-w-[150px]">
                      {doc.documentUrl.split('/').pop()}
                    </p>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <StatusBadge status={doc.status} />
                </div>
              </div>
              <div className="p-2">
                <p className="text-sm font-medium text-gray-800 capitalize">
                  {doc.documentType.replace(/_/g, ' ')}
                </p>
                {doc.remarks && (
                  <p className="text-xs text-gray-500 mt-1 italic line-clamp-2">
                    💬 {doc.remarks}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
                {(doc.status === 'pending' || doc.status === 'under_review') && (
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => approveOne(doc.id)}
                      disabled={isLoading || actionLoading === doc.id}
                      className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectOne(doc.id)}
                      disabled={isLoading || actionLoading === doc.id}
                      className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {pendingDocs.length > 0 && (
          <div className="px-4 pb-4 flex gap-2 justify-end border-t pt-3 bg-gray-50">
            <button
              onClick={() => rejectAll(group.provider?.id, pendingDocs.map((d) => d.id))}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Reject All ({pendingDocs.length})
            </button>
            <button
              onClick={() => approveAll(group.provider?.id, pendingDocs.map((d) => d.id))}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : `Approve All (${pendingDocs.length})`}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">KYC Verification</h1>
        <button
          onClick={load}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
        >
          🔄 Refresh
        </button>
      </div>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm">
          {actionMessage}
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b">
        {[
          { key: 'pending', label: `Pending (${pendingCount})` },
          { key: 'approved', label: `Approved (${approvedCount})` },
          { key: 'rejected', label: `Rejected (${rejectedCount})` },
          { key: 'all', label: `All (${groups.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              filter === tab.key
                ? 'bg-white text-blue-600 border border-b-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
          Loading KYC documents...
        </div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredGroups.length === 0 && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
          No {filter === 'all' ? '' : filter} KYC documents found.
        </div>
      )}

      {!loading && !error && filteredGroups.length > 0 && (
        <div className="space-y-4">{filteredGroups.map(renderGroup)}</div>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={previewImage}
              alt="Document preview"
              className="max-w-full max-h-[90vh] object-contain"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
