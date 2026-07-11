import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an idempotency marker to loyalty point awards.
 *
 * `awardPointsForBooking` is retried on transient failures (e.g. DB blips);
 * without this column a retry could double-award points. The service records
 * the last-awarded booking id and skips re-awarding the same booking.
 */
export class AddLoyaltyAwardIdempotency1720000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loyalty_points" ADD COLUMN IF NOT EXISTS "last_awarded_booking_id" varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "loyalty_points" DROP COLUMN IF EXISTS "last_awarded_booking_id"`,
    );
  }
}
