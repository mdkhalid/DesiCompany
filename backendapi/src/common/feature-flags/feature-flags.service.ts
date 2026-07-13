import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

export interface FeatureFlags {
  convenienceFee: boolean;
  providerSubscriptions: boolean;
  promoCodes: boolean;
  instantPayout: boolean;
  leadQuoteFee: boolean;
  customerMemberships: boolean;
  circuitBreakers: boolean;
  s3FallbackToLocal: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  convenienceFee: true,
  providerSubscriptions: true,
  promoCodes: true,
  instantPayout: false,
  leadQuoteFee: false,
  customerMemberships: false,
  circuitBreakers: true,
  s3FallbackToLocal: true,
};

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly settingsService: SettingsService) {}

  async isEnabled(
    key: keyof FeatureFlags,
    defaultValue = false,
  ): Promise<boolean> {
    return this.settingsService.isFeatureEnabled(key, defaultValue);
  }

  async getAll(): Promise<FeatureFlags> {
    const entries = await Promise.all(
      (Object.keys(DEFAULT_FLAGS) as Array<keyof FeatureFlags>).map(
        async (key) => {
          const value = await this.isEnabled(key, DEFAULT_FLAGS[key]);
          return [key, value] as const;
        },
      ),
    );
    return entries.reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {} as FeatureFlags);
  }

  async set(key: keyof FeatureFlags, value: boolean): Promise<void> {
    await this.settingsService.set(`feature_${key}`, value ? 'true' : 'false');
  }
}
