import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Commissions from '../pages/Commissions';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockCommissions = [
  {
    id: 'comm-1',
    scope: 'global',
    scopeId: '',
    type: 'percentage',
    value: 10,
    isActive: true,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Commissions />
    </MemoryRouter>
  );
}

describe('Commissions Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockCommissions);
    renderPage();
    expect(screen.getByText('Commissions')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading commissions...')).toBeInTheDocument();
  });

  it('renders commissions table after loading', async () => {
    mockApi.get.mockResolvedValue(mockCommissions);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('global')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load commissions'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load commissions')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
