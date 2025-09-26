import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class TableUpdateDTO {
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
  @ApiPropertyOptional({ enum: ['DEFAULT', 'INDEX', 'FULL', 'NOTHING'] })
  replica_identity?: 'DEFAULT' | 'INDEX' | 'FULL' | 'NOTHING';

  @IsOptional()
  @IsString()
  replica_identity_index?: string;

  @IsOptional()
  @IsArray()
  primary_keys?: { name: string }[];
}
