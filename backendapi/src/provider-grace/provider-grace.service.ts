import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Provider } from '../users/entities/provider.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { SettingsService } from '../settings/settings.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface ProviderGraceStatus {
  commissionWaiverEnabled: boolean;
  visibilityEnabled: boolean;
  days: number;
  providerCreatedAt: Date;
  graceEndsAt: Date;
  daysLeft: number;
  commissionWaivedActive: boolean;
  visibilityActive: boolean;
}

@Injectable()
export class ProviderGraceService {
  private readonly logger = new Logger(ProviderGraceService.name);

  constructor(
    @InjectRepository(Provider)
    private readonly providerRepository: Repository<Provider>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly settingsService: SettingsService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getGraceStatus(userId: string): Promise<ProviderGraceStatus> {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    return this.computeStatus(provider);
  }

  private async computeStatus(
    provider: Provider,
  ): Promise<ProviderGraceStatus> {
    const commissionWaiverEnabled =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    const visibilityEnabled =
      await this.settingsService.isProviderGracePeriodEnabled();
    const days = await this.settingsService.getProviderGracePeriodDays();

    const createdAt = provider.providerCreatedAt;
    const graceEndsAt = new Date(createdAt);
    graceEndsAt.setDate(graceEndsAt.getDate() + days);

    const now = new Date();
    const msLeft = graceEndsAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    return {
      commissionWaiverEnabled,
      visibilityEnabled,
      days,
      providerCreatedAt: createdAt,
      graceEndsAt,
      daysLeft,
      commissionWaivedActive: commissionWaiverEnabled && now <= graceEndsAt,
      visibilityActive: visibilityEnabled && now <= graceEndsAt,
    };
  }

  async getCommissionSaved(
    userId: string,
  ): Promise<{ commissionSaved: number }> {
    const provider = await this.providerRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) {
      throw new NotFoundException('Provider not found');
    }
    const result: Record<string, unknown> | undefined =
      await this.bookingRepository
        .createQueryBuilder('booking')
        .select('COALESCE(SUM(booking.commissionAmount), 0)', 'total')
        .where('booking.provider_id = :providerId', { providerId: provider.id })
        .andWhere('booking.commission_waived = :waived', { waived: true })
        .getRawOne();
    return { commissionSaved: Number(result?.total ?? 0) };
  }

  /** Sent right after a provider registers (if commission waiver is on). */
  async sendWelcome(providerUserId: string) {
    const enabled =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    if (!enabled) return;
    const days = await this.settingsService.getProviderGracePeriodDays();
    const title = `Welcome! 0% commission for your first ${days} days`;
    const body =
      'Start accepting jobs now and keep 100% of your earnings during your grace period.';

    await this.notificationsService
      .create(
        providerUserId,
        title,
        body,
        'provider_grace_welcome',
        { type: 'provider_grace_welcome', days },
        UserRole.PROVIDER,
      )
      .catch(() => {});

    this.pushNotificationsService
      .sendToUser(providerUserId, title, body, {
        type: 'provider_grace_welcome',
        days: days.toString(),
      })
      .catch(() => {});
  }

  /** Daily: remind providers whose grace period ends in ~2 days. */
  @Cron('0 9 * * *')
  async sendExpiryReminders() {
    const enabled =
      await this.settingsService.isProviderGraceCommissionWaiverEnabled();
    const days = await this.settingsService.getProviderGracePeriodDays();
    if (!enabled || days <= 2) return;

    // Providers whose graceEndsAt falls within the day that is (now + 2 days).
    const dayStart = new Date();
    dayStart.setDate(dayStart.getDate() + 2);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const createdFrom = new Date(dayStart);
    createdFrom.setDate(createdFrom.getDate() - days);
    const createdTo = new Date(dayEnd);
    createdTo.setDate(createdTo.getDate() - days);

    const providers = await this.providerRepository
      .createQueryBuilder('provider')
      .leftJoinAndSelect('provider.user', 'user')
      .where('provider.provider_created_at >= :from', { from: createdFrom })
      .andWhere('provider.provider_created_at < :to', { to: createdTo })
      .getMany();

    for (const provider of providers) {
      const title = 'Your 0% commission grace period ends soon';
      const body = `Only 2 days left of 0% commission. Make the most of it before standard fees apply!`;
      const userId = provider.user?.id;
      if (!userId) continue;
      await this.notificationsService
        .create(
          userId,
          title,
          body,
          'provider_grace_expiry',
          { type: 'provider_grace_expiry' },
          UserRole.PROVIDER,
        )
        .catch(() => {});
      this.pushNotificationsService
        .sendToUser(userId, title, body, { type: 'provider_grace_expiry' })
        .catch(() => {});
    }

    this.logger.log(
      `Sent grace-expiry reminders to ${providers.length} providers`,
    );
  }
}
