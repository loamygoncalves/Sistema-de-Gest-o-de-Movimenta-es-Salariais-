import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryStudy } from './entities/salary-study.entity';
import { SalaryStudyEntry } from './entities/salary-study-entry.entity';
import { Employee } from '../employees/entities/employee.entity';
import { OrgModule } from '../org/org.module';
import { ImportsModule } from '../imports/imports.module';
import { SalaryStudiesService } from './salary-studies.service';
import { SalaryStudiesController } from './salary-studies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryStudy, SalaryStudyEntry, Employee]),
    OrgModule,
    ImportsModule,
  ],
  providers: [SalaryStudiesService],
  controllers: [SalaryStudiesController],
  exports: [SalaryStudiesService],
})
export class SalaryStudiesModule {}
