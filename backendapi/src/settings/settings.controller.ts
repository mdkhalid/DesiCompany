import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all settings' })
  getAll() {
    return this.settingsService.getAll();
  }

  @Get('provider-grace-period')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get provider grace period settings' })
  async getProviderGracePeriod() {
    const enabled = await this.settingsService.isProviderGracePeriodEnabled();
    const days = await this.settingsService.getProviderGracePeriodDays();
    const commissionWaiver =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    return { enabled, days, commissionWaiver };
  }

  @Get('platform')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get platform-wide operational flags' })
  async getPlatform() {
    const redisRequired = await this.settingsService.isRedisRequired();
    return {
      redisRequired,
      redisEnv: process.env.REDIS_REQUIRED || 'false',
    };
  }

  @Post('provider-grace-period')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Configure provider grace period' })
  async setProviderGracePeriod(
    @Body('enabled') enabled: boolean,
    @Body('days') days: number,
    @Body('commissionWaiver') commissionWaiver?: boolean,
  ) {
    await this.settingsService.set(
      'provider_grace_period_enabled',
      enabled.toString(),
      'Enable/disable grace period for new providers before KYC verification',
    );
    await this.settingsService.set(
      'provider_grace_period_days',
      days.toString(),
      'Number of days grace period for new providers (default: 7)',
    );
    if (commissionWaiver !== undefined) {
      await this.settingsService.set(
        'provider_grace_period_commission_waiver',
        commissionWaiver.toString(),
        'Waive platform commission for providers within their grace period',
      );
    }
    const currentWaiver =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    return {
      enabled,
      days,
      commissionWaiver: commissionWaiver ?? currentWaiver,
    };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a setting' })
  updateSetting(
    @Body('key') key: string,
    @Body('value') value: string,
    @Body('description') description?: string,
  ) {
    return this.settingsService.set(key, value, description);
  }
}
