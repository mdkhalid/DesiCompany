import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { notify } from '../services/notify';
import type { ErrorLog, ErrorLogStats } from '../types';
import { TableSkeleton } from '../components/LoadingSkeleton';

const STATUS_COLORS: Record<string, string> = {
  '400': 'bg-yellow-100 text-yellow-700',
  '401': 'bg-red-100 text-red-700',
  '403': 'bg-red-100 text-red-700',
  '404': 'bg-yellow-100 text-yellow-700',
  '422': 'bg-yellow-100 text-yellow-700',
  '429': 'bg-orange-100 text-orange-700',
  '500': 'bg-red-100 text-red-700',
  '502': 'bg-red-100 text-red-700',
  '503': 'bg-red-100 text-red-700',
};

const CATEGORY_COLORS: Record<string, string> = {
  VALIDATION: 'bg-yellow-100 text-yellow-700',
  AUTH: 'bg-red-100 text-red-700',
  DATABASE: 'bg-purple-100 text-purple-700',
  EXTERNAL: 'bg-orange-100 text-orange-700',
  INTERNAL: 'bg-gray-100 text-gray-700',
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString();
}

function StatCard({ label, value, highlight, red }: { label: string; value: number; highlight?: boolean; red?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-blue-300 bg-blue-50' : red ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${red ? 'text-red-600' : highlight ? 'text-blue-700' : 'text-gray-900'}`}>{value.toLocaleString()}</p>
    </div>
  );
}

export default function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.append('statusCode', statusFilter);
      const [logsData, statsData] = await Promise.all([
        api.get<{ items: ErrorLog[]; total: number }>(`/admin/error-logs?${params.toString()}`),
        api.get<ErrorLogStats>('/admin/error-logs/stats'),
      ]);
      setLogs(logsData.items);
      setTotal(logsData.total);
      setStats(statsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load error logs');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleResolve(id: string) {
    setResolving(true);
    try {
      await api.patch(`/admin/error-logs/${id}/resolve`);
      notify.success('Error marked as resolved');
      setShowDetailModal(false);
      load();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Failed to resolve error');
    } finally {
      setResolving(false);
    }
  }

  async function handlePurge() {
    const days = window.prompt('Enter number of days to keep:', '30');
    if (!days) return;
    setPurging(true);
    try {
      const result = await api.delete<{ deleted: number; message: string }>(`/admin/error-logs/purge?days=${days}`);
      notify.success(result.message);
      load();
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Failed to purge logs');
    } finally {
      setPurging(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const error5xx = stats
    ? (stats.byStatusCode['500'] ?? 0) + (stats.byStatusCode['502'] ?? 0) + (stats.byStatusCode['503'] ?? 0)
    : 0;
  const error4xx = stats
    ? Object.entries(stats.byStatusCode).reduce((s, [k, v]) => (k.startsWith('4') ? s + v : s), 0)
    : 0;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Error Logs</h1>
          <p className="text-sm text-gray-500 mt-1">All HTTP errors captured by the system</p>
        </div>
        <button onClick={handlePurge} disabled={purging} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium">{purging ? 'Purging...' : 'Purge Old Logs'}</button>
      </div>
      {stats && (<div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Errors" value={stats.total} />
        <StatCard label="Last 24h" value={stats.last24h} highlight />
        <StatCard label="Last 7 Days" value={stats.last7d} />
        <StatCard label="5xx" value={error5xx} red />
        <StatCard label="4xx" value={error4xx} />
      </div>)}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Status Codes</option>
            <option value="400">400</option>
            <option value="401">401</option>
            <option value="403">403</option>
            <option value="404">404</option>
            <option value="422">422</option>
            <option value="429">429</option>
            <option value="500">500</option>
            <option value="502">502</option>
            <option value="503">503</option>
          </select>
        </div>
        {loading ? <TableSkeleton cols={7} rows={10} /> : error ? <div className="p-8 text-center text-red-500">{error}</div> : logs.length === 0 ? <div className="p-8 text-center text-gray-400">No error logs found</div> : (<>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => { setSelectedLog(log); setShowDetailModal(true); }}>
                  <td className="px-4 py-3"><span className={'px-2 py-1 rounded text-xs font-medium ' + (STATUS_COLORS[String(log.statusCode)] || 'bg-gray-100 text-gray-600')}>{log.statusCode}</span></td>
                  <td className="px-4 py-3">{log.category && <span className={'px-2 py-1 rounded text-xs font-medium ' + (CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-600')}>{log.category}</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{log.method ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">{log.url ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{log.userId ? log.userId.slice(0,8)+'...' : '-'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">{log.resolvedAt ? <span className="text-green-600 text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-50 hover:bg-gray-50">Previous</button>
            <span className="text-sm text-gray-500">Page {page} of {totalPages || 1}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="px-3 py-1 text-sm border border-gray-200 rounded disabled:opacity-50 hover:bg-gray-50">Next</button>
          </div>
        </>)}
      </div>
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Error Detail</h2>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-500 mb-1">Status</p><span className={'px-2 py-1 rounded text-xs font-medium ' + (STATUS_COLORS[String(selectedLog.statusCode)] || 'bg-gray-100 text-gray-600')}>{selectedLog.statusCode}</span></div>
                <div><p className="text-xs text-gray-500 mb-1">Category</p>{selectedLog.category && <span className={'px-2 py-1 rounded text-xs font-medium ' + (CATEGORY_COLORS[selectedLog.category] || 'bg-gray-100 text-gray-600')}>{selectedLog.category}</span>}</div>
                <div><p className="text-xs text-gray-500 mb-1">Method</p><p className="text-sm font-mono">{selectedLog.method ?? '-'}</p></div>
                <div><p className="text-xs text-gray-500 mb-1">User</p><p className="text-sm font-mono text-xs">{selectedLog.userId ?? '-'}</p></div>
                <div><p className="text-xs text-gray-500 mb-1">Occurred</p><p className="text-sm">{formatDate(selectedLog.createdAt)}</p></div>
                <div><p className="text-xs text-gray-500 mb-1">Trace ID</p><p className="text-sm font-mono text-xs">{selectedLog.traceId ?? '-'}</p></div>
              </div>
              {selectedLog.message && <div><p className="text-xs text-gray-500 mb-1">Message</p><p className="bg-gray-50 rounded p-2">{selectedLog.message}</p></div>}
              {selectedLog.stack && <div><p className="text-xs text-gray-500 mb-1">Stack</p><pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto">{selectedLog.stack}</pre></div>}
              {!selectedLog.resolvedAt && <button onClick={() => handleResolve(selectedLog.id)} disabled={resolving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">{resolving ? 'Resolving...' : 'Mark Resolved'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
