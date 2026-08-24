import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class BudgetEntryQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;
}

export class BudgetDashboardQueryDto {
  @Type(() => Number)
  @IsInt()
  year: number;

  @IsOptional()
  @IsUUID()
  directorateId?: string;
}
