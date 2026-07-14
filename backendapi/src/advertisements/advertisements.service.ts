import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Advertisement,
  AdPlacement,
  AdStatus,
  AdTargetAudience,
} from './entities/advertisement.entity';

@Injectable()
export class AdvertisementsService {
  constructor(
    @InjectRepository(Advertisement)
    private readonly adRepository: Repository<Advertisement>,
  ) {}

  async createAd(
    adminId: string,
    data: {
      title: string;
      description?: string;
      imageUrl: string;
      thumbnailUrl?: string;
      targetUrl?: string;
      targetScreen?: string;
      placement: AdPlacement;
      targetAudience?: AdTargetAudience;
      startDate: Date;
      endDate: Date;
      priority?: number;
      categoryId?: string;
      maxImpressions?: number;
      maxClicks?: number;
      dailyImpressionLimit?: number;
      showCloseButton?: boolean;
      autoCloseSeconds?: number;
      backgroundColor?: string;
      textColor?: string;
      notes?: string;
    },
  ): Promise<Advertisement> {
    if (data.startDate >= data.endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const now = new Date();
    const initialStatus =
      data.startDate > now ? AdStatus.SCHEDULED : AdStatus.ACTIVE;

    const ad = this.adRepository.create({
      ...data,
      status: initialStatus,
      createdBy: adminId,
      isActive: true,
    });

    return this.adRepository.save(ad);
  }

  async updateAd(
    adId: string,
    data: Partial<{
      title: string;
      description: string;
      imageUrl: string;
      thumbnailUrl: string;
      targetUrl: string;
      targetScreen: string;
      placement: AdPlacement;
      targetAudience: AdTargetAudience;
      startDate: Date;
      endDate: Date;
      priority: number;
      categoryId: string;
      maxImpressions: number;
      maxClicks: number;
      dailyImpressionLimit: number;
      showCloseButton: boolean;
      autoCloseSeconds: number;
      backgroundColor: string;
      textColor: string;
      notes: string;
      status: AdStatus;
      isActive: boolean;
    }>,
  ): Promise<Advertisement> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    Object.assign(ad, data);

    // Auto-update status based on dates
    if (data.startDate || data.endDate) {
      const now = new Date();
      if (ad.startDate > now) {
        ad.status = AdStatus.SCHEDULED;
      } else if (ad.endDate < now) {
        ad.status = AdStatus.EXPIRED;
      }
    }

    return this.adRepository.save(ad);
  }

  async deleteAd(adId: string): Promise<{ success: boolean; message: string }> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    await this.adRepository.remove(ad);
    return { success: true, message: 'Advertisement deleted' };
  }

  async getAdById(adId: string): Promise<Advertisement> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');
    return ad;
  }

  async getAllAds(filters?: {
    status?: AdStatus;
    placement?: AdPlacement;
    isActive?: boolean;
  }): Promise<Advertisement[]> {
    const where: Record<string, unknown> = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.placement) where.placement = filters.placement;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.adRepository.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async getActiveAdsForPlacement(
    placement: AdPlacement,
    categoryId?: string,
  ): Promise<Advertisement[]> {
    const now = new Date();

    const query = this.adRepository
      .createQueryBuilder('ad')
      .where('ad.placement = :placement', { placement })
      .andWhere('ad.status = :status', { status: AdStatus.ACTIVE })
      .andWhere('ad.is_active = :isActive', { isActive: true })
      .andWhere('ad.start_date <= :now', { now })
      .andWhere('ad.end_date >= :now', { now });

    if (categoryId) {
      query.andWhere(
        '(ad.category_id IS NULL OR ad.category_id = :categoryId)',
        { categoryId },
      );
    }

    // Check impression/click limits
    query.andWhere(
      '(ad.max_impressions IS NULL OR ad.impressions < ad.max_impressions)',
    );
    query.andWhere('(ad.max_clicks IS NULL OR ad.clicks < ad.max_clicks)');

    query.orderBy('ad.priority', 'DESC').addOrderBy('ad.created_at', 'DESC');

    return query.getMany();
  }

  async pauseAd(adId: string): Promise<Advertisement> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    ad.status = AdStatus.PAUSED;
    return this.adRepository.save(ad);
  }

  async resumeAd(adId: string): Promise<Advertisement> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    const now = new Date();
    if (ad.endDate < now) {
      throw new BadRequestException('Cannot resume expired advertisement');
    }

    ad.status = now >= ad.startDate ? AdStatus.ACTIVE : AdStatus.SCHEDULED;
    return this.adRepository.save(ad);
  }

  async recordImpression(adId: string, _userId?: string): Promise<void> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) return;

    ad.impressions += 1;

    // Check limits
    if (ad.maxImpressions && ad.impressions >= ad.maxImpressions) {
      ad.status = AdStatus.EXPIRED;
    }

    await this.adRepository.save(ad);
  }

  async recordClick(adId: string, _userId?: string): Promise<void> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) return;

    ad.clicks += 1;

    // Check limits
    if (ad.maxClicks && ad.clicks >= ad.maxClicks) {
      ad.status = AdStatus.EXPIRED;
    }

    await this.adRepository.save(ad);
  }

  async getAdAnalytics(adId: string): Promise<Record<string, unknown>> {
    const ad = await this.adRepository.findOne({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Advertisement not found');

    const now = new Date();
    const totalDays = Math.ceil(
      (ad.endDate.getTime() - ad.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const elapsedDays = Math.ceil(
      (now.getTime() - ad.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    return {
      id: ad.id,
      title: ad.title,
      status: ad.status,
      placement: ad.placement,
      impressions: ad.impressions,
      clicks: ad.clicks,
      ctr:
        ad.impressions > 0
          ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
          : 0,
      maxImpressions: ad.maxImpressions,
      maxClicks: ad.maxClicks,
      impressionProgress: ad.maxImpressions
        ? ((ad.impressions / ad.maxImpressions) * 100).toFixed(2)
        : null,
      clickProgress: ad.maxClicks
        ? ((ad.clicks / ad.maxClicks) * 100).toFixed(2)
        : null,
      startDate: ad.startDate,
      endDate: ad.endDate,
      totalDays,
      elapsedDays,
      remainingDays,
      dailyImpressionLimit: ad.dailyImpressionLimit,
    };
  }

  async getDashboardStats(): Promise<Record<string, unknown>> {
    const [total, active, scheduled, paused, expired] = await Promise.all([
      this.adRepository.count(),
      this.adRepository.count({ where: { status: AdStatus.ACTIVE } }),
      this.adRepository.count({ where: { status: AdStatus.SCHEDULED } }),
      this.adRepository.count({ where: { status: AdStatus.PAUSED } }),
      this.adRepository.count({ where: { status: AdStatus.EXPIRED } }),
    ]);

    const totalImpressions: { sum: string } | undefined =
      await this.adRepository
        .createQueryBuilder('ad')
        .select('SUM(ad.impressions)', 'sum')
        .getRawOne();

    const totalClicks: { sum: string } | undefined = await this.adRepository
      .createQueryBuilder('ad')
      .select('SUM(ad.clicks)', 'sum')
      .getRawOne();

    return {
      total,
      active,
      scheduled,
      paused,
      expired,
      totalImpressions: parseInt(totalImpressions?.sum || '0'),
      totalClicks: parseInt(totalClicks?.sum || '0'),
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledAds(): Promise<void> {
    const now = new Date();

    // Activate scheduled ads that should start now
    await this.adRepository
      .createQueryBuilder()
      .update()
      .set({ status: AdStatus.ACTIVE })
      .where('status = :status', { status: AdStatus.SCHEDULED })
      .andWhere('start_date <= :now', { now })
      .execute();

    // Expire active ads that have ended
    await this.adRepository
      .createQueryBuilder()
      .update()
      .set({ status: AdStatus.EXPIRED })
      .where('status = :status', { status: AdStatus.ACTIVE })
      .andWhere('end_date < :now', { now })
      .execute();
  }
}
