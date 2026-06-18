import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Refunds from '../pages/Refunds';
import { api } from '../services/api';

vi.mock('../services/api');

const mockApi = vi.mocked(api);

function renderRefunds() {
  return render(
    <MemoryRouter>
      <Refunds />
    </MemoryRouter>
  );
}

describe('Refunds Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the refunds form', () => {
    renderRefunds();

    expect(screen.getByText('Refunds')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Payment ID')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Amount (leave empty for full refund)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reason (optional)')).toBeInTheDocument();
    expect(screen.getByText('Process Refund')).toBeInTheDocument();
  });

  it('shows error when API fails', async () => {
    const user = userEvent.setup();
    mockApi.post.mockRejectedValue(new Error('Payment not found'));

    renderRefunds();

    await user.type(screen.getByPlaceholderText('Payment ID'), 'pay_123');
    await user.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(screen.getByText('Payment not found')).toBeInTheDocument();
    });
  });

  it('shows success result on successful refund', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ amount: 500, refundId: 'ref_123' });

    renderRefunds();

    await user.type(screen.getByPlaceholderText('Payment ID'), 'pay_123');
    await user.type(screen.getByPlaceholderText('Amount (leave empty for full refund)'), '500');
    await user.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(screen.getByText(/Refund processed/)).toBeInTheDocument();
      expect(screen.getByText(/₹500/)).toBeInTheDocument();
    });
  });

  it('sends correct payload with amount and reason', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ amount: 250, refundId: 'ref_456' });

    renderRefunds();

    await user.type(screen.getByPlaceholderText('Payment ID'), 'pay_456');
    await user.type(screen.getByPlaceholderText('Amount (leave empty for full refund)'), '250');
    await user.type(screen.getByPlaceholderText('Reason (optional)'), 'Customer dissatisfied');
    await user.click(screen.getByText('Process Refund'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/admin/refunds', {
        paymentId: 'pay_456',
        amount: 250,
        reason: 'Customer dissatisfied',
      });
    });
  });
});
