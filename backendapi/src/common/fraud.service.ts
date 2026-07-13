import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

export interface OtpAttempt {
  phone: string;
  count: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
}

@Injectable()
export class FraudService {
  private readonly logger = new Logger(FraudService.name);
  private readonly otpAttempts = new Map<string, OtpAttempt>();
  private readonly payoutCooldowns = new Map<string, number>();

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async checkOtpAbuse(phone: string): Promise<void> {
    const now = Date.now();
    const attempt = this.otpAttempts.get(phone);

    if (attempt) {
      const windowMs = 15 * 60 * 1000;
      const inWindow = now - attempt.firstAttemptAt.getTime() < windowMs;

      if (inWindow && attempt.count >= 10) {
        const waitMs =
          15 * 60 * 1000 - (now - attempt.firstAttemptAt.getTime());
        const waitMin = Math.ceil(waitMs / 60000);
        throw new Error(
          `Too many OTP attempts. Try again in ${waitMin} minutes.`,
        );
      }

      if (inWindow && attempt.lastAttemptAt.getTime() < now - 30_000) {
        attempt.count += 1;
        attempt.lastAttemptAt = new Date(now);
        this.otpAttempts.set(phone, attempt);
      }
      return;
    }

    this.otpAttempts.set(phone, {
      phone,
      count: 1,
      firstAttemptAt: new Date(now),
      lastAttemptAt: new Date(now),
    });
  }

  async checkPayoutVelocity(userId: string): Promise<void> {
    const now = Date.now();
    const lastPayoutAt = this.payoutCooldowns.get(userId);

    const dailyLimit = 3;
    const minGapMs = 60 * 60 * 1000;

    const todaysPayouts = Array.from(this.payoutCooldowns.entries()).filter(
      ([uid, at]) => uid === userId && now - at < 24 * 60 * 60 * 1000,
    ).length;

    if (todaysPayouts >= dailyLimit) {
      throw new Error('Payout limit reached. Maximum 3 payouts per day.');
    }

    if (lastPayoutAt && now - lastPayoutAt < minGapMs) {
      const waitMin = Math.ceil((minGapMs - (now - lastPayoutAt)) / 60000);
      throw new Error(
        `Please wait ${waitMin} minutes before requesting another payout.`,
      );
    }

    this.payoutCooldowns.set(userId, now);
  }

  async checkFakeBookingPatterns(
    customerId: string,
    providerId: string,
  ): Promise<void> {
    const recent = await this.userRepository
      .createQueryBuilder('u')
      .select('count(b.id)', 'cnt')
      .leftJoin('u.bookings', 'b')
      .where('u.id = :customerId', { customerId })
      .andWhere("b.created_at > now() - interval '7 days'")
      .getRawOne();

    const count = Number(recent?.cnt || 0);
    if (count > 5) {
      this.logger.warn(
        `Customer ${customerId} has ${count} bookings in 7 days with provider ${providerId}`,
      );
    }
  }
}
