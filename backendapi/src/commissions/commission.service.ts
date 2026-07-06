import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommissionConfig } from './entities/commission-config.entity';
import { CommissionType } from '../common/enums/commission-type.enum';

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(CommissionConfig)
    private readonly commissionRepository: Repository<CommissionConfig>,
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
  ): Promise<{
    type: CommissionType;
    value: number;
    amount: number;
    source: string;
  }> {
    if (providerId) {
      const providerComm = await this.getCommission(
        totalAmount,
        'provider',
        providerId,
        {
          fallback: false,
        },
      );
      if (providerComm.matched) return providerComm;
    }
    if (categoryId) {
      const categoryComm = await this.getCommission(
        totalAmount,
        'category',
        categoryId,
        {
          fallback: false,
        },
      );
      if (categoryComm.matched) return categoryComm;
    }
    return this.getCommission(totalAmount, 'global');
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
