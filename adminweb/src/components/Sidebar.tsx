import { NavLink } from 'react-router-dom';
import { logout } from '../services/auth.service';

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/kyc', label: 'KYC Verification', icon: '🪪' },
  { to: '/categories', label: 'Categories', icon: '📁' },
  { to: '/bookings', label: 'Bookings', icon: '📅' },
  { to: '/gateways', label: 'Payment Gateways', icon: '💳' },
  { to: '/fees', label: 'Fees & Revenue', icon: '💰' },
  { to: '/commissions', label: 'Commissions', icon: '📋' },
  { to: '/refunds', label: 'Refunds', icon: '↩️' },
  { to: '/reviews', label: 'Reviews', icon: '⭐' },
  { to: '/customer-feedback', label: 'Customer Feedback', icon: '💬' },
  { to: '/advertisements', label: 'Advertisements', icon: '📢' },
  { to: '/grievances', label: 'Grievances', icon: '🎧' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold">DesiCompany</h1>
        <p className="text-sm text-slate-400">Admin Panel</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`
            }
          >
            <span>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <button onClick={logout} className="w-full text-left text-sm text-red-400 hover:text-red-300">
          Logout
        </button>
      </div>
    </aside>
  );
}
