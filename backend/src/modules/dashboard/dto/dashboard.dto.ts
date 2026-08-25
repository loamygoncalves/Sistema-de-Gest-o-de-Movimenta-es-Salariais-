import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  /** Mês de referência (1-12) para indicadores de HC/folha orçados. Padrão: mês corrente. */
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
