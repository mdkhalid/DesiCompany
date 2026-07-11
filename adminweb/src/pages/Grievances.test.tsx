import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Grievances from '../pages/Grievances';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockStats = {
  total: 15,
  open: 5,
  escalated: 2,
  resolved: 8,
  avgResolutionTime: 12,
};

const mockGrievances = [
  {
    id: 'griev-12345678',
    category: 'service_quality',
    status: 'open',
    priority: 'high',
    createdAt: '2026-06-15T10:00:00Z',
    customer: { phone: '9876543210' },
    booking: { id: 'bk-12345678', provider: { user: { phone: '9876543211' } } },
    messages: [],
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Grievances />
    </MemoryRouter>
  );
}

describe('Grievances Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValueOnce(mockGrievances).mockResolvedValueOnce(mockStats);
    renderPage();
    expect(screen.getByText('Grievances')).toBeInTheDocument();
  });

  it('renders stats cards after loading', async () => {
    mockApi.get.mockResolvedValueOnce(mockGrievances).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getAllByText('Open').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Escalated').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders grievance entries', async () => {
    mockApi.get.mockResolvedValueOnce(mockGrievances).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('9876543210')).toBeInTheDocument();
      expect(screen.getByText('Service Quality')).toBeInTheDocument();
      expect(screen.getByText('high')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load grievances'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load grievances')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders filter dropdowns', async () => {
    mockApi.get.mockResolvedValueOnce(mockGrievances).mockResolvedValueOnce(mockStats);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All Status')).toBeInTheDocument();
      expect(screen.getByText('All Priority')).toBeInTheDocument();
    });
  });
});
