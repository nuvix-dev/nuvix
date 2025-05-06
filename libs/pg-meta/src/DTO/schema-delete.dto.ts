import { TransformStringToBoolean } from '@nuvix/core/validators';
import { IsBoolean, IsOptional } from 'class-validator';

export class SchemaDeleteQueryDto {
  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  cascade?: boolean;
}
