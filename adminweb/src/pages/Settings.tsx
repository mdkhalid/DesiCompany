import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

interface GracePeriodConfig {
  enabled: boolean;
  days: number;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'grace-period'>('grace-period');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <button
          onClick={() => setActiveTab('grace-period')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'grace-period'
              ? 'bg-white text-blue-600 border border-b-white rounded-b-none'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Provider Grace Period
        </button>
      </div>

      {activeTab === 'grace-period' && <GracePeriodTab />}
    </div>
  );
}

function GracePeriodTab() {
  const [config, setConfig] = useState<GracePeriodConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<GracePeriodConfig>('/settings/provider-grace-period');
      setConfig(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load grace period settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setActionError('');
    setSuccess('');
    try {
      await api.post<GracePeriodConfig>('/settings/provider-grace-period', {
        enabled: config.enabled,
        days: config.days,
      });
      setSuccess('Grace period settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading settings...</div>;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{actionError}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">{success}</div>
      )}

      {/* Grace Period Configuration */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Provider Grace Period Settings</h2>
        <p className="text-sm text-gray-500 mb-6">
          Allow new providers to operate on the platform for a limited time while they complete KYC verification.
          During the grace period, providers will be visible to customers and can accept bookings.
        </p>

        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between py-4 border-b">
            <div>
              <p className="text-sm font-medium text-gray-900">Enable Grace Period</p>
              <p className="text-xs text-gray-500 mt-1">
                When enabled, new providers can operate without KYC verification for the configured period
              </p>
            </div>
            <button
              onClick={() => setConfig(prev => prev ? { ...prev, enabled: !prev.enabled } : null)}
              disabled={saving}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                config?.enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  config?.enabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {/* Days Input */}
          <div className="py-4">
            <label className="text-sm font-medium text-gray-900 block mb-2">
              Grace Period Duration (Days)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                max="30"
                value={config?.days || 7}
                onChange={(e) => setConfig(prev => prev ? { ...prev, days: parseInt(e.target.value) || 7 } : null)}
                disabled={saving}
                className="border rounded-lg px-4 py-2 text-sm w-32"
              />
              <span className="text-sm text-gray-500">
                {config?.days || 7} {config?.days === 1 ? 'day' : 'days'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Providers will be visible to customers for this many days after registration. After this period,
              KYC verification becomes mandatory to continue operating.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="py-4 border-t">
            <p className="text-sm font-medium text-gray-900 mb-3">Quick Presets</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, days: 3 } : null)}
                disabled={saving}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
              >
                3 Days
              </button>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, days: 7 } : null)}
                disabled={saving}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
              >
                7 Days
              </button>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, days: 14 } : null)}
                disabled={saving}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
              >
                14 Days
              </button>
              <button
                onClick={() => setConfig(prev => prev ? { ...prev, days: 30 } : null)}
                disabled={saving}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50 transition-colors"
              >
                30 Days
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How Grace Period Works</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
                  <li>New providers are automatically visible to customers upon registration</li>
                  <li>Provider created date is tracked to calculate grace period expiry</li>
                  <li>After grace period expires, only KYC-verified providers remain visible</li>
                  <li>Admins can manually verify providers anytime via KYC verification page</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Status */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-sm font-semibold mb-4">Current Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Grace Period Status</p>
            <p className={`text-lg font-bold ${config?.enabled ? 'text-green-600' : 'text-gray-400'}`}>
              {config?.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="text-lg font-bold text-blue-600">
              {config?.days || 7} {config?.days === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
