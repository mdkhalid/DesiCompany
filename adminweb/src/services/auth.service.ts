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
  localStorage.setItem('token', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem('user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}
