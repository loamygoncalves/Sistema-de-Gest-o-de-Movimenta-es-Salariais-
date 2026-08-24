import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovementHistory } from './entities/movement-history.entity';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MovementHistory])],
  providers: [HistoryService],
  controllers: [HistoryController],
  exports: [HistoryService],
})
export class HistoryModule {}
