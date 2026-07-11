import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ErrorLogs from '../pages/ErrorLogs';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockStats = {
  total: 25,
  last24h: 3,
  last7d: 12,
  byStatusCode: { '400': 5, '401': 2, '500': 8, '502': 1, '503': 0 },
};

const mockLogsResponse = {
  items: [
    {
      id: 'log-1',
      statusCode: 500,
      category: 'INTERNAL',
      method: 'GET',
      url: '/api/bookings',
      userId: 'user-123',
      createdAt: '2026-06-15T10:00:00Z',
      resolvedAt: null,
      message: 'Internal server error',
      traceId: 'trace-abc',
    },
  ],
  total: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ErrorLogs />
    </MemoryRouter>
  );
}

describe('ErrorLogs Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValueOnce(mockLogsResponse).mockResolvedValueOnce(mockStats);
    renderPage();
    expect(screen.getByText('Error Logs')).toBeInTheDocument();
  });

  it('renders stats cards after loading', async () => {
    mockApi.get.mockResolvedValueOnce(mockLogsResponse).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total Errors')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  it('renders error log entries', async () => {
    mockApi.get.mockResolvedValueOnce(mockLogsResponse).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('INTERNAL')).toBeInTheDocument();
      expect(screen.getByText('/api/bookings')).toBeInTheDocument();
    });
  });

  it('shows status code filter', async () => {
    mockApi.get.mockResolvedValueOnce(mockLogsResponse).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All Status Codes')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load error logs'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load error logs')).toBeInTheDocument();
    });
  });
});
