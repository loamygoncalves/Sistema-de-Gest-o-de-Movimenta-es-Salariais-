import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../../common/enums';

export class CreateUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  /** Usado quando role = DIRETOR (escopo: diretoria inteira). */
  @IsOptional()
  @IsUUID()
  directorateId?: string;

  /** Usado quando role = GESTOR (escopo: só os centros de custo listados). */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  costCenterIds?: string[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  directorateId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  costCenterIds?: string[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  password: string;
}
