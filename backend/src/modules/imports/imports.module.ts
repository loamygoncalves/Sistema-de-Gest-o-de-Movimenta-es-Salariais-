import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportError } from './entities/import-error.entity';
import { ImportBatchService } from './import-batch.service';

@Module({
  imports: [TypeOrmModule.forFeature([ImportBatch, ImportError])],
  providers: [ImportBatchService],
  exports: [ImportBatchService],
})
export class ImportsModule {}
