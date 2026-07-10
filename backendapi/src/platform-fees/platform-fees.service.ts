import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PlatformFeeConfig } from './entities/platform-fee-config.entity';
import { ProviderSubscriptionPlan } from './entities/provider-subscription-plan.entity';
import { ProviderSubscription } from './entities/provider-subscription.entity';
import { PromoCode } from './entities/promo-code.entity';
import { PromoCodeUsage } from './entities/promo-code-usage.entity';
import { CustomerMembershipPlan } from './entities/customer-membership-plan.entity';
import { CustomerMembership } from './entities/customer-membership.entity';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { CreateMembershipPlanDto } from './dto/create-membership-plan.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { Provider } from '../users/entities/provider.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { PromoCodeType } from './enums/platform-fee.enum';

@Injectable()
export class PlatformFeesService {
  constructor(
    @InjectRepository(PlatformFeeConfig)
    private readonly feeConfigRepository: Repository<PlatformFeeConfig>,
    @InjectRepository(ProviderSubscriptionPlan)
    private readonly planRepository: Repository<ProviderSubscriptionPlan>,
    @InjectRepository(ProviderSubscription)
    private readonly subscriptionRepository: Repository<ProviderSubscription>,
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeUsage)
    private readonly promoCodeUsageRepository: Repository<PromoCodeUsage>,
    @InjectRepository(CustomerMembershipPlan)
    private readonly membershipPlanRepository: Repository<CustomerMembershipPlan>,
    @InjectRepository(CustomerMembership)
    private readonly customerMembershipRepository: Repository<CustomerMembership>,
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly activityLogsService: ActivityLogsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Fee Config ───────────────────────────────────────────────

  async getAllConfigs(): Promise<PlatformFeeConfig[]> {
    return this.feeConfigRepository.find();
  }

  async getConfig(key: string): Promise<PlatformFeeConfig | null> {
    return this.feeConfigRepository.findOne({ where: { configKey: key } });
  }

  async updateConfig(
    key: string,
    configValue?: Record<string, unknown>,
    isActive?: boolean,
    adminUserId?: string,
  ): Promise<PlatformFeeConfig> {
    const config = await this.feeConfigRepository.findOne({
      where: { configKey: key },
    });
    if (!config) {
      throw new NotFoundException(`Fee config '${key}' not found`);
    }

    if (configValue !== undefined) {
      config.configValue = configValue;
    }
    if (isActive !== undefined) {
      config.isActive = isActive;
    }

    const saved = await this.feeConfigRepository.save(config);

    if (adminUserId) {
      this.activityLogsService
        .log(adminUserId, `Updated fee config '${key}'`)
        .catch(() => {});
    }

    return saved;
  }

  isFeatureEnabled(config: PlatformFeeConfig | null): boolean {
    return config?.isActive === true && config?.configValue?.enabled !== false;
  }

  // ─── Convenience Fee Calculation ──────────────────────────────

  async getConvenienceFee(
    bookingAmount: number,
    promoCode?: string,
    userId?: string,
  ): Promise<{ baseFee: number; discount: number; finalFee: number }> {
    const featureConfig = await this.getConfig('feature_convenience_fee');
    if (!this.isFeatureEnabled(featureConfig)) {
      return { baseFee: 0, discount: 0, finalFee: 0 };
    }

    const feeConfig = await this.getConfig('convenience_fee');
    if (!feeConfig?.isActive) {
      return { baseFee: 0, discount: 0, finalFee: 0 };
    }

    const cfg = feeConfig.configValue || {};
    const type = cfg.type || 'percentage';
    const value = Number(cfg.value) || 0;
    const minAmount = Number(cfg.minAmount) || 0;
    const maxAmount = Number(cfg.maxAmount) || 0;

    let baseFee = 0;
    if (type === 'percentage') {
      baseFee = (bookingAmount * value) / 100;
    } else {
      baseFee = value;
    }

    if (minAmount > 0 && baseFee < minAmount) {
      baseFee = minAmount;
    }
    if (maxAmount > 0 && baseFee > maxAmount) {
      baseFee = maxAmount;
    }

    baseFee = Math.round(baseFee * 100) / 100;

    // Apply promo code if provided
    let discount = 0;
    if (promoCode && userId) {
      const promoResult = await this.validatePromoCode(
        promoCode,
        userId,
        bookingAmount,
      );
      if (promoResult.valid && promoResult.discount) {
        discount = promoResult.discount;
      }
    }

    const finalFee = Math.max(0, Math.round((baseFee - discount) * 100) / 100);

    return { baseFee, discount, finalFee };
  }

  /**
   * Full price breakdown for a given service amount.
   * GST is charged on the service amount + convenience fee (both are taxable
   * supplies under Indian GST), so the customer sees one consistent total.
   */
  async getPriceBreakdown(
    amount: number,
    promoCode?: string,
    userId?: string,
  ): Promise<{
    baseAmount: number;
    convenienceFee: number;
    gstRate: number;
    gstAmount: number;
    total: number;
  }> {
    const fee = await this.getConvenienceFee(amount, promoCode, userId);
    const gstRate = parseFloat(process.env.GST_RATE || '0.18');
    const taxable = amount + fee.finalFee;
    const gstAmount = Math.round(taxable * gstRate * 100) / 100;
    const total = Math.round((taxable + gstAmount) * 100) / 100;
    return {
      baseAmount: Math.round(amount * 100) / 100,
      convenienceFee: fee.finalFee,
      gstRate,
      gstAmount,
      total,
    };
  }

  // ─── Subscription Plans ──────────────────────────────────────

  async createSubscriptionPlan(
    dto: CreateSubscriptionPlanDto,
  ): Promise<ProviderSubscriptionPlan> {
    const plan = this.planRepository.create(dto);
    return this.planRepository.save(plan);
  }

  async getAllSubscriptionPlans(): Promise<ProviderSubscriptionPlan[]> {
    return this.planRepository.find({ order: { price: 'ASC' } });
  }

  async updateSubscriptionPlan(
    id: string,
    dto: Partial<CreateSubscriptionPlanDto>,
  ): Promise<ProviderSubscriptionPlan> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    Object.assign(plan, dto);
    return this.planRepository.save(plan);
  }

  async deleteSubscriptionPlan(id: string): Promise<void> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }
    await this.planRepository.remove(plan);
  }

  // ─── Provider Subscriptions ──────────────────────────────────

  async assignSubscription(
    providerId: string,
    planId: string,
    adminUserId?: string,
  ): Promise<ProviderSubscription> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    // Expire any existing active subscription
    await this.subscriptionRepository.update(
      { provider: { id: providerId }, status: 'active' },
      { status: 'expired', cancelledAt: new Date() },
    );

    const now = new Date();
    const totalDays = (plan.durationMonths * 30) + (plan.extraDays || 0);
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + totalDays);

    const subscription = this.subscriptionRepository.create({
      provider,
      plan,
      status: 'active',
      startDate: now,
      endDate,
    });

    const saved = await this.subscriptionRepository.save(subscription);

    if (adminUserId) {
      this.activityLogsService
        .log(
          adminUserId,
          `Assigned subscription plan '${plan.name}' to provider ${providerId}`,
        )
        .catch(() => {});
    }

    return saved;
  }

  async activateSubscriptionPayment(
    providerId: string,
    userId: string,
    paymentId: string,
    amount: number,
    planId: string,
  ): Promise<ProviderSubscription> {
    const byPayment = await this.subscriptionRepository.findOne({
      where: { paymentId },
    });
    if (byPayment) return byPayment;

    const existing = await this.subscriptionRepository.findOne({
      where: { provider: { id: providerId }, status: 'active' },
    });
    if (existing) return existing;

    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    return this.dataSource.transaction(async (manager) => {
      await manager.update(
        ProviderSubscription,
        { provider: { id: providerId }, status: 'active' },
        { status: 'expired', cancelledAt: new Date() },
      );

      const now = new Date();
      const totalDays = (plan.durationMonths * 30) + (plan.extraDays || 0);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + totalDays);

      const subscription = manager.create(ProviderSubscription, {
        provider,
        plan,
        status: 'active',
        startDate: now,
        endDate,
        amountPaid: amount,
        paymentId,
        featuresSnapshot: plan.benefits,
      });

      const saved = await manager.save(subscription);

      this.activityLogsService
        .log(userId, `Activated subscription '${plan.name}' via payment ${paymentId}`)
        .catch(() => {});

      return saved;
    });
  }

  async getProviderSubscription(
    providerId: string,
  ): Promise<ProviderSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { provider: { id: providerId }, status: 'active' },
      relations: { plan: true },
    });
  }

  async cancelSubscription(
    subscriptionId: string,
    adminUserId?: string,
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId },
      relations: { plan: true },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    sub.status = 'cancelled';
    sub.cancelledAt = new Date();
    await this.subscriptionRepository.save(sub);

    if (adminUserId) {
      this.activityLogsService
        .log(adminUserId, `Cancelled subscription '${sub.plan?.name}'`)
        .catch(() => {});
    }
  }

  // ─── Promo Codes ─────────────────────────────────────────────

  async createPromoCode(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const existing = await this.promoCodeRepository.findOne({
      where: { code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Promo code '${dto.code}' already exists`);
    }

    const promoCode = this.promoCodeRepository.create({
      ...dto,
      type: dto.type as PromoCodeType,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    });
    return this.promoCodeRepository.save(promoCode);
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return this.promoCodeRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async updatePromoCode(
    id: string,
    dto: Partial<CreatePromoCodeDto>,
  ): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({
      where: { id },
    });
    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }

    const updated = {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
    Object.assign(promoCode, updated);
    return this.promoCodeRepository.save(promoCode);
  }

  async deletePromoCode(id: string): Promise<void> {
    const promoCode = await this.promoCodeRepository.findOne({
      where: { id },
    });
    if (!promoCode) {
      throw new NotFoundException('Promo code not found');
    }
    await this.promoCodeRepository.remove(promoCode);
  }

  async validatePromoCode(
    code: string,
    userId: string,
    bookingAmount: number,
  ): Promise<{ valid: boolean; discount?: number; message?: string }> {
    const featureConfig = await this.getConfig('feature_promo_codes');
    if (!this.isFeatureEnabled(featureConfig)) {
      return { valid: false, message: 'Promo codes are currently disabled' };
    }

    const promoCode = await this.promoCodeRepository.findOne({
      where: { code, isActive: true },
    });
    if (!promoCode) {
      return { valid: false, message: 'Invalid promo code' };
    }

    const now = new Date();
    if (promoCode.validFrom && now < promoCode.validFrom) {
      return { valid: false, message: 'Promo code is not yet valid' };
    }
    if (promoCode.validUntil && now > promoCode.validUntil) {
      return { valid: false, message: 'Promo code has expired' };
    }

    if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
      return { valid: false, message: 'Promo code usage limit reached' };
    }

    // Calculate discount
    let discount = 0;
    if (promoCode.type === PromoCodeType.FEE_WAIVER) {
      discount = Number.MAX_SAFE_INTEGER; // full waiver, caller caps at fee amount
    } else if (promoCode.type === PromoCodeType.PERCENTAGE) {
      discount = (bookingAmount * Number(promoCode.value)) / 100;
    } else if (promoCode.type === PromoCodeType.FIXED) {
      discount = Number(promoCode.value);
    }

    // Apply restriction caps if present
    const restrictions = promoCode.restrictions || {};
    if (
      restrictions.maxDiscount &&
      discount > Number(restrictions.maxDiscount)
    ) {
      discount = Number(restrictions.maxDiscount);
    }
    const minBookingAmount = Number(restrictions.minBookingAmount);
    if (restrictions.minBookingAmount && bookingAmount < minBookingAmount) {
      return {
        valid: false,
        message: `Minimum booking amount of ₹${minBookingAmount} required`,
      };
    }

    discount = Math.round(discount * 100) / 100;

    return { valid: true, discount };
  }

  async recordPromoCodeUsage(
    promoCodeId: string,
    userId: string,
    bookingId: string,
    discountAmount: number,
  ): Promise<void> {
    // Increment usage count
    await this.promoCodeRepository.increment(
      { id: promoCodeId },
      'currentUses',
      1,
    );

    // Record usage
    const usage = this.promoCodeUsageRepository.create({
      promoCode: { id: promoCodeId } as PromoCode,
      user: { id: userId } as User,
      booking: { id: bookingId } as Booking,
      discountAmount,
    });
    await this.promoCodeUsageRepository.save(usage);
  }

  async getPromoCodeUsageHistory(
    promoCodeId: string,
  ): Promise<PromoCodeUsage[]> {
    return this.promoCodeUsageRepository.find({
      where: { promoCode: { id: promoCodeId } },
      relations: { user: true, booking: true },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Revenue Stats ───────────────────────────────────────────

  async getRevenueStats(
    startDate?: string,
    endDate?: string,
  ): Promise<{
    totalConvenienceFees: number;
    totalSubscriptionRevenue: number;
    totalDiscounts: number;
  }> {
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();

    // Convenience fees from bookings
    const bookingResult: { total: string } | undefined =
      await this.feeConfigRepository.manager
        .createQueryBuilder(Booking, 'booking')
        .select('COALESCE(SUM(booking.convenienceFee), 0)', 'total')
        .where('booking.createdAt BETWEEN :start AND :end', { start, end })
        .getRawOne();
    const totalConvenienceFees = Number(bookingResult?.total || 0);

    // Subscription revenue (we don't have payment integration for subs yet)
    const totalSubscriptionRevenue = 0;

    // Total discounts from promo code usages
    const discountResult: { total: string } | undefined =
      await this.promoCodeUsageRepository
        .createQueryBuilder('usage')
        .select('COALESCE(SUM(usage.discountAmount), 0)', 'total')
        .where('usage.createdAt BETWEEN :start AND :end', { start, end })
        .getRawOne();
    const totalDiscounts = Number(discountResult?.total || 0);

    return { totalConvenienceFees, totalSubscriptionRevenue, totalDiscounts };
  }

  // ─── Instant Payout Fee ──────────────────────────────────────

  async calculateInstantPayoutFee(payoutAmount: number): Promise<{
    baseFee: number;
    finalFee: number;
    netAmount: number;
  }> {
    const featureConfig = await this.getConfig('feature_instant_payout');
    if (!this.isFeatureEnabled(featureConfig)) {
      return { baseFee: 0, finalFee: 0, netAmount: payoutAmount };
    }

    const feeConfig = await this.getConfig('instant_payout_fee');
    if (!feeConfig?.isActive) {
      return { baseFee: 0, finalFee: 0, netAmount: payoutAmount };
    }

    const cfg = feeConfig.configValue || {};
    const type = cfg.type || 'percentage';
    const value = Number(cfg.value) || 0;
    const minAmount = Number(cfg.minAmount) || 0;
    const maxAmount = Number(cfg.maxAmount) || 0;

    let baseFee = 0;
    if (type === 'percentage') {
      baseFee = (payoutAmount * value) / 100;
    } else {
      baseFee = value;
    }

    if (minAmount > 0 && baseFee < minAmount) baseFee = minAmount;
    if (maxAmount > 0 && baseFee > maxAmount) baseFee = maxAmount;

    baseFee = Math.round(baseFee * 100) / 100;
    const netAmount = Math.round((payoutAmount - baseFee) * 100) / 100;

    return { baseFee, finalFee: baseFee, netAmount };
  }

  // ─── Lead/Quote Fee ──────────────────────────────────────────

  async calculateLeadQuoteFee(
    leadAmount: number,
    providerId?: string,
  ): Promise<{ baseFee: number; finalFee: number }> {
    const featureConfig = await this.getConfig('feature_lead_quote_fee');
    if (!this.isFeatureEnabled(featureConfig)) {
      return { baseFee: 0, finalFee: 0 };
    }

    const feeConfig = await this.getConfig('lead_quote_fee');
    if (!feeConfig?.isActive) {
      return { baseFee: 0, finalFee: 0 };
    }

    const cfg = feeConfig.configValue || {};
    const type = cfg.type || 'percentage';
    const value = Number(cfg.value) || 0;

    // Check if provider has an active subscription (free leads)
    if (providerId) {
      const sub = await this.subscriptionRepository.findOne({
        where: { provider: { id: providerId }, status: 'active' },
        relations: { plan: true },
      });
      if (sub?.plan?.benefits?.['freeLeads']) {
        const freeLeads = Number(sub.plan.benefits['freeLeads']) || 0;
        if (freeLeads > 0) {
          return { baseFee: 0, finalFee: 0 };
        }
      }
    }

    let baseFee = 0;
    if (type === 'percentage') {
      baseFee = (leadAmount * value) / 100;
    } else {
      baseFee = value;
    }

    baseFee = Math.round(baseFee * 100) / 100;
    return { baseFee, finalFee: baseFee };
  }

  // ─── Customer Membership Plans ───────────────────────────────

  async createMembershipPlan(
    dto: CreateMembershipPlanDto,
  ): Promise<CustomerMembershipPlan> {
    const plan = this.membershipPlanRepository.create(dto);
    return this.membershipPlanRepository.save(plan);
  }

  async getAllMembershipPlans(): Promise<CustomerMembershipPlan[]> {
    return this.membershipPlanRepository.find({
      order: { monthlyPrice: 'ASC' },
    });
  }

  async updateMembershipPlan(
    id: string,
    dto: Partial<CreateMembershipPlanDto>,
  ): Promise<CustomerMembershipPlan> {
    const plan = await this.membershipPlanRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    Object.assign(plan, dto);
    return this.membershipPlanRepository.save(plan);
  }

  async deleteMembershipPlan(id: string): Promise<void> {
    const plan = await this.membershipPlanRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Membership plan not found');
    await this.membershipPlanRepository.remove(plan);
  }

  async assignCustomerMembership(
    customerId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    adminUserId?: string,
  ): Promise<CustomerMembership> {
    const user = await this.userRepository.findOne({
      where: { id: customerId },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const plan = await this.membershipPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Membership plan not found');

    // Expire existing
    await this.customerMembershipRepository.update(
      { customer: { id: customerId }, status: 'active' },
      { status: 'expired', cancelledAt: new Date() },
    );

    const now = new Date();
    const endDate = new Date(now);
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const membership = this.customerMembershipRepository.create({
      customer: user,
      plan,
      status: 'active',
      startDate: now,
      endDate,
      billingCycle,
    });

    const saved = await this.customerMembershipRepository.save(membership);

    if (adminUserId) {
      this.activityLogsService
        .log(
          adminUserId,
          `Assigned membership '${plan.name}' to customer ${customerId}`,
        )
        .catch(() => {});
    }

    return saved;
  }

  async getCustomerMembership(
    customerId: string,
  ): Promise<CustomerMembership | null> {
    return this.customerMembershipRepository.findOne({
      where: { customer: { id: customerId }, status: 'active' },
      relations: { plan: true },
    });
  }

  async cancelCustomerMembership(
    membershipId: string,
    adminUserId?: string,
  ): Promise<void> {
    const membership = await this.customerMembershipRepository.findOne({
      where: { id: membershipId },
      relations: { plan: true },
    });
    if (!membership) throw new NotFoundException('Membership not found');
    membership.status = 'cancelled';
    membership.cancelledAt = new Date();
    await this.customerMembershipRepository.save(membership);

    if (adminUserId) {
      this.activityLogsService
        .log(adminUserId, `Cancelled membership '${membership.plan?.name}'`)
        .catch(() => {});
    }
  }

  async activateMembershipPayment(
    customerId: string,
    userId: string,
    paymentId: string,
    amount: number,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
  ): Promise<CustomerMembership> {
    const byPayment = await this.customerMembershipRepository.findOne({
      where: { paymentId },
    });
    if (byPayment) return byPayment;

    const existing = await this.customerMembershipRepository.findOne({
      where: { customer: { id: customerId }, status: 'active' },
    });
    if (existing) return existing;

    const user = await this.userRepository.findOne({
      where: { id: customerId },
    });
    if (!user) throw new NotFoundException('Customer not found');

    const plan = await this.membershipPlanRepository.findOne({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Membership plan not found');

    return this.dataSource.transaction(async (manager) => {
      await manager.update(
        CustomerMembership,
        { customer: { id: customerId }, status: 'active' },
        { status: 'expired', cancelledAt: new Date() },
      );

      const now = new Date();
      const endDate = new Date(now);
      if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const membership = manager.create(CustomerMembership, {
        customer: user,
        plan,
        status: 'active',
        startDate: now,
        endDate,
        billingCycle,
        amountPaid: amount,
        paymentId,
      });

      const saved = await manager.save(membership);

      this.activityLogsService
        .log(userId, `Activated membership '${plan.name}' via payment ${paymentId}`)
        .catch(() => {});

      return saved;
    });
  }

  // ─── Convenience Fee Waiver via Membership ───────────────────

  async getCustomerFeeWaiver(customerId: string): Promise<{
    hasWaiver: boolean;
    waiverPercent: number;
  }> {
    const membership = await this.getCustomerMembership(customerId);
    if (!membership?.plan?.benefits) {
      return { hasWaiver: false, waiverPercent: 0 };
    }
    const waiverPercent =
      Number(membership.plan.benefits['feeWaiverPercent']) || 0;
    return { hasWaiver: waiverPercent > 0, waiverPercent };
  }
}
