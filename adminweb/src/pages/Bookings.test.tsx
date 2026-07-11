import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Bookings from '../pages/Bookings';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockBookingsResponse = {
  bookings: [
    {
      id: 'bk-12345678',
      status: 'completed',
      totalAmount: 500,
      scheduledDate: '2026-06-15T10:00:00Z',
      customer: { firstName: 'Rahul' },
      provider: { firstName: 'Suresh' },
    },
  ],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Bookings />
    </MemoryRouter>
  );
}

describe('Bookings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockBookingsResponse);
    renderPage();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
  });

  it('renders bookings table after loading', async () => {
    mockApi.get.mockResolvedValue(mockBookingsResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Rahul')).toBeInTheDocument();
      expect(screen.getByText('Suresh')).toBeInTheDocument();
      expect(screen.getByText('₹500.00')).toBeInTheDocument();
    });
  });

  it('renders export CSV and refresh buttons', async () => {
    mockApi.get.mockResolvedValue(mockBookingsResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    });
  });

  it('renders status filter buttons', async () => {
    mockApi.get.mockResolvedValue(mockBookingsResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load bookings'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load bookings')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
