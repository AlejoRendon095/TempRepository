import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateRevokedTokensTable1731787400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'revoked_tokens',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'jti',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'expires_at',
            type: 'timestamptz',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'revoked_tokens',
      new TableIndex({
        name: 'IDX_revoked_tokens_jti',
        columnNames: ['jti'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'revoked_tokens',
      new TableIndex({
        name: 'IDX_revoked_tokens_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'revoked_tokens',
      new TableForeignKey({
        name: 'FK_revoked_tokens_user_id',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('revoked_tokens', true);
  }
}