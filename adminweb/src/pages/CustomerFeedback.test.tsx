import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerFeedback from '../pages/CustomerFeedback';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockFeedbacks = [
  {
    id: 'fb-1',
    rating: 4,
    comment: 'Great service!',
    tags: ['punctual', 'professional'],
    createdAt: '2026-06-15T10:00:00Z',
    booking: { id: 'bk-12345678' },
    customer: { id: 'c-1', user: { firstName: 'Amit', phone: '9876543210' } },
    provider: { id: 'p-1', user: { firstName: 'Ravi', phone: '9876543211' } },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <CustomerFeedback />
    </MemoryRouter>
  );
}

describe('CustomerFeedback Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockFeedbacks);
    renderPage();
    expect(screen.getByText('Customer Feedback')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading feedback...')).toBeInTheDocument();
  });

  it('renders feedback cards after loading', async () => {
    mockApi.get.mockResolvedValue(mockFeedbacks);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Great service!')).toBeInTheDocument();
      expect(screen.getByText(/Provider:/)).toBeInTheDocument();
      expect(screen.getByText(/Customer:/)).toBeInTheDocument();
    });
  });

  it('renders tags', async () => {
    mockApi.get.mockResolvedValue(mockFeedbacks);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('punctual')).toBeInTheDocument();
      expect(screen.getByText('professional')).toBeInTheDocument();
    });
  });

  it('shows no feedback message when list is empty', async () => {
    mockApi.get.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No customer feedback yet.')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load feedback'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load feedback')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
