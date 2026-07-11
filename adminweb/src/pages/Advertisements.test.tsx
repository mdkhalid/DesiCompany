import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Advertisements from '../pages/Advertisements';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockStats = {
  total: 10,
  active: 3,
  scheduled: 2,
  paused: 1,
  expired: 4,
  totalImpressions: 5000,
  totalClicks: 250,
};

const mockAds = [
  {
    id: 'ad-1',
    title: 'Summer Sale',
    description: 'Big discounts',
    imageUrl: 'https://example.com/ad.jpg',
    thumbnailUrl: '',
    placement: 'home_banner' as const,
    status: 'active' as const,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    impressions: 1000,
    clicks: 50,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Advertisements />
    </MemoryRouter>
  );
}

describe('Advertisements Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValueOnce(mockAds).mockResolvedValueOnce(mockStats);
    renderPage();
    expect(screen.getByText('Advertisements')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders ads table after loading', async () => {
    mockApi.get.mockResolvedValueOnce(mockAds).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    });
  });

  it('renders stats cards', async () => {
    mockApi.get.mockResolvedValueOnce(mockAds).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Ads')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('shows error and retry button on failure', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));
    mockApi.get.mockRejectedValueOnce(new Error('Network error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders create ad button', async () => {
    mockApi.get.mockResolvedValueOnce(mockAds).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('+ Create Ad')).toBeInTheDocument();
    });
  });
});
