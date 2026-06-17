import { useState } from 'react';
import { api } from '../services/api';

export default function Refunds() {
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  async function processRefund() {
    try {
      setError(''); setResult(null);
      const body: any = { paymentId };
      if (amount) body.amount = parseFloat(amount);
      if (reason) body.reason = reason;
      const data = await api.post('/admin/refunds', body);
      setResult(data);
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Refunds</h1>
      <div className="bg-white p-6 rounded-xl shadow max-w-lg">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {result && <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm">Refund processed: ₹{result.amount} (ID: {result.refundId})</div>}
        <div className="space-y-3">
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Payment ID" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Amount (leave empty for full refund)" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button onClick={processRefund} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Process Refund</button>
        </div>
      </div>
    </div>
  );
}
