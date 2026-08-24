import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;
}
