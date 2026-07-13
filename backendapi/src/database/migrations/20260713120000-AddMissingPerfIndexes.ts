import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * N7.3 — Index audit on high-volume tables.
 *
 * Adds missing indexes that would otherwise cause sequential scans on
 * frequent filter/sort paths. Only indexes on columns that actually exist are
 * included (earlier draft referenced columns such as `is_read` / `entity_type`
 * that do not exist on these tables, which made the migration fail).
 */
export class AddMissingPerfIndexes20260713120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_sender_id" ON "messages" ("sender_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_created_at" ON "notifications" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_actor_id" ON "activity_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_activity_logs_action" ON "activity_logs" ("action")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_messages_sender_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_notifications_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_activity_logs_actor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_activity_logs_action"`,
    );
  }
}
