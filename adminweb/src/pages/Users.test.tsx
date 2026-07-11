import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Users from '../pages/Users';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockUsersResponse = {
  users: [
    {
      id: 'user-1',
      phone: '9876543210',
      role: 'customer',
      status: 'active',
      createdAt: '2026-01-15T00:00:00Z',
      customer: { firstName: 'Amit', lastName: 'Sharma' },
      provider: null,
    },
    {
      id: 'user-2',
      phone: '9876543211',
      role: 'provider',
      status: 'active',
      createdAt: '2026-02-20T00:00:00Z',
      customer: null,
      provider: {
        firstName: 'Ravi',
        lastName: 'Kumar',
        services: [{ category: { nameEn: 'Plumbing' } }],
      },
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  totalPages: 1,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Users />
    </MemoryRouter>
  );
}

describe('Users Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockUsersResponse);
    renderPage();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders users table after loading', async () => {
    mockApi.get.mockResolvedValue(mockUsersResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Amit Sharma')).toBeInTheDocument();
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
      expect(screen.getByText('9876543210')).toBeInTheDocument();
    });
  });

  it('renders role filter buttons', async () => {
    mockApi.get.mockResolvedValue(mockUsersResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('all')).toBeInTheDocument();
      expect(screen.getByText('customer')).toBeInTheDocument();
      expect(screen.getByText('provider')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
    });
  });

  it('shows user count', async () => {
    mockApi.get.mockResolvedValue(mockUsersResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('2 users')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load users'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load users')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders provider services', async () => {
    mockApi.get.mockResolvedValue(mockUsersResponse);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Plumbing')).toBeInTheDocument();
    });
  });
});
