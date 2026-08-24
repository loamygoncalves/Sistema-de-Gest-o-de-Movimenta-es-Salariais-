import { IsDateString, IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { MovementType } from '../../../common/enums';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class HistoryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;

  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @IsOptional()
  @IsUUID()
  costCenterId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class HistoryExportQueryDto extends HistoryQueryDto {
  @IsIn(['xlsx', 'pdf'])
  format: 'xlsx' | 'pdf';
}
