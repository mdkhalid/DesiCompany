import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { User } from '../types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<User[]>('/users');
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleStatus(user: User) {
    setActionError('');
    const action = user.status === 'active' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/users/${user.id}/status`, { status: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  function providerServices(user: User): string[] {
    const services = user.provider?.services ?? [];
    return services
      .map((s) => s.category?.nameEn)
      .filter((name): name is string => !!name);
  }

  function userName(user: User): string {
    const profile = user.role === 'customer' ? user.customer : user.provider;
    if (!profile) return user.phone;
    const first = profile.firstName ?? '';
    const last = profile.lastName ?? '';
    const full = `${first} ${last}`.trim();
    return full || user.phone;
  }

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>

      {actionError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{actionError}</div>
      )}

      <div className="flex gap-2 mb-4">
        {['all', 'customer', 'provider', 'admin'].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1 rounded-full text-sm ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{f}</button>
        ))}
      </div>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading users...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Phone</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Services</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Joined</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const services = user.role === 'provider' ? providerServices(user) : [];
                return (
                  <tr key={user.id} className="border-t">
                    <td className="p-3 font-medium">{userName(user)}</td>
                    <td className="p-3">{user.phone}</td>
                    <td className="p-3 capitalize">{user.role}</td>
                    <td className="p-3">
                      {user.role === 'provider' ? (
                        services.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {services.map((name) => (
                              <span key={name} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{name}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No services</span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.status}</span>
                    </td>
                    <td className="p-3 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="p-3">
                      <button onClick={() => toggleStatus(user)} className={`text-sm px-3 py-1 rounded ${user.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {user.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
