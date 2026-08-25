import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from './employee.entity';
import { Directorate } from '../../org/entities/directorate.entity';
import { CostCenter } from '../../org/entities/cost-center.entity';
import { Position } from '../../org/entities/position.entity';
import { ImportBatch } from '../../imports/entities/import-batch.entity';

/**
 * Fechamento mensal da folha — um "print" do salário de cada colaborador no
 * mês em que a base foi fechada (ver EmployeesService#importFromExcel com
 * year/month informados). Existe porque `employees.current_salary` é um
 * valor único e vivo: sem isso, consultar "a folha de janeiro" depois que
 * fevereiro já foi importado mostraria o valor de fevereiro para os dois
 * meses. Onde existir um snapshot para (year, month), os relatórios usam
 * esse valor "congelado"; onde não existir (mês corrente ainda não fechado,
 * ou histórico anterior a este recurso), cai para `employees.current_salary`
 * ao vivo — ver DashboardService#getPayroll/getHeadcount e
 * EmployeesService#compareWithBudget.
 */
@Entity('payroll_snapshots')
@Index(['year', 'month'])
export class PayrollSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'smallint' })
  year: number;

  @Column({ type: 'smallint' })
  month: number;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Directorate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'directorate_id' })
  directorate: Directorate;

  @Column({ name: 'directorate_id' })
  directorateId: string;

  @ManyToOne(() => CostCenter, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cost_center_id' })
  costCenter?: CostCenter;

  @Column({ name: 'cost_center_id', nullable: true })
  costCenterId?: string;

  @ManyToOne(() => Position, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ name: 'position_id' })
  positionId: string;

  @Column('numeric', { precision: 14, scale: 2 })
  salary: number;

  @ManyToOne(() => ImportBatch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_batch_id' })
  importBatch?: ImportBatch;

  @Column({ name: 'import_batch_id', nullable: true })
  importBatchId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
