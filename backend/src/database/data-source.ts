import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

import { Directorate } from '../modules/org/entities/directorate.entity';
import { Management } from '../modules/org/entities/management.entity';
import { Coordination } from '../modules/org/entities/coordination.entity';
import { Position } from '../modules/org/entities/position.entity';
import { CostCenter } from '../modules/org/entities/cost-center.entity';
import { User } from '../modules/users/entities/user.entity';
import { ImportBatch } from '../modules/imports/entities/import-batch.entity';
import { ImportError } from '../modules/imports/entities/import-error.entity';
import { Employee } from '../modules/employees/entities/employee.entity';
import { BudgetEntry } from '../modules/budget/entities/budget-entry.entity';
import { ChargeParameter } from '../modules/simulator/entities/charge-parameter.entity';
import { MovementRequest } from '../modules/movements/entities/movement-request.entity';
import { MovementSimulation } from '../modules/movements/entities/movement-simulation.entity';
import { ApprovalStep } from '../modules/approvals/entities/approval-step.entity';
import { MovementHistory } from '../modules/history/entities/movement-history.entity';
import { SalaryStudy } from '../modules/salary-studies/entities/salary-study.entity';
import { SalaryStudyEntry } from '../modules/salary-studies/entities/salary-study-entry.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';

export const entities = [
  Directorate,
  Management,
  Coordination,
  Position,
  CostCenter,
  User,
  ImportBatch,
  ImportError,
  Employee,
  BudgetEntry,
  ChargeParameter,
  MovementRequest,
  MovementSimulation,
  ApprovalStep,
  MovementHistory,
  SalaryStudy,
  SalaryStudyEntry,
  AuditLog,
];

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'salary_movements',
  entities,
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
});
