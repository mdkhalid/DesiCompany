import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

export class AddBookingCommissionWaiver1720010000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const bookingsTable = await queryRunner.getTable('bookings');
    if (
      bookingsTable &&
      !bookingsTable.findColumnByName('commission_waived')
    ) {
      await queryRunner.addColumn(
        'bookings',
        new TableColumn({
          name: 'commission_waived',
          type: 'boolean',
          default: false,
        }),
      );
    }
    if (
      bookingsTable &&
      !bookingsTable.findColumnByName('commission_waived_reason')
    ) {
      await queryRunner.addColumn(
        'bookings',
        new TableColumn({
          name: 'commission_waived_reason',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }

    // Seed the independent commission-waiver toggle (default: on)
    await queryRunner.query(`
      INSERT INTO settings ("key", "value", "description", "created_at", "updated_at")
      VALUES
        ('provider_grace_period_commission_waiver', 'true', 'Waive platform commission for providers within their grace period', NOW(), NOW())
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const bookingsTable = await queryRunner.getTable('bookings');
    if (
      bookingsTable &&
      bookingsTable.findColumnByName('commission_waived_reason')
    ) {
      await queryRunner.dropColumn('bookings', 'commission_waived_reason');
    }
    if (
      bookingsTable &&
      bookingsTable.findColumnByName('commission_waived')
    ) {
      await queryRunner.dropColumn('bookings', 'commission_waived');
    }

    await queryRunner.query(`
      DELETE FROM settings WHERE "key" = 'provider_grace_period_commission_waiver'
    `);
  }
}
