import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { entities } from './database/data-source';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrgModule } from './modules/org/org.module';
import { ImportsModule } from './modules/imports/imports.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { BudgetModule } from './modules/budget/budget.module';
import { SimulatorModule } from './modules/simulator/simulator.module';
import { MovementsModule } from './modules/movements/movements.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { HistoryModule } from './modules/history/history.module';
import { SalaryStudiesModule } from './modules/salary-studies/salary-studies.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        entities,
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    AuthModule,
    UsersModule,
    OrgModule,
    ImportsModule,
    EmployeesModule,
    BudgetModule,
    SimulatorModule,
    MovementsModule,
    ApprovalsModule,
    HistoryModule,
    SalaryStudiesModule,
    DashboardModule,
    AuditModule,
  ],
})
export class AppModule {}
