import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class RoleCreateDTO {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  is_superuser?: boolean;

  @IsOptional()
  @IsBoolean()
  can_create_db?: boolean;

  @IsOptional()
  @IsBoolean()
  can_create_role?: boolean;

  @IsOptional()
  @IsBoolean()
  inherit_role?: boolean;

  @IsOptional()
  @IsBoolean()
  can_login?: boolean;

  @IsOptional()
  @IsBoolean()
  is_replication_role?: boolean;

  @IsOptional()
  @IsBoolean()
  can_bypass_rls?: boolean;

  @IsOptional()
  @IsInt()
  connection_limit?: number;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  valid_until?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  member_of?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  members?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  admins?: string[];

  @IsOptional()
  @IsObject()
  config?: Record<string, string>;
}
