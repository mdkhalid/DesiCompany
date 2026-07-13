import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendOtp, verifyOtp } from '../services/auth.service';

// Optional hint shown on the login screen. Set VITE_ADMIN_PHONE_HINT in the env file.
// Leave empty to avoid exposing any real number in the deployed bundle.
const ADMIN_PHONE_HINT = import.meta.env.VITE_ADMIN_PHONE_HINT || '';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();

  async function handleSendOtp() {
    try {
      setError('');
      setInfo('');
      setSending(true);
      await sendOtp(phone);
      setInfo('OTP generated. In development mode, check the backend terminal for the OTP code (or use 123456 if OTP_MOCK=true is set).');
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP. Please check the backend server.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyOtp() {
    try {
      setError('');
      setInfo('');
      setVerifying(true);
      const data = await verifyOtp(phone, otp);
      if (data.user.role !== 'admin') {
        setError('Only admin can access this panel');
        return;
      }
      navigate('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to verify OTP. Please check the backend server.');
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">DesiCompany Admin</h1>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {info && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4 text-sm">{info}</div>}
        {step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="text-sm font-medium block mb-1">Phone number</label>
              <input
                id="phone"
                className="w-full border rounded-lg px-3 py-2"
                placeholder={ADMIN_PHONE_HINT || 'Enter registered phone number'}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
              {ADMIN_PHONE_HINT && (
                <p className="text-xs text-gray-500 mt-1">
                  Admin phone: <span className="font-mono">{ADMIN_PHONE_HINT}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleSendOtp}
              disabled={phone.length !== 10 || sending}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send OTP'}
            </button>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              <p className="font-medium mb-1">Dev Mode Info:</p>
              <p>If <code className="bg-yellow-100 px-1 rounded">OTP_MOCK=true</code> is set in backend <code className="bg-yellow-100 px-1 rounded">.env</code>, use OTP <code className="bg-yellow-100 px-1 rounded font-bold">123456</code> for any phone number.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">OTP sent to <span className="font-medium">{phone}</span></p>
            <div>
              <label htmlFor="otp" className="text-sm font-medium block mb-1">Enter OTP</label>
              <input
                id="otp"
                className="w-full border rounded-lg px-3 py-2"
                placeholder="123456"
                type="tel"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={otp.length < 4 || verifying}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {verifying ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              onClick={() => {
                setStep('phone');
                setOtp('');
                setError('');
                setInfo('');
              }}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Change phone number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
