import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { PayrollSnapshot } from './entities/payroll-snapshot.entity';
import { BudgetEntry } from '../budget/entities/budget-entry.entity';
import { BudgetAdjustment } from '../budget/entities/budget-adjustment.entity';
import { OrgModule } from '../org/org.module';
import { ImportsModule } from '../imports/imports.module';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Employee, PayrollSnapshot, BudgetEntry, BudgetAdjustment]),
    OrgModule,
    ImportsModule,
  ],
  providers: [EmployeesService],
  controllers: [EmployeesController],
  exports: [EmployeesService],
})
export class EmployeesModule {}
