import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type {
  PlatformFeeConfig,
  SubscriptionPlan,
  PromoCode,
  PromoCodeUsage,
  RevenueStats,
  CustomerMembershipPlan,
  CustomerMembership,
} from '../types';

type Tab = 'config' | 'plans' | 'membership' | 'promo' | 'revenue';

const TABS: { key: Tab; label: string }[] = [
  { key: 'config', label: 'Configuration' },
  { key: 'plans', label: 'Subscription Plans' },
  { key: 'membership', label: 'Memberships' },
  { key: 'promo', label: 'Promo Codes' },
  { key: 'revenue', label: 'Revenue' },
];

export default function Fees() {
  const [activeTab, setActiveTab] = useState<Tab>('config');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Fees & Revenue</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 border border-b-white rounded-b-none'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'plans' && <PlansTab />}
      {activeTab === 'membership' && <MembershipTab />}
      {activeTab === 'promo' && <PromoTab />}
      {activeTab === 'revenue' && <RevenueTab />}
    </div>
  );
}

// ─── Number Input Helper ──────────────────────────────────────

function NumberInput({ value, onChange, ...props }: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value || ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="border rounded-lg px-3 py-2 text-sm"
      {...props}
    />
  );
}

// ─── Fee Config Section Helper ────────────────────────────────

function FeeConfigSection({
  config,
  savingKey,
  onUpdate,
}: {
  label: string;
  config?: PlatformFeeConfig;
  savingKey: string | null;
  onUpdate: (config: PlatformFeeConfig, field: string, value: unknown) => void;
}) {
  if (!config) return null;

  const isSaving = savingKey === config.configKey;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium w-32">Fee Type</label>
        <select
          value={config.configValue?.type || 'percentage'}
          onChange={(e) => onUpdate(config, 'configValue', { type: e.target.value })}
          disabled={isSaving}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed (₹)</option>
        </select>
        {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium w-32">Value</label>
        <NumberInput
          value={config.configValue?.value || 0}
          onChange={(v) => onUpdate(config, 'configValue', { value: v })}
          disabled={isSaving}
        />
        <span className="text-xs text-gray-500">
          {config.configValue?.type === 'percentage' ? '% of amount' : '₹ per transaction'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium w-32">Min Amount</label>
        <NumberInput
          value={config.configValue?.minAmount || 0}
          onChange={(v) => onUpdate(config, 'configValue', { minAmount: v })}
          disabled={isSaving}
        />
        <span className="text-xs text-gray-500">Minimum fee (0 = no minimum)</span>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium w-32">Max Amount</label>
        <NumberInput
          value={config.configValue?.maxAmount || 0}
          onChange={(v) => onUpdate(config, 'configValue', { maxAmount: v })}
          disabled={isSaving}
        />
        <span className="text-xs text-gray-500">Maximum fee (0 = no maximum)</span>
      </div>
    </div>
  );
}

// ─── Configuration Tab ────────────────────────────────────────

function ConfigTab() {
  const [configs, setConfigs] = useState<PlatformFeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<PlatformFeeConfig[]>('/admin/fee-configs');
      setConfigs(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load fee configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateConfig(config: PlatformFeeConfig, field: string, value: unknown) {
    setSavingKey(config.configKey);
    setActionError('');
    try {
      const update: Record<string, unknown> = {};
      if (field === 'configValue') {
        update.configValue = { ...config.configValue, ...(value as Record<string, unknown>) };
      } else if (field === 'isActive') {
        update.isActive = value;
      } else if (field === 'featureEnabled') {
        update.configValue = { ...config.configValue, enabled: value };
      }
      const saved = await api.patch<PlatformFeeConfig>(`/admin/fee-configs/${config.configKey}`, update);
      setConfigs((prev) => prev.map((c) => (c.configKey === config.configKey ? saved : c)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to update config');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading fee configurations...</div>;
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
      </div>
    );
  }

  const feeConfig = configs.find((c) => c.configKey === 'convenience_fee');
  const instantPayoutFee = configs.find((c) => c.configKey === 'instant_payout_fee');
  const leadQuoteFee = configs.find((c) => c.configKey === 'lead_quote_fee');
  const featureFee = configs.find((c) => c.configKey === 'feature_convenience_fee');
  const featureSubs = configs.find((c) => c.configKey === 'feature_provider_subscriptions');
  const featurePromo = configs.find((c) => c.configKey === 'feature_promo_codes');
  const featureInstantPayout = configs.find((c) => c.configKey === 'feature_instant_payout');
  const featureLeadQuoteFee = configs.find((c) => c.configKey === 'feature_lead_quote_fee');
  const featureMemberships = configs.find((c) => c.configKey === 'feature_customer_memberships');

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{actionError}</div>
      )}

      {/* Convenience Fee Settings */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Convenience Fee</h2>
        {feeConfig && (
          <FeeConfigSection label="Convenience Fee" config={feeConfig} savingKey={savingKey} onUpdate={updateConfig} />
        )}
        {!feeConfig && <p className="text-sm text-gray-500">Convenience fee not configured.</p>}
      </div>

      {/* Instant Payout Fee Settings */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Instant Payout Fee</h2>
        {instantPayoutFee && (
          <FeeConfigSection label="Instant Payout Fee" config={instantPayoutFee} savingKey={savingKey} onUpdate={updateConfig} />
        )}
        {!instantPayoutFee && <p className="text-sm text-gray-500">Instant payout fee not configured.</p>}
      </div>

      {/* Lead/Quote Fee Settings */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Lead / Quote Fee</h2>
        {leadQuoteFee && (
          <FeeConfigSection label="Lead/Quote Fee" config={leadQuoteFee} savingKey={savingKey} onUpdate={updateConfig} />
        )}
        {!leadQuoteFee && <p className="text-sm text-gray-500">Lead/quote fee not configured.</p>}
      </div>

      {/* Feature Toggles */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Feature Toggles</h2>
        <div className="space-y-3">
          <ToggleRow
            label="Convenience Fee"
            description="Enable/disable convenience fee on all bookings"
            config={featureFee}
            onToggle={(v) => featureFee && updateConfig(featureFee, 'featureEnabled', v)}
            saving={savingKey === featureFee?.configKey}
          />
          <ToggleRow
            label="Provider Subscriptions"
            description="Enable/disable provider subscription plans"
            config={featureSubs}
            onToggle={(v) => featureSubs && updateConfig(featureSubs, 'featureEnabled', v)}
            saving={savingKey === featureSubs?.configKey}
          />
          <ToggleRow
            label="Instant Payout"
            description="Enable/disable instant payout requests"
            config={featureInstantPayout}
            onToggle={(v) => featureInstantPayout && updateConfig(featureInstantPayout, 'featureEnabled', v)}
            saving={savingKey === featureInstantPayout?.configKey}
          />
          <ToggleRow
            label="Lead/Quote Fee"
            description="Enable/disable fees on provider quote submissions"
            config={featureLeadQuoteFee}
            onToggle={(v) => featureLeadQuoteFee && updateConfig(featureLeadQuoteFee, 'featureEnabled', v)}
            saving={savingKey === featureLeadQuoteFee?.configKey}
          />
          <ToggleRow
            label="Customer Memberships"
            description="Enable/disable customer membership plans"
            config={featureMemberships}
            onToggle={(v) => featureMemberships && updateConfig(featureMemberships, 'featureEnabled', v)}
            saving={savingKey === featureMemberships?.configKey}
          />
          <ToggleRow
            label="Promo Codes"
            description="Enable/disable promo code redemption"
            config={featurePromo}
            onToggle={(v) => featurePromo && updateConfig(featurePromo, 'featureEnabled', v)}
            saving={savingKey === featurePromo?.configKey}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  config,
  onToggle,
  saving,
}: {
  label: string;
  description: string;
  config?: PlatformFeeConfig;
  onToggle: (value: boolean) => void;
  saving: boolean;
}) {
  const enabled = config?.configValue?.enabled !== false && config?.isActive !== false;
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {saving && <span className="text-xs text-gray-400">Saving...</span>}
        <button
          onClick={() => onToggle(!enabled)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            enabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              enabled ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  );
}

// ─── Plan CRUD Helper ─────────────────────────────────────────

function usePlanCrud<T extends { id: string }>(endpoint: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<T[]>(endpoint);
      setItems(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : `Failed to load from ${endpoint}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  return { items, loading, error, actionError, setActionError, load };
}

// ─── Subscription Plans Tab ───────────────────────────────────

function PlansTab() {
  const { items: plans, loading, error, actionError, setActionError, load } = usePlanCrud<SubscriptionPlan>('/admin/subscription-plans');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [benefits, setBenefits] = useState('');

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setMonthlyPrice(0);
    setBenefits('');
    setActionError('');
  }

  function openEdit(plan: SubscriptionPlan) {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description || '');
    setMonthlyPrice(plan.monthlyPrice);
    setBenefits(JSON.stringify(plan.benefits || {}, null, 2));
    setShowForm(true);
  }

  async function handleSave() {
    if (!name || monthlyPrice <= 0) {
      setActionError('Name and price are required');
      return;
    }
    setActionError('');
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || undefined,
        monthlyPrice,
        benefits: benefits ? JSON.parse(benefits) : undefined,
      };
      if (editingId) {
        await api.patch(`/admin/subscription-plans/${editingId}`, body);
      } else {
        await api.post('/admin/subscription-plans', body);
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save plan');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this subscription plan?')) return;
    try {
      await api.delete(`/admin/subscription-plans/${id}`);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete plan');
    }
  }

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading subscription plans...</div>;
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
    <div>
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{plans.length} plan(s)</p>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : 'Add Plan'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow mb-6 space-y-3">
          <input
            placeholder="Plan name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full text-sm"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full text-sm"
          />
          <NumberInput
            value={monthlyPrice}
            onChange={setMonthlyPrice}
            placeholder="Monthly price (₹)"
            className="border rounded-lg px-3 py-2 w-full text-sm"
          />
          <textarea
            placeholder='Benefits JSON (e.g. {"commissionDiscount": 20, "prioritySupport": true})'
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={3}
            className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            {editingId ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3">Benefits</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-400">No subscription plans yet.</td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t">
                <td className="p-3 font-medium">{plan.name}</td>
                <td className="p-3">₹{plan.monthlyPrice}/mo</td>
                <td className="p-3 text-xs text-gray-500 max-w-xs truncate">
                  {plan.benefits ? JSON.stringify(plan.benefits) : '-'}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => openEdit(plan)} className="text-blue-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => handleDelete(plan.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Customer Membership Plans Tab ────────────────────────────

function MembershipTab() {
  const { items: plans, loading, error, actionError, setActionError, load } = usePlanCrud<CustomerMembershipPlan>('/admin/membership-plans');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [benefits, setBenefits] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignBillingCycle, setAssignBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [assignError, setAssignError] = useState('');
  const [viewingMembership, setViewingMembership] = useState<string | null>(null);
  const [membershipData, setMembershipData] = useState<CustomerMembership | null>(null);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setMonthlyPrice(0);
    setYearlyPrice(0);
    setBenefits('');
    setActionError('');
  }

  function openEdit(plan: CustomerMembershipPlan) {
    setEditingId(plan.id);
    setName(plan.name);
    setDescription(plan.description || '');
    setMonthlyPrice(plan.monthlyPrice);
    setYearlyPrice(plan.yearlyPrice);
    setBenefits(JSON.stringify(plan.benefits || {}, null, 2));
    setShowForm(true);
  }

  async function handleSave() {
    if (!name || monthlyPrice <= 0) {
      setActionError('Name and monthly price are required');
      return;
    }
    setActionError('');
    try {
      const body: Record<string, unknown> = {
        name,
        description: description || undefined,
        monthlyPrice,
        yearlyPrice: yearlyPrice > 0 ? yearlyPrice : undefined,
        benefits: benefits ? JSON.parse(benefits) : undefined,
      };
      if (editingId) {
        await api.patch(`/admin/membership-plans/${editingId}`, body);
      } else {
        await api.post('/admin/membership-plans', body);
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save plan');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this membership plan?')) return;
    try {
      await api.delete(`/admin/membership-plans/${id}`);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete plan');
    }
  }

  async function handleAssign(planId: string) {
    if (!assignCustomerId) {
      setAssignError('Customer ID is required');
      return;
    }
    setAssignError('');
    try {
      await api.post(`/admin/membership-plans/${planId}/assign/${assignCustomerId}?billingCycle=${assignBillingCycle}`, {});
      setAssigningId(null);
      setAssignCustomerId('');
      setAssignError('Plan assigned successfully!');
      setTimeout(() => setAssignError(''), 3000);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Failed to assign plan');
    }
  }

  async function viewCustomerMembership(customerId: string) {
    if (viewingMembership === customerId) {
      setViewingMembership(null);
      setMembershipData(null);
      return;
    }
    try {
      const data = await api.get<CustomerMembership | null>(`/admin/customer-memberships/${customerId}`);
      setMembershipData(data);
      setViewingMembership(customerId);
    } catch {
      setMembershipData(null);
      setViewingMembership(customerId);
    }
  }

  async function cancelMembership(membershipId: string) {
    if (!confirm('Are you sure you want to cancel this membership?')) return;
    try {
      await api.post(`/admin/customer-memberships/${membershipId}/cancel`, {});
      setViewingMembership(null);
      setMembershipData(null);
      setAssignError('Membership cancelled successfully!');
      setTimeout(() => setAssignError(''), 3000);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Failed to cancel membership');
    }
  }

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading membership plans...</div>;
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
    <div>
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}
      {assignError && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${
          assignError.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {assignError}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{plans.length} plan(s)</p>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : 'Add Plan'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow mb-6 space-y-3">
          <input
            placeholder="Plan name (e.g. Silver, Gold)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full text-sm"
          />
          <input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full text-sm"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Monthly Price (₹)</label>
              <NumberInput
                value={monthlyPrice}
                onChange={setMonthlyPrice}
                placeholder="Monthly price"
                className="border rounded-lg px-3 py-2 w-full text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Yearly Price (₹)</label>
              <NumberInput
                value={yearlyPrice}
                onChange={setYearlyPrice}
                placeholder="Yearly price"
                className="border rounded-lg px-3 py-2 w-full text-sm"
              />
            </div>
          </div>
          <textarea
            placeholder='Benefits JSON (e.g. {"feeWaiverPercent": 100, "priorityBooking": true, "freeCancellation": true})'
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={3}
            className="border rounded-lg px-3 py-2 w-full text-sm font-mono"
          />
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            {editingId ? 'Update Plan' : 'Create Plan'}
          </button>
        </div>
      )}

      {/* Plans Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Monthly</th>
              <th className="text-left p-3">Yearly</th>
              <th className="text-left p-3">Benefits</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">No membership plans yet.</td>
              </tr>
            )}
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t">
                <td className="p-3 font-medium">{plan.name}</td>
                <td className="p-3">₹{plan.monthlyPrice}/mo</td>
                <td className="p-3">₹{plan.yearlyPrice}/yr</td>
                <td className="p-3 text-xs text-gray-500 max-w-xs truncate">
                  {plan.benefits ? JSON.stringify(plan.benefits) : '-'}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    plan.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => openEdit(plan)} className="text-blue-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => handleDelete(plan.id)} className="text-red-600 hover:underline text-xs mr-3">Delete</button>
                  <button
                    onClick={() => { setAssigningId(assigningId === plan.id ? null : plan.id); setAssignCustomerId(''); }}
                    className="text-green-600 hover:underline text-xs"
                  >
                    Assign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {assigningId && (
        <div className="bg-white p-4 rounded-xl shadow mt-4 space-y-3">
          <h3 className="text-sm font-semibold">Assign Plan to Customer</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Customer User ID</label>
              <input
                placeholder="Enter customer user ID"
                value={assignCustomerId}
                onChange={(e) => setAssignCustomerId(e.target.value)}
                className="border rounded-lg px-3 py-2 w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Billing Cycle</label>
              <select
                value={assignBillingCycle}
                onChange={(e) => setAssignBillingCycle(e.target.value as 'monthly' | 'yearly')}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <button
              onClick={() => handleAssign(assigningId)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Assign
            </button>
            <button
              onClick={() => setAssigningId(null)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
          </div>

          <div className="border-t pt-3 mt-3">
            <h4 className="text-xs font-medium text-gray-500 mb-2">Check Existing Membership</h4>
            <div className="flex gap-2 items-center">
              <input
                placeholder="Customer ID to look up"
                value={viewingMembership || ''}
                onChange={(e) => setViewingMembership(e.target.value || null)}
                className="border rounded-lg px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={() => viewCustomerMembership(viewingMembership || '')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
              >
                Look Up
              </button>
            </div>

            {membershipData && (
              <div className="mt-3 bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium">{membershipData.plan?.name || 'N/A'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Status: <span className="font-medium capitalize">{membershipData.status}</span> |
                  Billing: {membershipData.billingCycle} |
                  Since: {new Date(membershipData.startDate).toLocaleDateString()}
                </p>
                {membershipData.status === 'active' && (
                  <button
                    onClick={() => cancelMembership(membershipData.id)}
                    className="mt-2 text-xs text-red-600 hover:underline"
                  >
                    Cancel Membership
                  </button>
                )}
              </div>
            )}
            {membershipData === null && viewingMembership && (
              <p className="mt-2 text-xs text-gray-400">No active membership found for this customer.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Promo Codes Tab ──────────────────────────────────────────

function PromoTab() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState('fee_waiver');
  const [value, setValue] = useState(0);
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [viewingUsage, setViewingUsage] = useState<string | null>(null);
  const [usageHistory, setUsageHistory] = useState<PromoCodeUsage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<PromoCode[]>('/admin/promo-codes');
      setPromoCodes(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setCode('');
    setType('fee_waiver');
    setValue(0);
    setMaxUses(undefined);
    setValidFrom('');
    setValidUntil('');
    setActionError('');
  }

  function openEdit(promo: PromoCode) {
    setEditingId(promo.id);
    setCode(promo.code);
    setType(promo.type);
    setValue(promo.value);
    setMaxUses(promo.maxUses);
    setValidFrom(promo.validFrom ? promo.validFrom.split('T')[0] : '');
    setValidUntil(promo.validUntil ? promo.validUntil.split('T')[0] : '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!code || value <= 0) {
      setActionError('Code and value are required');
      return;
    }
    setActionError('');
    try {
      const body: Record<string, unknown> = {
        code: code.toUpperCase(),
        type,
        value,
        maxUses: maxUses || undefined,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
      };
      if (editingId) {
        await api.patch(`/admin/promo-codes/${editingId}`, body);
      } else {
        await api.post('/admin/promo-codes', body);
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save promo code');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this promo code?')) return;
    try {
      await api.delete(`/admin/promo-codes/${id}`);
      await load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to delete promo code');
    }
  }

  async function viewUsage(id: string) {
    if (viewingUsage === id) {
      setViewingUsage(null);
      return;
    }
    try {
      const data = await api.get<PromoCodeUsage[]>(`/admin/promo-codes/${id}/usage`);
      setUsageHistory(data);
      setViewingUsage(id);
    } catch {
      setUsageHistory([]);
      setViewingUsage(id);
    }
  }

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading promo codes...</div>;
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
    <div>
      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{promoCodes.length} promo code(s)</p>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          {showForm ? 'Cancel' : 'Add Promo Code'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow mb-6 space-y-3">
          <input
            placeholder="Code (e.g. FESTIVE50)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="border rounded-lg px-3 py-2 w-full text-sm uppercase"
          />
          <div className="flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="fee_waiver">Fee Waiver (full)</option>
              <option value="percentage">Percentage Off</option>
              <option value="fixed">Fixed Discount (₹)</option>
            </select>
            <NumberInput
              value={value}
              onChange={setValue}
              placeholder="Value"
              className="border rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div className="flex gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valid From</label>
              <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Uses</label>
              <input type="number" placeholder="Unlimited" value={maxUses || ''} onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                className="border rounded-lg px-3 py-2 text-sm w-24" />
            </div>
          </div>
          <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            {editingId ? 'Update' : 'Create'}
          </button>
        </div>
      )}

      {/* Promo Codes Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Value</th>
              <th className="text-left p-3">Uses</th>
              <th className="text-left p-3">Valid</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promoCodes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-400">No promo codes yet.</td>
              </tr>
            )}
            {promoCodes.map((promo) => (
              <tr key={promo.id} className="border-t">
                <td className="p-3 font-mono font-medium">{promo.code}</td>
                <td className="p-3 capitalize">{promo.type.replace('_', ' ')}</td>
                <td className="p-3">
                  {promo.type === 'percentage' ? `${promo.value}%` : `₹${promo.value}`}
                  {promo.type === 'fee_waiver' && <span className="text-xs text-gray-400 ml-1">(full waiver)</span>}
                </td>
                <td className="p-3">
                  <button onClick={() => viewUsage(promo.id)} className="text-blue-600 hover:underline">
                    {promo.currentUses}{promo.maxUses ? ` / ${promo.maxUses}` : ''}
                  </button>
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {promo.validFrom ? `${promo.validFrom.split('T')[0]} → ${promo.validUntil?.split('T')[0] || '∞'}` : 'No expiry'}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    promo.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {promo.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-3">
                  <button onClick={() => openEdit(promo)} className="text-blue-600 hover:underline text-xs mr-3">Edit</button>
                  <button onClick={() => handleDelete(promo.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Usage History */}
      {viewingUsage && (
        <div className="bg-white p-4 rounded-xl shadow mt-4">
          <h3 className="text-sm font-semibold mb-2">Usage History</h3>
          {usageHistory.length === 0 ? (
            <p className="text-xs text-gray-400">No usage recorded yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Discount</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {usageHistory.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-2">{u.user?.phone || 'N/A'}</td>
                    <td className="p-2">₹{u.discountAmount}</td>
                    <td className="p-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Revenue Tab ──────────────────────────────────────────────

function RevenueTab() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<RevenueStats>('/admin/revenue-stats');
      setStats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load revenue stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading revenue stats...</div>;
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
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-sm text-gray-500 mb-1">Convenience Fees</p>
          <p className="text-2xl font-bold text-green-600">₹{(stats?.totalConvenienceFees || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-sm text-gray-500 mb-1">Subscription Revenue</p>
          <p className="text-2xl font-bold text-blue-600">₹{(stats?.totalSubscriptionRevenue || 0).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">(Auto-billing coming soon)</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-sm text-gray-500 mb-1">Discounts Given</p>
          <p className="text-2xl font-bold text-orange-600">₹{(stats?.totalDiscounts || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-sm font-semibold mb-2">Net Platform Revenue</h3>
        <p className="text-3xl font-bold">
          ₹{((stats?.totalConvenienceFees || 0) + (stats?.totalSubscriptionRevenue || 0)).toLocaleString()}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Convenience fees + Subscriptions - Discounts = ₹{((stats?.totalConvenienceFees || 0) + (stats?.totalSubscriptionRevenue || 0) - (stats?.totalDiscounts || 0)).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
