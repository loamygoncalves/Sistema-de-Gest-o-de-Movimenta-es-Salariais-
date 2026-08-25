import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeParameter } from './entities/charge-parameter.entity';
import { Employee } from '../employees/entities/employee.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { ChargeParametersService } from './charge-parameters.service';
import { ChargeParametersController } from './charge-parameters.controller';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChargeParameter, Employee, BudgetEntry])],
  providers: [ChargeParametersService, SimulatorService],
  controllers: [ChargeParametersController],
  exports: [ChargeParametersService, SimulatorService],
})
export class SimulatorModule {}
