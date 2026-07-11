import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Settings from '../pages/Settings';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockConfig = {
  enabled: true,
  days: 7,
  commissionWaiver: true,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  );
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading', async () => {
    mockApi.get.mockResolvedValue(mockConfig);
    renderPage();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('renders grace period settings after loading', async () => {
    mockApi.get.mockResolvedValue(mockConfig);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Provider Grace Period Settings')).toBeInTheDocument();
      expect(screen.getByText('Enable Grace Period')).toBeInTheDocument();
    });
  });

  it('shows current status section', async () => {
    mockApi.get.mockResolvedValue(mockConfig);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Current Status')).toBeInTheDocument();
      expect(screen.getByText('Grace Period Status')).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Failed to load grace period settings'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load grace period settings')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('displays the save button', async () => {
    mockApi.get.mockResolvedValue(mockConfig);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Save Settings')).toBeInTheDocument();
    });
  });
});
