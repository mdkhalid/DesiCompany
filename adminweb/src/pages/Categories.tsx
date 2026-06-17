import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';

interface Category { id: string; nameEn: string; nameHi: string; isActive: boolean; }

export default function Categories() {
  const [cats, setCats] = useState<Category[]>([]);
  const [nameEn, setNameEn] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => { api.get<Category[]>('/services/categories').then(setCats).catch(console.error); }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (editing) {
      await api.patch(`/services/categories/${editing}`, { nameEn, nameHi });
    } else {
      await api.post('/services/categories', { nameEn, nameHi });
    }
    setNameEn(''); setNameHi(''); setEditing(null);
    load();
  }

  function edit(cat: Category) {
    setNameEn(cat.nameEn); setNameHi(cat.nameHi); setEditing(cat.id);
  }

  async function toggleActive(cat: Category) {
    await api.patch(`/services/categories/${cat.id}`, { isActive: !cat.isActive });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="font-semibold mb-3">{editing ? 'Edit' : 'Add'} Category</h2>
        <div className="flex gap-3">
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="English name" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 flex-1" placeholder="Hindi name" value={nameHi} onChange={(e) => setNameHi(e.target.value)} />
          <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editing ? 'Update' : 'Add'}</button>
          {editing && <button onClick={() => { setNameEn(''); setNameHi(''); setEditing(null); }} className="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="text-left p-3">English</th><th className="text-left p-3">Hindi</th><th className="text-left p-3">Status</th><th className="text-left p-3">Actions</th></tr></thead>
          <tbody>
            {cats.map((cat) => (
              <tr key={cat.id} className="border-t">
                <td className="p-3">{cat.nameEn}</td>
                <td className="p-3">{cat.nameHi}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${cat.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{cat.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => edit(cat)} className="text-blue-600 hover:underline text-sm">Edit</button>
                  <button onClick={() => toggleActive(cat)} className="text-sm hover:underline">{cat.isActive ? 'Deactivate' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
