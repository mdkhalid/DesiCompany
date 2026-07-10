import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBookingCommissionAmount1720020000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const bookingsTable = await queryRunner.getTable('bookings');
    if (bookingsTable && !bookingsTable.findColumnByName('commission_amount')) {
      await queryRunner.addColumn(
        'bookings',
        new TableColumn({
          name: 'commission_amount',
          type: 'decimal',
          precision: 10,
          scale: 2,
          default: 0,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const bookingsTable = await queryRunner.getTable('bookings');
    if (bookingsTable && bookingsTable.findColumnByName('commission_amount')) {
      await queryRunner.dropColumn('bookings', 'commission_amount');
    }
  }
}
