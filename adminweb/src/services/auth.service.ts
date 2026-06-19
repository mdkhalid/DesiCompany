import { api } from './api';

export async function sendOtp(phone: string) {
  return api.post<{ message: string }>('/auth/otp/request', { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  const data = await api.post<{ user: any; tokens: { accessToken: string; refreshToken: string } }>('/auth/login', { phone, otp });
  localStorage.setItem('token', data.tokens.accessToken);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function getStoredUser(): any {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}