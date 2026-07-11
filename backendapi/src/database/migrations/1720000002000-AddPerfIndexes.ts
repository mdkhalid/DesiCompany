import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds performance indexes to the highest-traffic tables.
 *
 * TypeORM does NOT auto-index @ManyToOne relation columns, so lookups by
 * customer/provider/booking id, status, gateway and created_at were doing
 * sequential scans. These indexes target the most common filter/sort columns.
 *
 * Safe to apply: uses CREATE INDEX IF NOT EXISTS. Reversible via down().
 */
export class AddPerfIndexes1720000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // bookings
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_customer_id" ON "bookings" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_provider_id" ON "bookings" ("provider_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_status" ON "bookings" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_bookings_created_at" ON "bookings" ("created_at")`,
    );

    // payments
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_booking_id" ON "payments" ("booking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_status" ON "payments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_gateway" ON "payments" ("gateway")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_payments_created_at" ON "payments" ("created_at")`,
    );

    // messages
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_booking_id" ON "messages" ("booking_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_created_at" ON "messages" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bookings_customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bookings_provider_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bookings_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_bookings_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payments_booking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payments_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payments_gateway"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_payments_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_booking_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_created_at"`,
    );
  }
}
