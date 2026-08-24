import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { OrgModule } from '../org/org.module';
import { ImportsModule } from '../imports/imports.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, BudgetEntry]), OrgModule, ImportsModule],
  providers: [EmployeesService],
  controllers: [EmployeesController],
  exports: [EmployeesService],
})
export class EmployeesModule {}
