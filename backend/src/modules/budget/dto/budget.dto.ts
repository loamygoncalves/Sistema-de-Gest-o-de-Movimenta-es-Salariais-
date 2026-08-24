import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
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
