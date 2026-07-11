import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import { api, downloadCsv } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockMetrics = {
  totalUsers: 150,
  totalCustomers: 100,
  totalProviders: 40,
  totalBookings: 500,
  totalPayments: 450,
  activeUsers: 80,
};

const mockAnalytics = {
  overview: {
    totalBookings: 500,
    todayBookings: 10,
    weekBookings: 70,
    monthBookings: 300,
    totalUsers: 150,
    totalProviders: 40,
    totalCustomers: 100,
    totalRevenue: 250000,
    monthRevenue: 50000,
    averageRating: 4.2,
    gracePromoCost: 1200,
  },
  recentBookings: [],
  topProviders: [
    { id: 'p-1', firstName: 'Ravi', lastName: 'Kumar', averageRating: 4.8, totalReviews: 25 },
  ],
  bookingsByStatus: { completed: 400, cancelled: 50, requested: 50 },
  dailyBookingsTrend: [{ date: '2026-06-01', count: '12' }],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValueOnce(mockMetrics).mockResolvedValueOnce(mockAnalytics);
    renderPage();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders metric cards after loading', async () => {
    mockApi.get.mockResolvedValueOnce(mockMetrics).mockResolvedValueOnce(mockAnalytics);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.getByText('Providers')).toBeInTheDocument();
    });
  });

  it('renders overview section', async () => {
    mockApi.get.mockResolvedValueOnce(mockMetrics).mockResolvedValueOnce(mockAnalytics);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Month Revenue')).toBeInTheDocument();
      expect(screen.getByText("Today's Bookings")).toBeInTheDocument();
    });
  });

  it('renders top providers table', async () => {
    mockApi.get.mockResolvedValueOnce(mockMetrics).mockResolvedValueOnce(mockAnalytics);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
      expect(screen.getByText('Top Providers')).toBeInTheDocument();
    });
  });

  it('renders time range buttons', async () => {
    mockApi.get.mockResolvedValueOnce(mockMetrics).mockResolvedValueOnce(mockAnalytics);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('7 Days')).toBeInTheDocument();
      expect(screen.getByText('30 Days')).toBeInTheDocument();
      expect(screen.getByText('90 Days')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load dashboard'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
