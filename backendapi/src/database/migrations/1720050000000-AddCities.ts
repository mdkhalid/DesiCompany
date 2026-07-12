import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddCities1720050000000 implements MigrationInterface {
  name = 'AddCities1720050000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'cities',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          { name: 'name_en', type: 'varchar', isUnique: true },
          { name: 'name_hi', type: 'varchar' },
          { name: 'state', type: 'varchar', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'sort_order', type: 'integer', default: 0 },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    const addNullableCityId = async (table: string): Promise<void> => {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS city_id uuid`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_${table}_city_id" ON "${table}" (city_id)`,
      );
      await queryRunner.createForeignKey(
        table,
        new TableForeignKey({
          columnNames: ['city_id'],
          referencedTableName: 'cities',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          name: `FK_${table}_city`,
        }),
      );
    };

    await addNullableCityId('customers');
    await addNullableCityId('providers');
    await addNullableCityId('job_requests');
    await addNullableCityId('bookings');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dropFk = async (table: string): Promise<void> => {
      await queryRunner.dropForeignKey(table, `FK_${table}_city`);
      await queryRunner.dropColumn(table, 'city_id');
    };

    await dropFk('bookings');
    await dropFk('job_requests');
    await dropFk('providers');
    await dropFk('customers');
    await queryRunner.dropTable('cities', true);
  }
}
