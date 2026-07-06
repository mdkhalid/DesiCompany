import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Login from '../pages/Login';
import * as authService from '../services/auth.service';

vi.mock('../services/auth.service');

const mockAuthService = vi.mocked(authService);

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form with phone input', () => {
    renderLogin();

    expect(screen.getByText('DesiCompany Admin')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
    expect(screen.getByText('Send OTP')).toBeInTheDocument();
  });

  it('shows error when sendOtp fails', async () => {
    const user = userEvent.setup();
    mockAuthService.sendOtp.mockRejectedValue(new Error('Invalid phone'));

    renderLogin();

    await user.type(screen.getByLabelText('Phone number'), '1234567890');
    await user.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByText('Invalid phone')).toBeInTheDocument();
    });
  });

  it('calls sendOtp with valid phone', async () => {
    const user = userEvent.setup();
    mockAuthService.sendOtp.mockResolvedValue({ message: 'OTP sent' });

    renderLogin();

    await user.type(screen.getByLabelText('Phone number'), '9999999999');
    await user.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(mockAuthService.sendOtp).toHaveBeenCalledWith('9999999999');
    });
  });

  it('shows OTP input after sending OTP', async () => {
    const user = userEvent.setup();
    mockAuthService.sendOtp.mockResolvedValue({ message: 'OTP sent' });

    renderLogin();

    await user.type(screen.getByLabelText('Phone number'), '9999999999');
    await user.click(screen.getByText('Send OTP'));

    await waitFor(() => {
      expect(screen.getByLabelText('Enter OTP')).toBeInTheDocument();
      expect(screen.getByText('Verify & Login')).toBeInTheDocument();
    });
  });

  it('limits phone input to 10 digits and strips non-digits', async () => {
    const user = userEvent.setup();
    renderLogin();
    const phoneInput = screen.getByLabelText('Phone number') as HTMLInputElement;

    await user.type(phoneInput, '12345abc67890def');
    expect(phoneInput.value).toBe('1234567890');
    expect(phoneInput.value).toHaveLength(10);
  });

  it('disables Send OTP button when phone is not 10 digits', async () => {
    const user = userEvent.setup();
    renderLogin();
    const phoneInput = screen.getByLabelText('Phone number');
    const sendButton = screen.getByText('Send OTP');

    await user.type(phoneInput, '12345');
    expect(sendButton).toBeDisabled();

    await user.type(phoneInput, '67890');
    expect(sendButton).not.toBeDisabled();
  });

  it('limits OTP input to 6 digits', async () => {
    const user = userEvent.setup();
    mockAuthService.sendOtp.mockResolvedValue({ message: 'OTP sent' });
    renderLogin();

    await user.type(screen.getByLabelText('Phone number'), '9999999999');
    await user.click(screen.getByText('Send OTP'));

    await waitFor(() => screen.getByLabelText('Enter OTP'));
    const otpInput = screen.getByLabelText('Enter OTP') as HTMLInputElement;

    await user.type(otpInput, '123abc4567890');
    expect(otpInput.value).toHaveLength(6);
  });
});
