import { useState } from 'react';
import { api } from '../services/api';

interface RefundResult {
  refundId: string;
  amount: number;
  status: string;
}

export default function Refunds() {
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<RefundResult | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function processRefund() {
    if (!paymentId.trim()) {
      setError('Payment ID is required');
      return;
    }
    if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      setError('Amount must be a positive number');
      return;
    }

    try {
      setError(''); setResult(null); setSubmitting(true);
      const body: { paymentId: string; amount?: number; reason?: string } = { paymentId: paymentId.trim() };
      if (amount) body.amount = parseFloat(amount);
      if (reason.trim()) body.reason = reason.trim();
      const data = await api.post<RefundResult>('/admin/refunds', body);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to process refund');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Refunds</h1>
      <div className="bg-white p-6 rounded-xl shadow max-w-lg">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {result && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">Refund processed: ₹{result.amount} (ID: {result.refundId})</div>}
        <div className="space-y-3">
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Payment ID" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Amount (leave empty for full refund)" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={processRefund} disabled={submitting || !paymentId.trim()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? 'Processing...' : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}
