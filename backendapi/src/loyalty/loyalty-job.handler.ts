import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JobType } from '../jobs/constants';

@Injectable()
export class LoyaltyJobHandler {
  private readonly logger = new Logger(LoyaltyJobHandler.name);

  constructor(private readonly loyaltyService: LoyaltyService) {}

  handledJobType = JobType.LOYALTY_AWARD;

  async handleJob(payload: {
    userId: string;
    bookingAmount: number;
    bookingId: string;
  }): Promise<void> {
    try {
      const result = await this.loyaltyService.awardPointsForBooking(
        payload.userId,
        payload.bookingAmount,
        payload.bookingId,
      );
      this.logger.debug(
        `Loyalty job done for booking ${payload.bookingId}: ${result.pointsEarned} pts`,
      );
    } catch (err) {
      this.logger.warn(
        `Loyalty job failed for booking ${payload.bookingId}: ${err}`,
      );
    }
  }
}
