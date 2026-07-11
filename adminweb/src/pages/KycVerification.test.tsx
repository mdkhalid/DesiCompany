import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KycVerification from '../pages/KycVerification';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockDocs = [
  {
    id: 'doc-1',
    provider: {
      id: 'prov-1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      user: { phone: '9876543211', email: 'ravi@test.com' },
    },
    documentType: 'aadhaar_card',
    documentUrl: 'https://example.com/aadhaar.jpg',
    status: 'pending',
    createdAt: '2026-06-15T10:00:00Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <KycVerification />
    </MemoryRouter>
  );
}

describe('KycVerification Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockDocs);
    renderPage();
    expect(screen.getByText('KYC Verification')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading KYC documents...')).toBeInTheDocument();
  });

  it('renders provider name after loading', async () => {
    mockApi.get.mockResolvedValue(mockDocs);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
    });
  });

  it('renders filter tabs with counts', async () => {
    mockApi.get.mockResolvedValue(mockDocs);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Pending/)).toBeInTheDocument();
      expect(screen.getByText(/Approved/)).toBeInTheDocument();
      expect(screen.getByText(/Rejected/)).toBeInTheDocument();
      expect(screen.getByText(/All/)).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load KYC documents'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load KYC documents')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders refresh button', async () => {
    mockApi.get.mockResolvedValue(mockDocs);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    });
  });
});
