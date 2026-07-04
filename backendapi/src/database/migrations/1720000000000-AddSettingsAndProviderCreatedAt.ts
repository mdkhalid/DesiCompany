import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddSettingsAndProviderCreatedAt1720000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create settings table
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'key',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'value',
            type: 'text',
          },
          {
            name: 'description',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add default grace period settings
    await queryRunner.query(`
      INSERT INTO settings ("key", "value", "description", "created_at", "updated_at")
      VALUES 
        ('provider_grace_period_enabled', 'true', 'Enable/disable grace period for new providers before KYC verification', NOW(), NOW()),
        ('provider_grace_period_days', '7', 'Number of days grace period for new providers (default: 7)', NOW(), NOW())
    `);

    // Add provider_created_at column to providers table
    const providersTable = await queryRunner.getTable('providers');
    if (providersTable && !providersTable.findColumnByName('provider_created_at')) {
      await queryRunner.addColumn(
        'providers',
        new TableColumn({
          name: 'provider_created_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove provider_created_at column
    await queryRunner.dropColumn('providers', 'provider_created_at');

    // Drop settings table
    await queryRunner.dropTable('settings');
  }
}
