import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSubscriptionPaymentColumns1720030000000 implements MigrationInterface {
  name = 'AddSubscriptionPaymentColumns1720030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. provider_subscription_plans — rename monthly_price → price, add durationMonths, extraDays
    await queryRunner.renameColumn(
      'provider_subscription_plans',
      'monthly_price',
      'price',
    );
    await queryRunner.addColumns('provider_subscription_plans', [
      new TableColumn({
        name: 'duration_months',
        type: 'integer',
        default: 1,
      }),
      new TableColumn({
        name: 'extra_days',
        type: 'integer',
        default: 0,
      }),
    ]);

    // 2. provider_subscriptions — add payment & lifecycle columns
    await queryRunner.addColumns('provider_subscriptions', [
      new TableColumn({
        name: 'amount_paid',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'payment_id',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'auto_renew',
        type: 'boolean',
        default: true,
      }),
      new TableColumn({
        name: 'features_snapshot',
        type: 'jsonb',
        isNullable: true,
      }),
    ]);

    // 3. customer_memberships — add payment & lifecycle columns
    await queryRunner.addColumns('customer_memberships', [
      new TableColumn({
        name: 'amount_paid',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
      new TableColumn({
        name: 'payment_id',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'auto_renew',
        type: 'boolean',
        default: true,
      }),
    ]);

    // 4. payments — make booking_id nullable, add purposeType, purposeId, metadata
    const paymentsTable = await queryRunner.getTable('payments');
    if (paymentsTable) {
      const bookingFk = paymentsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('booking_id') !== -1,
      );
      if (bookingFk) {
        await queryRunner.dropForeignKey('payments', bookingFk);
      }
      const bookingIndex = paymentsTable.indices.find(
        (idx) => idx.columnNames.indexOf('booking_id') !== -1,
      );
      if (bookingIndex && bookingIndex.name) {
        await queryRunner.dropIndex('payments', bookingIndex.name);
      }
    }
    await queryRunner.changeColumn(
      'payments',
      'booking_id',
      new TableColumn({
        name: 'booking_id',
        type: 'uuid',
        isNullable: true,
      }),
    );
    await queryRunner.addColumns('payments', [
      new TableColumn({
        name: 'purpose_type',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'purpose_id',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
      }),
    ]);

    // 5. Update seed configs to include chargeable flag
    await queryRunner.query(`
      UPDATE platform_fee_configs
      SET config_value = config_value || '{"chargeable": true}'::jsonb
      WHERE config_key = 'feature_provider_subscriptions';
    `);
    await queryRunner.query(`
      UPDATE platform_fee_configs
      SET config_value = config_value || '{"chargeable": false}'::jsonb
      WHERE config_key = 'feature_customer_memberships';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse provider_subscription_plans
    await queryRunner.dropColumns('provider_subscription_plans', [
      'extra_days',
      'duration_months',
    ]);
    await queryRunner.renameColumn(
      'provider_subscription_plans',
      'price',
      'monthly_price',
    );

    // Reverse provider_subscriptions
    await queryRunner.dropColumns('provider_subscriptions', [
      'features_snapshot',
      'auto_renew',
      'payment_id',
      'amount_paid',
    ]);

    // Reverse customer_memberships
    await queryRunner.dropColumns('customer_memberships', [
      'auto_renew',
      'payment_id',
      'amount_paid',
    ]);

    // Reverse payments
    await queryRunner.dropColumns('payments', [
      'metadata',
      'purpose_id',
      'purpose_type',
    ]);
    await queryRunner.changeColumn(
      'payments',
      'booking_id',
      new TableColumn({
        name: 'booking_id',
        type: 'uuid',
        isNullable: false,
      }),
    );
  }
}
