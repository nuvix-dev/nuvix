import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator'

export class RoleUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsBoolean()
  is_superuser?: boolean

  @IsOptional()
  @IsBoolean()
  can_create_db?: boolean

  @IsOptional()
  @IsBoolean()
  can_create_role?: boolean

  @IsOptional()
  @IsBoolean()
  inherit_role?: boolean

  @IsOptional()
  @IsBoolean()
  can_login?: boolean

  @IsOptional()
  @IsBoolean()
  is_replication_role?: boolean

  @IsOptional()
  @IsBoolean()
  can_bypass_rls?: boolean

  @IsOptional()
  @IsInt()
  connection_limit?: number

  @IsOptional()
  @IsString()
  password?: string

  @IsOptional()
  @IsString()
  valid_until?: string

  @IsOptional()
  @IsArray()
  config?: Array<{
    op: 'remove' | 'add' | 'replace'
    path: string
    value?: string
  }>
}
