import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Categories from '../pages/Categories';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockCategories = [
  {
    id: 'cat-1',
    nameEn: 'Plumbing',
    nameHi: 'प्लंबिंग',
    isActive: true,
    pricingModels: ['FIXED', 'HOURLY'],
    defaultPricingModel: 'FIXED',
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <Categories />
    </MemoryRouter>
  );
}

describe('Categories Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockCategories);
    renderPage();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('renders categories table after loading', async () => {
    mockApi.get.mockResolvedValue(mockCategories);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Plumbing')).toBeInTheDocument();
      expect(screen.getByText('प्लंबिंग')).toBeInTheDocument();
    });
  });

  it('renders add category form', async () => {
    mockApi.get.mockResolvedValue(mockCategories);
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('English name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Hindi name')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load categories'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load categories')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders pricing model checkboxes', async () => {
    mockApi.get.mockResolvedValue(mockCategories);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('FIXED')).toBeInTheDocument();
      expect(screen.getByText('HOURLY')).toBeInTheDocument();
    });
  });
});
