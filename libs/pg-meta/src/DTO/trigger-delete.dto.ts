import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class TriggerDeleteQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  cascade?: boolean;
}
