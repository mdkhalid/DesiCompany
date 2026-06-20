import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ServiceCategory } from '../services/entities/service-category.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingStatus } from '../common/enums/booking-status.enum';

export enum PricingRule {
  PEAK_HOURS = 'peak_hours',
  WEEKEND = 'weekend',
  HOLIDAY = 'holiday',
  HIGH_DEMAND = 'high_demand',
}

export interface PricingContext {
  baseAmount: number;
  categoryId?: string;
  scheduledDate: Date;
}

export interface PricingResult {
  baseAmount: number;
  finalAmount: number;
  appliedMultipliers: {
    rule: PricingRule;
    multiplier: number;
    description: string;
  }[];
}

@Injectable()
export class DynamicPricingService {
  // Multipliers (configurable via env in production)
  private readonly peakHoursMultiplier = parseFloat(
    process.env.PEAK_HOURS_MULTIPLIER || '1.2',
  );
  private readonly weekendMultiplier = parseFloat(
    process.env.WEEKEND_MULTIPLIER || '1.15',
  );
  private readonly holidayMultiplier = parseFloat(
    process.env.HOLIDAY_MULTIPLIER || '1.5',
  );
  private readonly highDemandMultiplier = parseFloat(
    process.env.HIGH_DEMAND_MULTIPLIER || '1.3',
  );
  private readonly peakHoursStart = 17; // 5 PM
  private readonly peakHoursEnd = 21; // 9 PM

  constructor(
    @InjectRepository(ServiceCategory)
    private readonly categoryRepository: Repository<ServiceCategory>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async calculatePrice(context: PricingContext): Promise<PricingResult> {
    const multipliers: PricingResult['appliedMultipliers'] = [];
    let currentAmount = context.baseAmount;

    // Peak hours check
    const hour = context.scheduledDate.getHours();
    if (hour >= this.peakHoursStart && hour < this.peakHoursEnd) {
      currentAmount *= this.peakHoursMultiplier;
      multipliers.push({
        rule: PricingRule.PEAK_HOURS,
        multiplier: this.peakHoursMultiplier,
        description: `${this.peakHoursStart}:00 - ${this.peakHoursEnd}:00 peak hours`,
      });
    }

    // Weekend check (Saturday = 6, Sunday = 0)
    const day = context.scheduledDate.getDay();
    if (day === 0 || day === 6) {
      currentAmount *= this.weekendMultiplier;
      multipliers.push({
        rule: PricingRule.WEEKEND,
        multiplier: this.weekendMultiplier,
        description: 'Weekend pricing',
      });
    }

    // Holiday check (basic India holidays)
    if (this.isHoliday(context.scheduledDate)) {
      currentAmount *= this.holidayMultiplier;
      multipliers.push({
        rule: PricingRule.HOLIDAY,
        multiplier: this.holidayMultiplier,
        description: 'Holiday pricing',
      });
    }

    // High demand check (5+ active bookings for category in same time window)
    if (context.categoryId) {
      const isHighDemand = await this.checkHighDemand(
        context.categoryId,
        context.scheduledDate,
      );
      if (isHighDemand) {
        currentAmount *= this.highDemandMultiplier;
        multipliers.push({
          rule: PricingRule.HIGH_DEMAND,
          multiplier: this.highDemandMultiplier,
          description: 'High demand detected in your area',
        });
      }
    }

    return {
      baseAmount: context.baseAmount,
      finalAmount: Number(currentAmount.toFixed(2)),
      appliedMultipliers: multipliers,
    };
  }

  private isHoliday(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const fixedHolidays: Array<[number, number]> = [
      [1, 26], // Republic Day
      [5, 1], // Labour Day
      [8, 15], // Independence Day
      [10, 2], // Gandhi Jayanti
      [11, 12], // Diwali (approximate)
      [12, 25], // Christmas
    ];

    return fixedHolidays.some(([m, d]) => m === month && d === day);
  }

  private async checkHighDemand(
    categoryId: string,
    date: Date,
  ): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.bookingRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.providerService', 'service')
      .where('service.category_id = :categoryId', { categoryId })
      .andWhere('booking.scheduledDate BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay,
      })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED],
      })
      .getCount();

    return count >= 5;
  }

  async getPricingPreview(
    baseAmount: number,
    scheduledDate: Date,
    categoryId?: string,
  ) {
    return this.calculatePrice({ baseAmount, scheduledDate, categoryId });
  }
}
