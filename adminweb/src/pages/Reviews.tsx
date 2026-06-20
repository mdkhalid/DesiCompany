import { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import type { Review } from '../types';

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Review[]>('/admin/reviews');
      setReviews(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }

  const stableLoad = useCallback(load, []);

  useEffect(() => { stableLoad(); }, [stableLoad]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reviews</h1>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">Loading reviews...</div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button onClick={load} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white p-4 rounded-xl shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{r.customer?.firstName || r.customer?.user?.phone || 'Customer'}</p>
                <div className="text-yellow-500" aria-label={`Rating ${Math.round(r.rating)} of 5`}>{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}</div>
              </div>
              {r.comment && <p className="text-gray-600 text-sm">{r.comment}</p>}
              <p className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
