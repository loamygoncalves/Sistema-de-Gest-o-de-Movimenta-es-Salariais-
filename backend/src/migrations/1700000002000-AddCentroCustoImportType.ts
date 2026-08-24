import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona 'CENTRO_CUSTO' ao enum import_type — usado pela importação em
 * massa de centros de custo (upload de Excel só com os nomes).
 */
export class AddCentroCustoImportType1700000002000 implements MigrationInterface {
  name = 'AddCentroCustoImportType1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE import_type ADD VALUE IF NOT EXISTS 'CENTRO_CUSTO'`);
  }

  public async down(): Promise<void> {
    // Postgres não suporta remover valor de enum; reverter exigiria recriar o
    // tipo (como em RedesignBudgetEntries). Não há necessidade prática de
    // reverter apenas a adição de um rótulo, então down() é um no-op.
  }
}
