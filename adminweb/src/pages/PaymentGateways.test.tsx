import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PaymentGateways from '../pages/PaymentGateways';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

const mockGateways = [
  {
    id: 'gw-1',
    type: 'razorpay',
    displayName: 'Razorpay',
    isActive: true,
    isDefault: true,
    credentialFingerprint: 'fp_abc123',
  },
  {
    id: 'gw-2',
    type: 'stripe',
    displayName: 'Stripe',
    isActive: false,
    isDefault: false,
    credentialFingerprint: 'fp_xyz789',
  },
];

function renderGateways() {
  return render(
    <MemoryRouter>
      <PaymentGateways />
    </MemoryRouter>
  );
}

describe('PaymentGateways Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.get.mockResolvedValue(mockGateways);
  });

  it('renders the page title', async () => {
    renderGateways();

    expect(screen.getByText('Payment Gateways')).toBeInTheDocument();
    expect(screen.getByText('Add Gateway')).toBeInTheDocument();
  });

  it('displays loaded gateways', async () => {
    renderGateways();

    await waitFor(() => {
      expect(screen.getByText('Razorpay')).toBeInTheDocument();
      expect(screen.getByText('Stripe')).toBeInTheDocument();
    });
  });

  it('shows active/inactive status badges', async () => {
    renderGateways();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('shows default badge for default gateway', async () => {
    renderGateways();

    await waitFor(() => {
      expect(screen.getByText('Default')).toBeInTheDocument();
    });
  });

  it('toggles gateway active state', async () => {
    const user = userEvent.setup();
    mockApi.patch.mockResolvedValue({});
    mockApi.get.mockResolvedValue(mockGateways);

    renderGateways();

    await waitFor(() => {
      expect(screen.getByText('Stripe')).toBeInTheDocument();
    });

    const disableBtn = screen.getByText('Enable');
    await user.click(disableBtn);

    expect(mockApi.patch).toHaveBeenCalledWith('/admin/payment-gateways/gw-2', { isActive: true });
  });

  it('opens add gateway form', async () => {
    const user = userEvent.setup();
    renderGateways();

    await user.click(screen.getByText('Add Gateway'));

    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getAllByText('Razorpay').length).toBeGreaterThan(0);
  });

  it('validates JSON credentials before saving', async () => {
    const user = userEvent.setup();
    renderGateways();

    await user.click(screen.getByText('Add Gateway'));

    const credentialsField = screen.getByPlaceholderText(/key_id/);
    await user.clear(credentialsField);
    await user.type(credentialsField, 'invalid json');
    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Invalid JSON in credentials')).toBeInTheDocument();
    });

    expect(mockApi.post).not.toHaveBeenCalled();
  });
});
