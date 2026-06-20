import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

vi.mock('../services/auth.service', () => ({
  logout: vi.fn(),
}));

function renderSidebar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<Sidebar />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Sidebar navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const expectedLinks: { to: string; label: string }[] = [
    { to: '/', label: 'Dashboard' },
    { to: '/users', label: 'Users' },
    { to: '/kyc', label: 'KYC Verification' },
    { to: '/categories', label: 'Categories' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/gateways', label: 'Payment Gateways' },
    { to: '/fees', label: 'Fees & Revenue' },
    { to: '/commissions', label: 'Commissions' },
    { to: '/refunds', label: 'Refunds' },
    { to: '/reviews', label: 'Reviews' },
    { to: '/customer-feedback', label: 'Customer Feedback' },
  ];

  for (const link of expectedLinks) {
    it(`renders sidebar link to ${link.to}`, () => {
      renderSidebar();
      const anchor = screen.getByRole('link', { name: new RegExp(link.label, 'i') });
      expect(anchor).toHaveAttribute('href', link.to);
    });
  }

  it('renders logout button', () => {
    renderSidebar();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});
