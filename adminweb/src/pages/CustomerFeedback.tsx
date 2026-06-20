import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface FeedbackUser {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface FeedbackCustomer {
  id: string;
  user?: FeedbackUser;
}

interface FeedbackProvider {
  id: string;
  user?: FeedbackUser;
}

interface CustomerFeedback {
  id: string;
  rating: number;
  comment?: string;
  tags?: string[];
  createdAt: string;
  booking?: { id: string };
  customer?: FeedbackCustomer;
  provider?: FeedbackProvider;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function fullName(u?: FeedbackUser): string {
  if (!u) return 'Unknown';
  const parts = [u.firstName, u.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (u.phone || 'Unknown');
}

export default function CustomerFeedback() {
  const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<CustomerFeedback[]>('/admin/customer-feedbacks');
      setFeedbacks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Customer Feedback</h1>

      {loading && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
          Loading feedback...
        </div>
      )}

      {!loading && error && (
        <div className="bg-white p-6 rounded-xl shadow">
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
          <button
            onClick={load}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && feedbacks.length === 0 && (
        <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
          No customer feedback yet.
        </div>
      )}

      {!loading && !error && feedbacks.length > 0 && (
        <div className="grid gap-4">
          {feedbacks.map((f) => {
            const stars = Math.max(0, Math.min(5, Math.round(f.rating)));
            const providerName = fullName(f.provider?.user);
            const customerName = fullName(f.customer?.user);
            return (
              <div key={f.id} className="bg-white p-4 rounded-xl shadow">
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">
                      Provider: {providerName}
                      {f.provider?.user?.phone && (
                        <span className="text-gray-400 font-normal"> ({f.provider.user.phone})</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      Customer: {customerName}
                      {f.customer?.user?.phone && (
                        <span className="text-gray-400"> ({f.customer.user.phone})</span>
                      )}
                    </p>
                  </div>
                  <div className="text-yellow-500 shrink-0" aria-label={`Rating ${stars} of 5`}>
                    {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                  </div>
                </div>

                {f.booking?.id && (
                  <p className="text-xs text-gray-500 mb-2">
                    Booking: <span className="font-mono">{f.booking.id.slice(0, 8)}</span>
                  </p>
                )}

                {f.tags && f.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {f.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {f.comment && (
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{f.comment}</p>
                )}

                <p className="text-xs text-gray-400 mt-3">{formatDate(f.createdAt)}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}