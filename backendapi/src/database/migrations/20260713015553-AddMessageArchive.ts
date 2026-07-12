import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageArchive20260713015553 implements MigrationInterface {
  name = 'AddMessageArchive20260713015553';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "is_archived" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_is_archived" ON "messages" ("is_archived")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_direct_messages_is_archived" ON "direct_messages" ("is_archived")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_direct_messages_is_archived"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_messages_is_archived"`,
    );
    await queryRunner.query(
      `ALTER TABLE "direct_messages" DROP COLUMN IF EXISTS "is_archived"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "is_archived"`,
    );
  }
}
