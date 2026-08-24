import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ContractType, EmployeeStatus } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateEmployeeDto {
  @IsString()
  registration: string;

  @IsString()
  name: string;

  @IsUUID()
  positionId: string;

  @IsUUID()
  directorateId: string;

  @IsOptional()
  @IsUUID()
  managementId?: string;

  @IsOptional()
  @IsUUID()
  coordinationId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsDateString()
  admissionDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentSalary: number;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  managementId?: string;

  @IsOptional()
  @IsUUID()
  coordinationId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentSalary?: number;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;
}

export class EmployeeQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
