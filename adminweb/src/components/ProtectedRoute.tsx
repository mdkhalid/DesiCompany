import { Navigate } from 'react-router-dom';
import { isAuthenticated, getStoredUser } from '../services/auth.service';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getStoredUser();
  if (user?.role !== 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
}
