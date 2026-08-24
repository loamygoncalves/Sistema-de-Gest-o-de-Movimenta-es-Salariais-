import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BudgetEntry } from './entities/budget-entry.entity';
import { OrgModule } from '../org/org.module';
import { ImportsModule } from '../imports/imports.module';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BudgetEntry]), OrgModule, ImportsModule],
  providers: [BudgetService],
  controllers: [BudgetController],
  exports: [BudgetService],
})
export class BudgetModule {}
