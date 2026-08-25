import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MovementStatus, MovementType } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  // Promoção / Mérito
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  // Aumento de quadro
  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedSalary?: number;

  // Promoção
  @IsOptional()
  @IsUUID()
  newPositionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newSalary?: number;

  // Mérito
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentage?: number;

  @IsDateString()
  effectiveDate: string;

  @IsString()
  justification: string;
}

export class UpdateMovementDto {
  @IsOptional()
  @IsUUID()
  newPositionId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsString()
  justification?: string;
}

export class MovementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(MovementStatus)
  status?: MovementStatus;

  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}
