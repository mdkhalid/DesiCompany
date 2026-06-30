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

export interface Advertisement {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  targetUrl?: string;
  targetScreen?: string;
  placement: AdPlacement;
  status: AdStatus;
  targetAudience: AdTargetAudience;
  startDate: string;
  endDate: string;
  priority: number;
  isActive: boolean;
  impressions: number;
  clicks: number;
  uniqueImpressions: number;
  uniqueClicks: number;
  categoryId?: string;
  maxImpressions?: number;
  maxClicks?: number;
  dailyImpressionLimit?: number;
  showCloseButton: boolean;
  autoCloseSeconds?: number;
  backgroundColor?: string;
  textColor?: string;
  createdBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type AdPlacement =
  | 'home_banner'
  | 'category_top'
  | 'search_results_top'
  | 'search_results_inline'
  | 'provider_list_top'
  | 'booking_confirmation'
  | 'notification_ad'
  | 'splash_screen'
  | 'footer_banner';

export type AdStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired';

export type AdTargetAudience = 'all' | 'customers' | 'providers' | 'new_users' | 'returning_users';

export interface AdDashboardStats {
  total: number;
  active: number;
  scheduled: number;
  paused: number;
  expired: number;
  totalImpressions: number;
  totalClicks: number;
}

export interface AdAnalytics {
  id: string;
  title: string;
  status: string;
  placement: string;
  impressions: number;
  clicks: number;
  ctr: number;
  maxImpressions?: number;
  maxClicks?: number;
  impressionProgress?: number;
  clickProgress?: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  dailyImpressionLimit?: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
  commissions: number;
}

export interface BookingTrend {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
}

export interface ProviderPerformance {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  rating: number;
  completionRate: number;
}

export interface CustomerRetention {
  date: string;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
}

export interface AnalyticsDashboard {
  revenueData: RevenueData[];
  bookingTrends: BookingTrend[];
  topProviders: ProviderPerformance[];
  customerRetention: CustomerRetention[];
  summary: {
    totalRevenue: number;
    avgBookingValue: number;
    completionRate: number;
    customerRetentionRate: number;
  };
}
