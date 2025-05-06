import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { TransformStringToBoolean } from '@nuvix/core/validators';

export class GeneratorQueryDto {
  @IsOptional()
  @IsString()
  excluded_schemas?: string;

  @IsOptional()
  @IsString()
  included_schemas?: string;

  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  detect_one_to_one_relationships?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['internal', 'public', 'private', 'package'])
  access_control?: 'internal' | 'public' | 'private' | 'package';
}
