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

  async getCommission(totalAmount: number, scope: string, scopeId?: string) {
    const where: any = { scope, isActive: true };
    if (scopeId) {
      where.scopeId = scopeId;
    }

    let config = await this.commissionRepository.findOne({ where });

    if (!config) {
      config = await this.commissionRepository.findOne({
        where: { scope: 'global', isActive: true },
      });
    }

    if (!config) {
      return { type: CommissionType.PERCENTAGE, value: 10, amount: totalAmount * 0.1 };
    }

    let amount = 0;
    if (config.type === CommissionType.PERCENTAGE) {
      amount = totalAmount * (config.value / 100);
    } else if (config.type === CommissionType.FIXED) {
      amount = config.value;
    }

    return { type: config.type, value: config.value, amount };
  }
}
