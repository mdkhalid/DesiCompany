import { api } from './api';

export async function sendOtp(phone: string) {
  return api.post<{ message: string }>('/auth/send-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string) {
  const data = await api.post<{ accessToken: string; user: any }>('/auth/verify-otp', { phone, otp });
  localStorage.setItem('token', data.accessToken);
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
