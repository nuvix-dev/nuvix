import { TransformStringToBoolean } from '@nuvix/core/validators';
import { IsBoolean, IsOptional } from 'class-validator';

export class ExtensionDeleteQueryDTO {
  @IsOptional()
  @TransformStringToBoolean()
  @IsBoolean()
  cascade?: boolean;
}
