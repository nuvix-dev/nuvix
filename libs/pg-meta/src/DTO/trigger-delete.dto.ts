import { IsBoolean, IsOptional } from 'class-validator';
import { TransformStringToBoolean } from '@nuvix/core/validators';

export class TriggerDeleteQueryDTO {
  @IsOptional()
  @IsBoolean()
  @TransformStringToBoolean()
  cascade?: boolean;
}
