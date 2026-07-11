import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLocalityColumn1720040000000 implements MigrationInterface {
  name = 'AddLocalityColumn1720040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add a precise locality column (colony/sublocality, e.g. "Kanchan Kunj")
    // to both customers and providers, separate from the coarse `address`/`city`.
    await queryRunner.addColumns('customers', [
      new TableColumn({
        name: 'locality',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'landmark',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
    await queryRunner.addColumns('providers', [
      new TableColumn({
        name: 'locality',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'landmark',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
    await queryRunner.addColumns('job_requests', [
      new TableColumn({
        name: 'locality',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'city',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('job_requests', ['city', 'locality']);
    await queryRunner.dropColumns('providers', ['landmark', 'locality']);
    await queryRunner.dropColumns('customers', ['landmark', 'locality']);
  }
}
