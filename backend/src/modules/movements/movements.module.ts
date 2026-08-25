import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovementRequest } from './entities/movement-request.entity';
import { MovementSimulation } from './entities/movement-simulation.entity';
import { Employee } from '../employees/entities/employee.entity';
import { SimulatorModule } from '../simulator/simulator.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MovementRequest, MovementSimulation, Employee]),
    SimulatorModule,
    ApprovalsModule,
    NotificationsModule,
  ],
  providers: [MovementsService],
  controllers: [MovementsController],
  exports: [MovementsService],
})
export class MovementsModule {}
