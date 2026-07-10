import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionConfig } from './entities/commission-config.entity';
import { CommissionType } from '../common/enums/commission-type.enum';
import { SettingsService } from '../settings/settings.service';
import { PlatformFeesService } from '../platform-fees/platform-fees.service';

export interface ResolvedCommission {
  type: CommissionType;
  value: number;
  amount: number;
  source: string;
  waived?: boolean;
  waivedReason?: string;
  subscriptionDiscounted?: boolean;
}

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(CommissionConfig)
    private readonly commissionRepository: Repository<CommissionConfig>,
    private readonly settingsService: SettingsService,
    private readonly platformFeesService: PlatformFeesService,
  ) {}

  async getCommission(
    totalAmount: number,
    scope: string,
    scopeId?: string,
    options?: { fallback?: boolean },
  ): Promise<{
    type: CommissionType;
    value: number;
    amount: number;
    source: string;
    matched: boolean;
  }> {
    const where: { scope: string; isActive: boolean; scopeId?: string } = {
      scope,
      isActive: true,
    };
    if (scopeId) {
      where.scopeId = scopeId;
    }

    const config = await this.commissionRepository.findOne({ where });
    if (config) {
      const amount = this.computeAmount(config, totalAmount);
      return {
        type: config.type,
        value: config.value,
        amount,
        source: scope,
        matched: true,
      };
    }

    if (options?.fallback !== false) {
      const global = await this.commissionRepository.findOne({
        where: { scope: 'global', isActive: true },
      });
      if (global) {
        const amount = this.computeAmount(global, totalAmount);
        return {
          type: global.type,
          value: global.value,
          amount,
          source: 'global',
          matched: true,
        };
      }
    }

    return {
      type: CommissionType.PERCENTAGE,
      value: 10,
      amount: totalAmount * 0.1,
      source: 'default',
      matched: false,
    };
  }

  /** Resolve commission with correct priority: provider → category → global/default. */
  async resolveCommission(
    totalAmount: number,
    providerId?: string,
    categoryId?: string,
    options?: { providerCreatedAt?: Date; now?: Date },
  ): Promise<ResolvedCommission> {
    let base: ResolvedCommission;

    if (providerId) {
      const providerComm = await this.getCommission(
        totalAmount,
        'provider',
        providerId,
        { fallback: false },
      );
      if (providerComm.matched) {
        base = this.toResolved(providerComm);
        return this.applyAllDiscounts(base, totalAmount, providerId, options);
      }
    }
    if (categoryId) {
      const categoryComm = await this.getCommission(
        totalAmount,
        'category',
        categoryId,
        { fallback: false },
      );
      if (categoryComm.matched) {
        base = this.toResolved(categoryComm);
        return this.applyAllDiscounts(base, totalAmount, providerId, options);
      }
    }
    const global = await this.getCommission(totalAmount, 'global');
    base = this.toResolved(global);
    return this.applyAllDiscounts(base, totalAmount, providerId, options);
  }

  private async applyAllDiscounts(
    base: ResolvedCommission,
    totalAmount: number,
    providerId?: string,
    options?: { providerCreatedAt?: Date; now?: Date },
  ): Promise<ResolvedCommission> {
    let result = await this.applyGrace(base, totalAmount, options);
    if (result.waived) return result;
    if (providerId) {
      result = await this.applySubscriptionDiscount(result, providerId);
    }
    return result;
  }

  private async applySubscriptionDiscount(
    base: ResolvedCommission,
    providerId: string,
  ): Promise<ResolvedCommission> {
    try {
      const sub = await this.platformFeesService.getProviderSubscription(providerId);
      const discount = sub?.plan?.benefits?.['commissionDiscount'];
      if (!discount || Number(discount) <= 0) return base;

      if (base.type === CommissionType.PERCENTAGE) {
        const discountedValue = base.value * (1 - Number(discount) / 100);
        const discountedAmount = Number(base.amount) * (1 - Number(discount) / 100);
        return {
          ...base,
          value: discountedValue,
          amount: discountedAmount,
          subscriptionDiscounted: true,
        };
      }
    } catch {}
    return base;
  }

  private toResolved(comm: {
    type: CommissionType;
    value: number;
    amount: number;
    source: string;
    matched: boolean;
  }): ResolvedCommission {
    return {
      type: comm.type,
      value: comm.value,
      amount: comm.amount,
      source: comm.source,
    };
  }

  /**
   * If the provider is within their admin-configured grace period, waive the
   * commission entirely (amount = 0) while preserving the original rate info.
   */
  private async applyGrace(
    base: ResolvedCommission,
    totalAmount: number,
    options?: { providerCreatedAt?: Date; now?: Date },
  ): Promise<ResolvedCommission> {
    if (!options?.providerCreatedAt) return base;

    const enabled =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    if (!enabled) return base;

    const graceDays = await this.settingsService.getProviderGracePeriodDays();
    if (graceDays <= 0) return base;

    const cutoff = new Date(options.providerCreatedAt);
    cutoff.setDate(cutoff.getDate() + graceDays);
    const now = options.now ?? new Date();

    if (now <= cutoff) {
      return {
        ...base,
        amount: 0,
        waived: true,
        waivedReason: `Provider grace period (${graceDays} days)`,
      };
    }
    return base;
  }

  private computeAmount(config: CommissionConfig, totalAmount: number): number {
    if (config.type === CommissionType.PERCENTAGE) {
      return totalAmount * (config.value / 100);
    }
    if (config.type === CommissionType.FIXED) {
      return config.value;
    }
    return 0;
  }
}
