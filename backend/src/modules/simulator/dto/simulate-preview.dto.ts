import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { MovementType } from '../../../common/enums';

/**
 * Simulação rápida (Módulo 4) — Gestor/Diretor testa o impacto de uma
 * promoção ou mérito para um dos seus colaboradores, sem abrir de fato uma
 * solicitação de movimentação (ver SimulatorController#preview).
 */
export class SimulatePreviewDto {
  @IsUUID()
  employeeId: string;

  /** Só PROMOCAO ou MERITO fazem sentido aqui (AUMENTO_QUADRO não parte de um colaborador existente). */
  @IsEnum(MovementType)
  type: MovementType;

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
}
