export interface CustomerProfile {
  id: string;
  firstName?: string;
  lastName?: string;
}

export interface ProviderProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  services?: ProviderService[];
}

export interface ProviderService {
  id: string;
  category?: { id: string; nameEn: string; nameHi: string };
  pricingType: string;
  basePrice: number;
}

export interface User {
  id: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
  customer?: CustomerProfile;
  provider?: ProviderProfile;
}

export interface BookingCustomer {
  firstName?: string;
  lastName?: string;
  user?: { phone: string };
}

export interface BookingProvider {
  firstName?: string;
  lastName?: string;
  user?: { phone: string };
}

export interface Booking {
  id: string;
  status: string;
  totalAmount: number;
  scheduledDate: string;
  description?: string;
  customer?: BookingCustomer;
  provider?: BookingProvider;
  providerService?: ProviderService;
}

export interface PaymentGateway {
  id: string;
  type: string;
  displayName: string;
  isActive: boolean;
  isDefault: boolean;
  credentialFingerprint: string;
  createdAt: string;
}

export interface ReviewCustomer {
  firstName?: string;
  lastName?: string;
  user?: { phone: string };
}

export interface Review {
  id: string;
  rating: number;
  comment?: string;
  customer?: ReviewCustomer;
  createdAt: string;
}

export interface DashboardMetrics {
  totalUsers: number;
  totalCustomers: number;
  totalProviders: number;
  totalBookings: number;
  totalPayments: number;
  activeUsers: number;
}

export interface CommissionConfig {
  id: string;
  scope: string;
  scopeId?: string;
  type: string;
  value: number;
  isActive: boolean;
}

export interface PlatformFeeConfig {
  id: string;
  configKey: string;
  configValue: Record<string, any>;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  benefits: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  type: string;
  value: number;
  maxUses?: number;
  currentUses: number;
  validFrom?: string;
  validUntil?: string;
  isActive: boolean;
  restrictions?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCodeUsage {
  id: string;
  discountAmount: number;
  user?: { id: string; phone: string };
  booking?: { id: string };
  createdAt: string;
}

export interface RevenueStats {
  totalConvenienceFees: number;
  totalSubscriptionRevenue: number;
  totalDiscounts: number;
}

export interface CustomerMembershipPlan {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  yearlyPrice: number;
  benefits: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerMembership {
  id: string;
  customer: { id: string; phone: string };
  plan: CustomerMembershipPlan;
  status: string;
  billingCycle: 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}
