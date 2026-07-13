import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * N7.3 — Index audit on high-volume tables.
 *
 * Adds missing indexes that would otherwise cause sequential scans on
 * frequent filter/sort paths.
 */
export class AddMissingPerfIndexes20260713120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // messages — sender_id lookups and unread counts
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_sender_id" ON "messages" ("sender_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_is_read" ON "messages" ("is_read")`,
    );

    // notifications — listing per user + unread counts
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_created_at" ON "notifications" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_is_read" ON "notifications" ("is_read")`,
    );

    // activity_logs — actor + entity lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_actor_id" ON "activity_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_action" ON "activity_logs" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_entity" ON "activity_logs" ("entity_type", "entity_id")`,
    );

    // ledger_entries — account + date lookups (composite supplement)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_provider_id" ON "ledger_entries" ("provider_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_customer_id" ON "ledger_entries" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_sender_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_is_read"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_notifications_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_notifications_is_read"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_activity_logs_actor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_activity_logs_action"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_activity_logs_entity"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ledger_entries_provider_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_ledger_entries_customer_id"`,
    );
  }
}
