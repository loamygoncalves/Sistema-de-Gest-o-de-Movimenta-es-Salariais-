import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalStep } from './entities/approval-step.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalStep, MovementRequest, MovementSimulation, MovementHistory]),
  ],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
