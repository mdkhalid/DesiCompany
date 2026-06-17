import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Review } from '../types';

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    api.get<Review[]>('/admin/reviews').then(setReviews).catch(() => {
      api.get<Review[]>('/reviews').then(setReviews).catch(console.error);
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reviews</h1>
      <div className="grid gap-4">
        {reviews.map((r) => (
          <div key={r.id} className="bg-white p-4 rounded-xl shadow">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium">{r.customer?.firstName || r.customer?.user?.phone || 'Customer'}</p>
              <div className="text-yellow-500">{'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}</div>
            </div>
            {r.comment && <p className="text-gray-600 text-sm">{r.comment}</p>}
            <p className="text-xs text-gray-400 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
