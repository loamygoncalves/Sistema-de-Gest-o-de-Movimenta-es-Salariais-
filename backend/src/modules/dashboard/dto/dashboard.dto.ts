import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Aceita "7,8,9" (query string) ou um array já desserializado e devolve number[]. */
function parseMonths(value: unknown): number[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  return raw.map((v) => Number(v)).filter((n) => Number.isInteger(n));
}

export class DashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  /**
   * Meses de referência (1-12) para indicadores de HC/folha orçados —
   * aceita vários (ex.: "7,8,9") para uma visão acumulada do período
   * selecionado. Padrão: mês corrente. Folha (custo) é somada entre os
   * meses selecionados; HC é a média (headcount não é aditivo).
   */
  @IsOptional()
  @Transform(({ value }) => parseMonths(value))
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  months?: number[];

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;
}
