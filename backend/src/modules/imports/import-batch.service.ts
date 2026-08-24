import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportStatus, ImportType } from '../../common/enums';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportError } from './entities/import-error.entity';

export interface RowError {
  rowNumber: number;
  field?: string;
  message: string;
}

@Injectable()
export class ImportBatchService {
  constructor(
    @InjectRepository(ImportBatch)
    private readonly batchRepo: Repository<ImportBatch>,
    @InjectRepository(ImportError)
    private readonly errorRepo: Repository<ImportError>,
  ) {}

  async create(
    type: ImportType,
    filename: string,
    importedById: string,
    referenceYear?: number,
  ): Promise<ImportBatch> {
    const batch = this.batchRepo.create({
      type,
      filename,
      importedById,
      referenceYear,
      status: ImportStatus.PROCESSANDO,
    });
    return this.batchRepo.save(batch);
  }

  async finish(
    batchId: string,
    totalRows: number,
    successRows: number,
    errors: RowError[],
  ): Promise<ImportBatch> {
    if (errors.length > 0) {
      await this.errorRepo.save(
        errors.map((error) =>
          this.errorRepo.create({
            batchId,
            rowNumber: error.rowNumber,
            field: error.field,
            message: error.message,
          }),
        ),
      );
    }

    const status =
      errors.length === 0
        ? ImportStatus.CONCLUIDO
        : successRows > 0
          ? ImportStatus.CONCLUIDO_COM_ERROS
          : ImportStatus.FALHOU;

    await this.batchRepo.update(batchId, {
      totalRows,
      successRows,
      errorRows: errors.length,
      status,
      finishedAt: new Date(),
    });

    return this.findOne(batchId);
  }

  async findOne(id: string): Promise<ImportBatch> {
    return this.batchRepo.findOneOrFail({ where: { id } });
  }

  async findErrors(batchId: string): Promise<ImportError[]> {
    return this.errorRepo.find({ where: { batchId }, order: { rowNumber: 'ASC' } });
  }
}
