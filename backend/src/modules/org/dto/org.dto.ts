import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateDirectorateDto {
  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualBudget?: number;
}

export class UpdateDirectorateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  annualBudget?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateManagementDto {
  @IsString()
  name: string;

  @IsUUID()
  directorateId: string;
}

export class CreateCoordinationDto {
  @IsString()
  name: string;

  @IsUUID()
  managementId: string;
}

export class CreatePositionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  careerLevel?: string;

  @IsOptional()
  @IsBoolean()
  hideSalaryFromManager?: boolean;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  careerLevel?: string;

  @IsOptional()
  @IsBoolean()
  hideSalaryFromManager?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCostCenterDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  directorateId?: string;
}

export class BulkDeleteCostCentersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];
}
