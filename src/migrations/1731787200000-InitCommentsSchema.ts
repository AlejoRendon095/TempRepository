import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitCommentsSchema1731787200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'comments',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'text',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['PUBLISHED', 'PENDING_REVIEW', 'BLOCKED'],
            default: "'PENDING_REVIEW'",
          },
          {
            name: 'label',
            type: 'enum',
            enum: ['LEGIT', 'SPAM', 'FRAUD'],
            isNullable: true,
          },
          {
            name: 'confidence',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'reviewedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'comments',
      new TableIndex({
        name: 'IDX_comments_status_createdAt',
        columnNames: ['status', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('comments', true);
  }
}