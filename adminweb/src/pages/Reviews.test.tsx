import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Reviews from '../pages/Reviews';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockReviews = [
  {
    id: 'rev-1',
    rating: 4,
    comment: 'Excellent work!',
    createdAt: '2026-06-15T10:00:00Z',
    customer: { firstName: 'Amit', user: { phone: '9876543210' } },
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Reviews />
    </MemoryRouter>
  );
}

describe('Reviews Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockReviews);
    renderPage();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
  });

  it('renders review cards after loading', async () => {
    mockApi.get.mockResolvedValue(mockReviews);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Excellent work!')).toBeInTheDocument();
      expect(screen.getByText('Amit')).toBeInTheDocument();
    });
  });

  it('displays star rating', async () => {
    mockApi.get.mockResolvedValue(mockReviews);
    renderPage();

    await waitFor(() => {
      const ratingEl = screen.getByLabelText('Rating 4 of 5');
      expect(ratingEl).toBeInTheDocument();
      expect(ratingEl.textContent).toContain('★★★★☆');
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load reviews'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
