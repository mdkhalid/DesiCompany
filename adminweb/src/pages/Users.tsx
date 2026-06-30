import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { User } from '../types';
import SearchInput from '../components/SearchInput';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { notify } from '../components/Toast';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);

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
    const action = user.status === 'active' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await api.patch(`/users/${user.id}/status`, { status: newStatus });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: newStatus } : u)));
      notify.success(`User ${action}d successfully`);
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedUsers.size === 0) return;

    const action = bulkAction === 'suspend' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${selectedUsers.size} users?`)) return;

    try {
      const newStatus = action === 'suspend' ? 'suspended' : 'active';
      await Promise.all(
        Array.from(selectedUsers).map((userId) =>
          api.patch(`/users/${userId}/status`, { status: newStatus })
        )
      );
      setUsers((prev) =>
        prev.map((u) => (selectedUsers.has(u.id) ? { ...u, status: newStatus } : u))
      );
      setSelectedUsers(new Set());
      setBulkAction(null);
      notify.success(`${selectedUsers.size} users ${action}d successfully`);
    } catch (e: unknown) {
      notify.error(e instanceof Error ? e.message : 'Failed to perform bulk action');
    }
  }

  function toggleUserSelection(userId: string) {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }

  function toggleAllUsers() {
    if (selectedUsers.size === filtered.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filtered.map((u) => u.id)));
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

  const filtered = users
    .filter((u) => filter === 'all' || u.role === filter)
    .filter((u) => {
      if (!search) return true;
      const name = userName(u).toLowerCase();
      const phone = u.phone.toLowerCase();
      const searchLower = search.toLowerCase();
      return name.includes(searchLower) || phone.includes(searchLower);
    });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="text-sm text-gray-500">
          {filtered.length} users
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or phone..."
          className="w-full md:w-80"
        />
        <div className="flex gap-2 flex-wrap">
          {['all', 'customer', 'provider', 'admin'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1 rounded-full text-sm capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="text-sm text-blue-700">
            {selectedUsers.size} users selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => { setBulkAction('suspend'); handleBulkAction(); }}
              className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
            >
              Suspend Selected
            </button>
            <button
              onClick={() => { setBulkAction('activate'); handleBulkAction(); }}
              className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
            >
              Activate Selected
            </button>
            <button
              onClick={() => setSelectedUsers(new Set())}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {loading && <TableSkeleton rows={8} cols={7} />}

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
                <th className="text-left p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filtered.length && filtered.length > 0}
                    onChange={toggleAllUsers}
                    className="rounded"
                  />
                </th>
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
                  <tr key={user.id} className={`border-t hover:bg-gray-50 ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="rounded"
                      />
                    </td>
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
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
