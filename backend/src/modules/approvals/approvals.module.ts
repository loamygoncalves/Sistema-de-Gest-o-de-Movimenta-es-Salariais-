import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalStep } from './entities/approval-step.entity';
import { ApprovalWorkflowStep } from './entities/approval-workflow-step.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ApprovalWorkflowController } from './approval-workflow.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApprovalStep,
      ApprovalWorkflowStep,
      MovementRequest,
      MovementSimulation,
      MovementHistory,
    ]),
  ],
  providers: [ApprovalsService, ApprovalWorkflowService],
  controllers: [ApprovalsController, ApprovalWorkflowController],
  exports: [ApprovalsService, ApprovalWorkflowService],
})
export class ApprovalsModule {}
