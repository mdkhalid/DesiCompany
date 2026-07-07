import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddRecipientRoleToNotifications1720000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'notifications',
      new TableColumn({
        name: 'recipient_role',
        type: 'enum',
        enumName: 'notifications_recipient_role_enum',
        enum: ['customer', 'provider', 'admin'],
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'IDX_notifications_user_recipient_role',
        columnNames: ['user_id', 'recipient_role'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'notifications',
      'IDX_notifications_user_recipient_role',
    );
    await queryRunner.dropColumn('notifications', 'recipient_role');
    await queryRunner.query(
      'DROP TYPE IF EXISTS notifications_recipient_role_enum',
    );
  }
}
