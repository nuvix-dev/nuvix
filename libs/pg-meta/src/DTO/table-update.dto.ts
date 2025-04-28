import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class TableUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  rls_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  rls_forced?: boolean;

  @IsOptional()
  @IsEnum(['DEFAULT', 'INDEX', 'FULL', 'NOTHING'])
  replica_identity?: 'DEFAULT' | 'INDEX' | 'FULL' | 'NOTHING';
}
