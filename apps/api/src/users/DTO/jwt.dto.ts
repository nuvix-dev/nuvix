import { IsUID } from '@nuvix/core/validators/input.validator.js';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateJwtDTO {
  @IsUID()
  sessionId?: string = 'recent';

  @IsInt()
  @Min(0)
  @Max(3600)
  duration: number = 900;
}
