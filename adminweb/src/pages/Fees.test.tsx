import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Fees from '../pages/Fees';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter>
      <Fees />
    </MemoryRouter>
  );
}

describe('Fees Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', () => {
    renderPage();
    expect(screen.getByText('Fees & Revenue')).toBeInTheDocument();
  });

  it('renders all tab buttons', () => {
    renderPage();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
    expect(screen.getByText('Memberships')).toBeInTheDocument();
    expect(screen.getByText('Promo Codes')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
  });

  it('shows config tab content after loading', async () => {
    mockApi.get.mockResolvedValue([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Convenience Fee').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Feature Toggles')).toBeInTheDocument();
    });
  });

  it('switches to subscription plans tab', async () => {
    mockApi.get.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Convenience Fee').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByText('Subscription Plans'));

    await waitFor(() => {
      expect(screen.getByText(/plan\(s\)/)).toBeInTheDocument();
    });
  });

  it('switches to revenue tab', async () => {
    mockApi.get.mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Convenience Fee').length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByText('Revenue'));

    await waitFor(() => {
      expect(screen.getByText('Convenience Fees')).toBeInTheDocument();
      expect(screen.getByText('Subscription Revenue')).toBeInTheDocument();
      expect(screen.getByText('Discounts Given')).toBeInTheDocument();
    });
  });
});
