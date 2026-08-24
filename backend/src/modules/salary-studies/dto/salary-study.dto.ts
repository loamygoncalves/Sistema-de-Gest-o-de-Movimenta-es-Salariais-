import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID } from 'class-validator';

export class ImportSalaryStudyDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  source?: string;

  @Type(() => Number)
  @IsInt()
  referenceYear: number;
}

export class PositioningQueryDto {
  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}
