import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Directorate } from './entities/directorate.entity';
import { Management } from './entities/management.entity';
import { Coordination } from './entities/coordination.entity';
import { Position } from './entities/position.entity';
import { CostCenter } from './entities/cost-center.entity';
import { OrgService } from './org.service';
import { OrgController } from './org.controller';
import { ImportsModule } from '../imports/imports.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Directorate,
      Management,
      Coordination,
      Position,
      CostCenter,
    ]),
    ImportsModule,
  ],
  providers: [OrgService],
  controllers: [OrgController],
  exports: [OrgService],
})
export class OrgModule {}
