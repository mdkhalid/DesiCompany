import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

const PRICING_OPTIONS = ['FIXED', 'HOURLY', 'DAILY', 'PER_UNIT', 'QUOTE_BASED'] as const;

interface Category { id: string; nameEn: string; nameHi: string; isActive: boolean; pricingModels: string[]; defaultPricingModel?: string; }

export default function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [pricingModels, setPricingModels] = useState<string[]>([]);
  const [defaultPricingModel, setDefaultPricingModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Category[]>('/services/categories');
      setCats(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }

  const stableLoad = useCallback(load, []);

  useEffect(() => { stableLoad(); }, [stableLoad]);

  function togglePricingModel(model: string) {
    setPricingModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model],
    );
    if (defaultPricingModel === model && pricingModels.includes(model)) {
      setDefaultPricingModel('');
    }
  }

  async function save() {
    setActionError('');
    if (!nameEn.trim() || !nameHi.trim()) {
      setActionError('Both English and Hindi names are required');
      return;
    }
    if (pricingModels.length === 0) {
      setActionError('At least one pricing model must be selected');
      return;
    }
    try {
      const body: Record<string, unknown> = { nameEn: nameEn.trim(), nameHi: nameHi.trim(), pricingModels };
      if (defaultPricingModel) body.defaultPricingModel = defaultPricingModel;
      if (editing) {
        await api.patch(`/services/categories/${editing}`, body);
      } else {
        await api.post('/services/categories', body);
      }
      resetForm();
      load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to save category');
    }
  }

  function resetForm() {
    setNameEn(''); setNameHi(''); setEditing(null);
    setPricingModels([]); setDefaultPricingModel(''); setActionError('');
  }

  function edit(cat: Category) {
    setNameEn(cat.nameEn); setNameHi(cat.nameHi);
    setPricingModels(cat.pricingModels || []);
    setDefaultPricingModel(cat.defaultPricingModel || '');
    setEditing(cat.id);
  }

  async function toggleActive(cat: Category) {
    setActionError('');
    try {
      await api.patch(`/services/categories/${cat.id}`, { isActive: !cat.isActive });
      load();
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  const modelColors: Record<string, string> = {
    FIXED: 'bg-blue-100 text-blue-700',
    HOURLY: 'bg-purple-100 text-purple-700',
    DAILY: 'bg-orange-100 text-orange-700',
    PER_UNIT: 'bg-teal-100 text-teal-700',
    QUOTE_BASED: 'bg-pink-100 text-pink-700',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}

      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-semibold mb-3">{editing ? 'Edit' : 'Add'} Category</h2>
        <div className="flex gap-3 mb-4">
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="English name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="Hindi name" value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium block mb-2">Pricing Models</label>
          <div className="flex flex-wrap gap-2">
            {PRICING_OPTIONS.map((model) => (
              <label key={model} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={pricingModels.includes(model)}
                  onChange={() => togglePricingModel(model)}
                />
                {model.replace('_', ' ')}
              </label>
            ))}
          </div>
        </div>
        {pricingModels.length > 1 && (
          <div className="mb-4">
            <label className="text-sm font-medium block mb-2">Default Pricing Model</label>
            <select
              className="border rounded-lg px-3 py-2"
              value={defaultPricingModel}
              onChange={(e) => setDefaultPricingModel(e.target.value)}
            >
              <option value="">None</option>
              {pricingModels.map((m) => (
                <option key={m} value={m}>{m.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={save} disabled={!nameEn.trim() || !nameHi.trim() || pricingModels.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{editing ? 'Update' : 'Add'}</button>
          {editing && <button onClick={resetForm} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>}
        </div>
      </div>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading categories...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="text-left p-3">English</th><th className="text-left p-3">Hindi</th><th className="text-left p-3">Status</th><th className="text-left p-3">Pricing Models</th><th className="text-left p-3">Actions</th></tr></thead>
            <tbody>
              {cats.map((cat) => (
                <tr key={cat.id} className="border-t">
                  <td className="p-3">{cat.nameEn}</td>
                  <td className="p-3">{cat.nameHi}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cat.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(cat.pricingModels || []).map((m) => (
                        <span key={m} className={`px-2 py-0.5 rounded-full text-xs font-medium ${modelColors[m] || 'bg-gray-100'}`}>
                          {m.replace('_', ' ')}{cat.defaultPricingModel === m ? ' ★' : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => edit(cat)} className="text-blue-600 hover:underline text-sm">Edit</button>
                    <button onClick={() => toggleActive(cat)} className="text-sm hover:underline">{cat.isActive ? 'Deactivate' : 'Activate'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
