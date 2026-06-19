import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../services/auth.service';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSendOtp() {
    try {
      setError('');
      await sendOtp(phone);
      setStep('otp');
    } catch (e: any) { setError(e.message); }
  }

  async function handleVerifyOtp() {
    try {
      setError('');
      const data = await verifyOtp(phone, otp);
      if (data.user.role !== 'admin') {
        setError('Only admin can access this panel');
        return;
      }
      navigate('/');
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">DesiCompany Admin</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {step === 'phone' ? (
          <div className="space-y-4">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Phone number"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
            <button
              onClick={handleSendOtp}
              disabled={phone.length !== 10}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Send OTP
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">OTP sent to {phone}</p>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Enter OTP"
              type="tel"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={otp.length < 4}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Verify & Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}