import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ChargeValueType } from '../../../common/enums';

export class CreateChargeParameterDto {
  @IsString()
  name: string;

  @IsString()
  label: string;

  @IsEnum(ChargeValueType)
  valueType: ChargeValueType;

  @Type(() => Number)
  @IsNumber()
  value: number;

  @IsOptional()
  @IsBoolean()
  isBenefit?: boolean;
}

export class UpdateChargeParameterDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsEnum(ChargeValueType)
  valueType?: ChargeValueType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsBoolean()
  isBenefit?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
