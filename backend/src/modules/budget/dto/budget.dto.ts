import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class BudgetEntryQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}

export class BudgetDashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  /** Mês de referência (1-12) para HC/folha orçados. Sem informar, usa o mês corrente. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}

export class BudgetAdjustmentQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;
}

/**
 * Percentual do Ajuste de Orçamento (tela ADMIN) — ex.: 90 reduz todo orçado
 * em R$ para 90% do importado. `directorateId`/`costCenterId` ausentes =
 * escopo "todos" (empresa inteira); só `directorateId` = uma diretoria
 * inteira; ambos = um centro de resultado específico dessa diretoria.
 */
export class SaveBudgetAdjustmentDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(300)
  percent: number;
}
