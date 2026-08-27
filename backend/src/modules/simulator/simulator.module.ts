import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeParameter } from './entities/charge-parameter.entity';
import { Employee } from '../employees/entities/employee.entity';
import { PayrollSnapshot } from '../employees/entities/payroll-snapshot.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { BudgetAdjustment } from '../budget/entities/budget-adjustment.entity';
import { RemunerationPolicy } from './entities/remuneration-policy.entity';
import { MovementHistory } from '../history/entities/movement-history.entity';
import { ChargeParametersService } from './charge-parameters.service';
import { ChargeParametersController } from './charge-parameters.controller';
import { RemunerationPolicyService } from './remuneration-policy.service';
import { RemunerationPolicyController } from './remuneration-policy.controller';
import { SimulatorService } from './simulator.service';
import { SimulatorController } from './simulator.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChargeParameter,
      Employee,
      PayrollSnapshot,
      BudgetEntry,
      BudgetAdjustment,
      RemunerationPolicy,
      MovementHistory,
    ]),
  ],
  providers: [ChargeParametersService, RemunerationPolicyService, SimulatorService],
  controllers: [ChargeParametersController, RemunerationPolicyController, SimulatorController],
  exports: [ChargeParametersService, RemunerationPolicyService, SimulatorService],
})
export class SimulatorModule {}
