export interface User {
  id: string; phone: string; role: string; status: string;
  createdAt: string; customer?: any; provider?: any;
}
export interface Booking {
  id: string; status: string; totalAmount: number;
  scheduledDate: string; description?: string;
  customer: any; provider: any; providerService?: any;
}
export interface PaymentGateway {
  id: string; type: string; displayName: string;
  isActive: boolean; isDefault: boolean;
  credentialFingerprint: string; createdAt: string;
}
export interface Review {
  id: string; rating: number; comment?: string;
  customer: any; createdAt: string;
}
export interface DashboardMetrics {
  totalUsers: number; totalCustomers: number;
  totalProviders: number; totalBookings: number;
  totalPayments: number; activeUsers: number;
}
