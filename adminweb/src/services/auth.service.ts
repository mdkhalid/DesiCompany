import { api } from './api';

export interface AuthUser {
  id: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyOtpResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export async function sendOtp(phone: string) {
  return api.post<{ message: string }>('/auth/otp/request', { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  const data = await api.post<VerifyOtpResponse>('/auth/login', { phone, otp });
  sessionStorage.setItem('token', data.tokens.accessToken);
  sessionStorage.setItem('refreshToken', data.tokens.refreshToken);
  sessionStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function getStoredRefreshToken(): string | null {
  return sessionStorage.getItem('refreshToken');
}

export function logout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem('user');
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!sessionStorage.getItem('token');
}
