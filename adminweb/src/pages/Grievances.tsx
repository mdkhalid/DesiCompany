import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Grievance, GrievanceStats, GrievanceStatus, GrievancePriority, ResolutionType } from '../types';
import SearchInput from '../components/SearchInput';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { notify } from '../services/notify';

const CATEGORY_LABELS: Record<string, string> = {
  service_quality: 'Service Quality',
  delay_no_show: 'Delay / No-show',
  billing_overcharge: 'Billing / Overcharge',
  damaged_property: 'Damaged Property',
  rude_behavior: 'Rude Behavior',
  incomplete_work: 'Incomplete Work',
  wrong_service: 'Wrong Service',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  escalated: 'bg-orange-100 text-orange-700',
  admin_review: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  urgent: 'bg-red-100 text-red-600',
};

export default function Grievances() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [stats, setStats] = useState<GrievanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GrievanceStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<GrievancePriority | ''>('');
  const [selectedGrievance, setSelectedGrievance] = useState<Grievance | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [resolutionType, setResolutionType] = useState<ResolutionType>('no_action');
  const [resolutionDetails, setResolutionDetails] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);

      const [grievancesData, statsData] = await Promise.all([
        api.get<Grievance[]>(`/grievances/admin/all?${params.toString()}`),
        api.get<GrievanceStats>('/grievances/admin/stats'),
      ]);
      setGrievances(grievancesData);
      setStats(statsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load grievances');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [statusFilter, priorityFilter]);

  const filtered = grievances.filter((g) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      g.id.toLowerCase().includes(searchLower) ||
      g.customer?.phone?.includes(search) ||
      g.booking?.id?.toLowerCase().includes(searchLower)
    );
  });

  async function handleViewDetail(grievance: Grievance) {
    try {
      const data = await api.get<Grievance>(`/grievances/admin/${grievance.id}`);
      setSelectedGrievance(data);
      setShowDetailModal(true);
    } catch {
      notify.error('Failed to load grievance details');
    }
  }

  async function handleAssign() {
    if (!selectedGrievance) return;
    try {
      await api.put(`/grievances/admin/${selectedGrievance.id}/assign`);
      notify.success('Grievance assigned');
      load();
      handleViewDetail(selectedGrievance);
    } catch {
      notify.error('Failed to assign grievance');
    }
  }

  async function handleResolve() {
    if (!selectedGrievance || !resolutionDetails) return;
    try {
      await api.put(`/grievances/admin/${selectedGrievance.id}/resolve`, {
        resolutionType,
        resolutionDetails,
        adminNotes,
      });
      notify.success('Grievance resolved');
      setShowResolveModal(false);
      load();
      handleViewDetail(selectedGrievance);
    } catch {
      notify.error('Failed to resolve grievance');
    }
  }

  async function handleRecordCall() {
    if (!selectedGrievance || !callNotes) return;
    try {
      await api.put(`/grievances/admin/${selectedGrievance.id}/record-call`, { callNotes });
      notify.success('Call recorded');
      setShowCallModal(false);
      load();
      handleViewDetail(selectedGrievance);
    } catch {
      notify.error('Failed to record call');
    }
  }

  async function handleSendMessage() {
    if (!selectedGrievance || !adminMessage) return;
    try {
      await api.post(`/grievances/admin/${selectedGrievance.id}/message`, { message: adminMessage });
      setAdminMessage('');
      handleViewDetail(selectedGrievance);
    } catch {
      notify.error('Failed to send message');
    }
  }

  function getCustomerPhone(grievance: Grievance): string {
    return grievance.customer?.phone || grievance.booking?.provider?.user?.phone || '-';
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Grievances</h1>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-xs">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-blue-600 text-xs">Open</p>
            <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-orange-600 text-xs">Escalated</p>
            <p className="text-2xl font-bold text-orange-600">{stats.escalated}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-green-600 text-xs">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-purple-600 text-xs">Avg Resolution</p>
            <p className="text-2xl font-bold text-purple-600">{stats.avgResolutionTime}h</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by ID, phone..."
          className="w-full md:w-80"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GrievanceStatus | '')}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="escalated">Escalated</option>
          <option value="admin_review">Admin Review</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as GrievancePriority | '')}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Table */}
      {loading && <TableSkeleton rows={8} cols={8} />}

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
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Created</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((grievance) => (
                <tr key={grievance.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{grievance.id.slice(0, 8)}</td>
                  <td className="p-3">{grievance.customer?.phone || '-'}</td>
                  <td className="p-3">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {CATEGORY_LABELS[grievance.category] || grievance.category}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[grievance.status]}`}>
                      {grievance.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded ${PRIORITY_COLORS[grievance.priority]}`}>
                      {grievance.priority}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {new Date(grievance.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleViewDetail(grievance)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No grievances found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedGrievance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">Grievance #{selectedGrievance.id.slice(0, 8)}</h2>
                  <p className="text-sm text-gray-500">
                    {CATEGORY_LABELS[selectedGrievance.category]} • {selectedGrievance.status.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedGrievance(null); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">Customer Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Phone:</span>{' '}
                    <span className="font-medium">{getCustomerPhone(selectedGrievance)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Booking:</span>{' '}
                    <span className="font-medium">{selectedGrievance.booking?.id?.slice(0, 8)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Amount:</span>{' '}
                    <span className="font-medium">₹{selectedGrievance.booking?.totalAmount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Provider:</span>{' '}
                    <span className="font-medium">
                      {selectedGrievance.booking?.provider?.firstName || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Conversation</h3>
                <div className="bg-gray-100 rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                  {selectedGrievance.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          msg.sender === 'customer'
                            ? 'bg-blue-500 text-white'
                            : msg.sender === 'admin'
                            ? 'bg-green-100 text-green-800'
                            : msg.sender === 'system'
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-white text-gray-800'
                        }`}
                      >
                        <p className="text-xs font-medium mb-1 capitalize">{msg.sender}</p>
                        <p className="break-words">{msg.content}</p>
                        {Array.isArray(msg.metadata?.options) && (
                          <div className="mt-2 space-y-1">
                            {(msg.metadata.options as Array<Record<string, unknown>>).map((opt, i) => (
                              <div key={i} className="bg-white bg-opacity-20 rounded px-2 py-1 text-xs">
                                {String(opt.label ?? JSON.stringify(opt))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Actions */}
              <div className="flex gap-2 flex-wrap">
                {(selectedGrievance.status === 'escalated' || selectedGrievance.status === 'admin_review') && (
                  <>
                    <button
                      onClick={handleAssign}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                    >
                      Assign to Me
                    </button>
                    <button
                      onClick={() => setShowResolveModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => setShowCallModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      📞 Record Call
                    </button>
                  </>
                )}
              </div>

              {/* Admin Message Input */}
              <div className="mt-4 border-t pt-4">
                <h3 className="font-semibold mb-2">Send Message</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!adminMessage}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && selectedGrievance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Resolve Grievance</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Type</label>
                  <select
                    value={resolutionType}
                    onChange={(e) => setResolutionType(e.target.value as ResolutionType)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="discount_coupon">Discount Coupon</option>
                    <option value="auto_reschedule">Auto Reschedule</option>
                    <option value="refund">Refund</option>
                    <option value="provider_feedback">Provider Feedback</option>
                    <option value="no_action">No Action</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Details</label>
                  <textarea
                    value={resolutionDetails}
                    onChange={(e) => setResolutionDetails(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Describe the resolution..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Internal notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!resolutionDetails}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50"
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {showCallModal && selectedGrievance && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Record Call</h2>

              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Customer Phone:</span>{' '}
                  {getCustomerPhone(selectedGrievance)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Notes</label>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={4}
                  placeholder="What was discussed in the call..."
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowCallModal(false)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRecordCall}
                  disabled={!callNotes}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  Save Call Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
