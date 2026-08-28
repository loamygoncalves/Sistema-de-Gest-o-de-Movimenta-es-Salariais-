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

  // Novo salário — para PROMOCAO é o salário do novo cargo; para MERITO é o
  // novo salário desejado, a partir do qual o backend calcula o percentual
  // de mérito automaticamente (meritPercentage), em vez de receber o
  // percentual como entrada.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newSalary?: number;

  @IsDateString()
  effectiveDate: string;

  @IsString()
  justification: string;
}

/**
 * Edição de uma movimentação já criada — usada tanto para o rascunho do
 * próprio solicitante (RASCUNHO) quanto, por ADMIN/RH_REMUNERACAO, para
 * corrigir uma solicitação já em aprovação (PENDENTE_APROVACAO), ver
 * MovementsService#update. Nunca muda `type`/`employeeId` — só os campos
 * específicos de cada tipo, os mesmos aceitos na criação.
 */
export class UpdateMovementDto {
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

  // Promoção / Mérito
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  newSalary?: number;

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
