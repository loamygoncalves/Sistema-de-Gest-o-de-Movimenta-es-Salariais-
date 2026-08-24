import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChargeValueType } from '../../../common/enums';

@Entity('charge_parameters')
export class ChargeParameter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100, unique: true })
  name: string;

  @Column({ length: 150 })
  label: string;

  @Column({
    type: 'enum',
    enum: ChargeValueType,
    default: ChargeValueType.PERCENTUAL,
    name: 'value_type',
  })
  valueType: ChargeValueType;

  @Column('numeric', { precision: 10, scale: 4 })
  value: number;

  @Column({ default: false, name: 'is_benefit' })
  isBenefit: boolean;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
