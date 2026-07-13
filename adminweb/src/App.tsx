import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { ToasterProvider } from './components/Toast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Users = lazy(() => import('./pages/Users'));
const KycVerification = lazy(() => import('./pages/KycVerification'));
const Settings = lazy(() => import('./pages/Settings'));
const Categories = lazy(() => import('./pages/Categories'));
const Bookings = lazy(() => import('./pages/Bookings'));
const PaymentGateways = lazy(() => import('./pages/PaymentGateways'));
const Commissions = lazy(() => import('./pages/Commissions'));
const Fees = lazy(() => import('./pages/Fees'));
const Refunds = lazy(() => import('./pages/Refunds'));
const Reviews = lazy(() => import('./pages/Reviews'));
const CustomerFeedback = lazy(() => import('./pages/CustomerFeedback'));
const Advertisements = lazy(() => import('./pages/Advertisements'));
const Grievances = lazy(() => import('./pages/Grievances'));
const ErrorLogs = lazy(() => import('./pages/ErrorLogs'));
const Observability = lazy(() => import('./pages/Observability'));

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
      <main className="flex-1 p-6 overflow-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToasterProvider />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
          <Route path="/kyc" element={<ProtectedRoute><Layout><KycVerification /></Layout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><Layout><Bookings /></Layout></ProtectedRoute>} />
          <Route path="/gateways" element={<ProtectedRoute><Layout><PaymentGateways /></Layout></ProtectedRoute>} />
          <Route path="/fees" element={<ProtectedRoute><Layout><Fees /></Layout></ProtectedRoute>} />
          <Route path="/commissions" element={<ProtectedRoute><Layout><Commissions /></Layout></ProtectedRoute>} />
          <Route path="/refunds" element={<ProtectedRoute><Layout><Refunds /></Layout></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><Layout><Reviews /></Layout></ProtectedRoute>} />
          <Route path="/customer-feedback" element={<ProtectedRoute><Layout><CustomerFeedback /></Layout></ProtectedRoute>} />
          <Route path="/advertisements" element={<ProtectedRoute><Layout><Advertisements /></Layout></ProtectedRoute>} />
          <Route path="/grievances" element={<ProtectedRoute><Layout><Grievances /></Layout></ProtectedRoute>} />
          <Route path="/error-logs" element={<ProtectedRoute><Layout><ErrorLogs /></Layout></ProtectedRoute>} />
          <Route path="/observability" element={<ProtectedRoute><Layout><Observability /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
          <Route path="*" element={<ProtectedRoute><Layout><NotFound /></Layout></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
