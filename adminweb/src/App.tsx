import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import KycVerification from './pages/KycVerification';
import Categories from './pages/Categories';
import Bookings from './pages/Bookings';
import PaymentGateways from './pages/PaymentGateways';
import Commissions from './pages/Commissions';
import Refunds from './pages/Refunds';
import Reviews from './pages/Reviews';
import CustomerFeedback from './pages/CustomerFeedback';

function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-gray-500 mt-2">Page not found</p>
        <a href="/" className="text-blue-600 hover:underline mt-4 inline-block">Go to Dashboard</a>
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
        <Route path="/kyc" element={<ProtectedRoute><Layout><KycVerification /></Layout></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
        <Route path="/bookings" element={<ProtectedRoute><Layout><Bookings /></Layout></ProtectedRoute>} />
        <Route path="/gateways" element={<ProtectedRoute><Layout><PaymentGateways /></Layout></ProtectedRoute>} />
        <Route path="/commissions" element={<ProtectedRoute><Layout><Commissions /></Layout></ProtectedRoute>} />
        <Route path="/refunds" element={<ProtectedRoute><Layout><Refunds /></Layout></ProtectedRoute>} />
        <Route path="/reviews" element={<ProtectedRoute><Layout><Reviews /></Layout></ProtectedRoute>} />
        <Route path="/customer-feedback" element={<ProtectedRoute><Layout><CustomerFeedback /></Layout></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><Layout><NotFound /></Layout></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
