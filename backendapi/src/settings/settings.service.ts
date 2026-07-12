import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.settingRepository.findOne({ where: { key } });
    return setting?.value ?? null;
  }

  async getNumber(key: string, defaultValue: number): Promise<number> {
    const value = await this.get(key);
    return value ? parseFloat(value) : defaultValue;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const value = await this.get(key);
    if (value === null) return defaultValue;
    return value === 'true' || value === '1';
  }

  async set(
    key: string,
    value: string,
    description?: string,
  ): Promise<Setting> {
    const existing = await this.settingRepository.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      if (description) existing.description = description;
      return this.settingRepository.save(existing);
    }
    const setting = this.settingRepository.create({ key, value, description });
    return this.settingRepository.save(setting);
  }

  async getAll(): Promise<Setting[]> {
    return this.settingRepository.find({ order: { key: 'ASC' } });
  }

  async getProviderGracePeriodDays(): Promise<number> {
    return this.getNumber('provider_grace_period_days', 7);
  }

  async isProviderGracePeriodEnabled(): Promise<boolean> {
    return this.getBoolean('provider_grace_period_enabled', true);
  }

  async isProviderGraceCommissionWaiverEnabled(): Promise<boolean> {
    return this.getBoolean('provider_grace_period_commission_waiver', true);
  }

  async isRedisRequired(): Promise<boolean> {
    return this.getBoolean('platform_redis_required', false);
  }
}
