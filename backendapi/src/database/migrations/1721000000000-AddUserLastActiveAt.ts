import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a `lastActiveAt` column to the `users` table to track the last time a
 * user was active (login or socket connect), regardless of which profile
 * (customer/provider) they used. Customer-facing provider lists use this to
 * show "Active Today" / "Last active X days ago".
 *
 * Safe to apply: column is nullable and added with IF NOT EXISTS.
 * Reversible via down().
 */
export class AddUserLastActiveAt1721000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "lastActiveAt"`,
    );
  }
}
