import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { Advertisement, AdPlacement, AdStatus, AdTargetAudience, AdDashboardStats, AdAnalytics } from '../types';

const PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: 'home_banner', label: 'Home Banner' },
  { value: 'category_top', label: 'Category Top' },
  { value: 'search_results_top', label: 'Search Results Top' },
  { value: 'search_results_inline', label: 'Search Results Inline' },
  { value: 'provider_list_top', label: 'Provider List Top' },
  { value: 'booking_confirmation', label: 'Booking Confirmation' },
  { value: 'notification_ad', label: 'Notification Ad' },
  { value: 'splash_screen', label: 'Splash Screen' },
  { value: 'footer_banner', label: 'Footer Banner' },
];

const STATUS_COLORS: Record<AdStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
};

export default function Advertisements() {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [stats, setStats] = useState<AdDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<AdAnalytics | null>(null);
  const [filterStatus, setFilterStatus] = useState<AdStatus | ''>('');
  const [filterPlacement, setFilterPlacement] = useState<AdPlacement | ''>('');

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    thumbnailUrl: '',
    targetUrl: '',
    targetScreen: '',
    placement: 'home_banner' as AdPlacement,
    targetAudience: 'all' as AdTargetAudience,
    startDate: '',
    endDate: '',
    priority: 0,
    categoryId: '',
    maxImpressions: '',
    maxClicks: '',
    dailyImpressionLimit: '',
    showCloseButton: true,
    autoCloseSeconds: '',
    backgroundColor: '',
    textColor: '',
    notes: '',
  });

  const loadAds = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPlacement) params.append('placement', filterPlacement);

      const [adsData, statsData] = await Promise.all([
        api.get<Advertisement[]>(`/advertisements/admin/all?${params.toString()}`),
        api.get<AdDashboardStats>('/advertisements/admin/stats'),
      ]);
      setAds(adsData);
      setStats(statsData);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load advertisements');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPlacement]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const handleCreate = async () => {
    try {
      await api.post('/advertisements/admin/create', {
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        maxImpressions: formData.maxImpressions ? parseInt(formData.maxImpressions) : undefined,
        maxClicks: formData.maxClicks ? parseInt(formData.maxClicks) : undefined,
        dailyImpressionLimit: formData.dailyImpressionLimit ? parseInt(formData.dailyImpressionLimit) : undefined,
        autoCloseSeconds: formData.autoCloseSeconds ? parseInt(formData.autoCloseSeconds) : undefined,
      });
      setShowCreateModal(false);
      resetForm();
      loadAds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create advertisement');
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.patch(`/advertisements/admin/${id}/pause`);
      loadAds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to pause advertisement');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await api.patch(`/advertisements/admin/${id}/resume`);
      loadAds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to resume advertisement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this advertisement?')) return;
    try {
      await api.delete(`/advertisements/admin/${id}`);
      loadAds();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete advertisement');
    }
  };

  const handleViewAnalytics = async (id: string) => {
    try {
      const data = await api.get<AdAnalytics>(`/advertisements/admin/${id}/analytics`);
      setSelectedAd(data);
      setShowAnalyticsModal(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to load analytics');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      imageUrl: '',
      thumbnailUrl: '',
      targetUrl: '',
      targetScreen: '',
      placement: 'home_banner',
      targetAudience: 'all',
      startDate: '',
      endDate: '',
      priority: 0,
      categoryId: '',
      maxImpressions: '',
      maxClicks: '',
      dailyImpressionLimit: '',
      showCloseButton: true,
      autoCloseSeconds: '',
      backgroundColor: '',
      textColor: '',
      notes: '',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Advertisements</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          + Create Ad
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-xs">Total Ads</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-green-600 text-xs">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-blue-600 text-xs">Scheduled</p>
            <p className="text-2xl font-bold text-blue-600">{stats.scheduled}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-yellow-600 text-xs">Paused</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.paused}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-red-600 text-xs">Expired</p>
            <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-purple-600 text-xs">Impressions</p>
            <p className="text-2xl font-bold text-purple-600">{stats.totalImpressions.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-orange-600 text-xs">Clicks</p>
            <p className="text-2xl font-bold text-orange-600">{stats.totalClicks.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AdStatus | '')}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={filterPlacement}
          onChange={(e) => setFilterPlacement(e.target.value as AdPlacement | '')}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Placements</option>
          {PLACEMENTS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Ads Table */}
      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={loadAds} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Ad</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Placement</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Schedule</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Performance</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((ad) => (
                <tr key={ad.id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={ad.thumbnailUrl || ad.imageUrl}
                        alt={ad.title}
                        className="w-16 h-10 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x40?text=Ad';
                        }}
                      />
                      <div>
                        <p className="font-medium text-sm">{ad.title}</p>
                        {ad.description && (
                          <p className="text-xs text-gray-500 truncate max-w-xs">{ad.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {PLACEMENTS.find((p) => p.value === ad.placement)?.label || ad.placement}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[ad.status]}`}>
                      {ad.status.charAt(0).toUpperCase() + ad.status.slice(1)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-xs">
                      <p>{formatDate(ad.startDate)}</p>
                      <p className="text-gray-400">to {formatDate(ad.endDate)}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs">
                      <p>👁 {ad.impressions.toLocaleString()} views</p>
                      <p>🖱 {ad.clicks.toLocaleString()} clicks</p>
                      <p className="text-gray-400">
                        CTR: {ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewAnalytics(ad.id)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        title="View Analytics"
                      >
                        📊
                      </button>
                      {ad.status === 'active' && (
                        <button
                          onClick={() => handlePause(ad.id)}
                          className="text-xs text-yellow-600 hover:text-yellow-800"
                          title="Pause"
                        >
                          ⏸
                        </button>
                      )}
                      {(ad.status === 'paused' || ad.status === 'scheduled') && (
                        <button
                          onClick={() => handleResume(ad.id)}
                          className="text-xs text-green-600 hover:text-green-800"
                          title="Resume"
                        >
                          ▶
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(ad.id)}
                        className="text-xs text-red-600 hover:text-red-800"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {ads.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No advertisements found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Ad Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Create Advertisement</h2>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Ad title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Placement *</label>
                    <select
                      value={formData.placement}
                      onChange={(e) => setFormData({ ...formData, placement: e.target.value as AdPlacement })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      {PLACEMENTS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Ad description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL *</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target URL</label>
                    <input
                      type="url"
                      value={formData.targetUrl}
                      onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Screen</label>
                    <input
                      type="text"
                      value={formData.targetScreen}
                      onChange={(e) => setFormData({ ...formData, targetScreen: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="/customer-home"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                    <select
                      value={formData.targetAudience}
                      onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value as AdTargetAudience })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">All Users</option>
                      <option value="customers">Customers</option>
                      <option value="providers">Providers</option>
                      <option value="new_users">New Users</option>
                      <option value="returning_users">Returning Users</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Impressions</label>
                    <input
                      type="number"
                      value={formData.maxImpressions}
                      onChange={(e) => setFormData({ ...formData, maxImpressions: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Clicks</label>
                    <input
                      type="number"
                      value={formData.maxClicks}
                      onChange={(e) => setFormData({ ...formData, maxClicks: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Imp. Limit</label>
                    <input
                      type="number"
                      value={formData.dailyImpressionLimit}
                      onChange={(e) => setFormData({ ...formData, dailyImpressionLimit: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Auto Close (sec)</label>
                    <input
                      type="number"
                      value={formData.autoCloseSeconds}
                      onChange={(e) => setFormData({ ...formData, autoCloseSeconds: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="Never"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BG Color</label>
                    <input
                      type="color"
                      value={formData.backgroundColor || '#ffffff'}
                      onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm h-10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
                    <input
                      type="color"
                      value={formData.textColor || '#000000'}
                      onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2 text-sm h-10"
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.showCloseButton}
                        onChange={(e) => setFormData({ ...formData, showCloseButton: e.target.checked })}
                        className="rounded"
                      />
                      Show Close Button
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Internal notes (not visible to users)"
                  />
                </div>

                {/* Preview */}
                {formData.imageUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preview</label>
                    <div
                      className="rounded-lg overflow-hidden"
                      style={{ backgroundColor: formData.backgroundColor || '#ffffff' }}
                    >
                      <img
                        src={formData.imageUrl}
                        alt="Preview"
                        className="w-full max-h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Invalid+Image+URL';
                        }}
                      />
                      {formData.title && (
                        <div className="p-3">
                          <p style={{ color: formData.textColor || '#000000' }} className="font-medium">
                            {formData.title}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!formData.title || !formData.imageUrl || !formData.startDate || !formData.endDate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Advertisement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalyticsModal && selectedAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Ad Analytics</h2>
                <button
                  onClick={() => { setShowAnalyticsModal(false); setSelectedAd(null); }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium">{selectedAd.title}</h3>
                  <p className="text-sm text-gray-500">{selectedAd.placement}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-600">{selectedAd.impressions.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Impressions</p>
                    {selectedAd.impressionProgress && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, parseFloat(String(selectedAd.impressionProgress)))}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{selectedAd.impressionProgress}% of limit</p>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-green-600">{selectedAd.clicks.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">Clicks</p>
                    {selectedAd.clickProgress && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${Math.min(100, parseFloat(String(selectedAd.clickProgress)))}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{selectedAd.clickProgress}% of limit</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-2xl font-bold text-purple-600">{selectedAd.ctr}%</p>
                  <p className="text-sm text-gray-500">Click-Through Rate (CTR)</p>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{selectedAd.totalDays}</p>
                    <p className="text-xs text-gray-500">Total Days</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{selectedAd.elapsedDays}</p>
                    <p className="text-xs text-gray-500">Elapsed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{selectedAd.remainingDays}</p>
                    <p className="text-xs text-gray-500">Remaining</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t">
                <button
                  onClick={() => { setShowAnalyticsModal(false); setSelectedAd(null); }}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
