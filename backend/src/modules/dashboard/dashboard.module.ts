import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollSnapshot } from '../employees/entities/payroll-snapshot.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { Directorate } from '../org/entities/directorate.entity';
import { MovementRequest } from '../movements/entities/movement-request.entity';
import { MovementSimulation } from '../movements/entities/movement-simulation.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollSnapshot,
      BudgetEntry,
      Directorate,
      MovementRequest,
      MovementSimulation,
      MovementHistory,
    ]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
