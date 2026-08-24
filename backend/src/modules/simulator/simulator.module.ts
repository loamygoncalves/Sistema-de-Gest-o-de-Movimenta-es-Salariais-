import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeParameter } from './entities/charge-parameter.entity';
import { Directorate } from '../org/entities/directorate.entity';
import { Employee } from '../employees/entities/employee.entity';
import { ChargeParametersService } from './charge-parameters.service';
import { ChargeParametersController } from './charge-parameters.controller';
import { SimulatorService } from './simulator.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChargeParameter, Directorate, Employee])],
  providers: [ChargeParametersService, SimulatorService],
  controllers: [ChargeParametersController],
  exports: [ChargeParametersService, SimulatorService],
})
export class SimulatorModule {}
