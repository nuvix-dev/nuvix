import { IsIn, IsOptional, IsString } from 'class-validator';

export class TriggerUpdateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['ORIGIN', 'REPLICA', 'ALWAYS', 'DISABLED'])
  enabled_mode?: 'ORIGIN' | 'REPLICA' | 'ALWAYS' | 'DISABLED';
}
