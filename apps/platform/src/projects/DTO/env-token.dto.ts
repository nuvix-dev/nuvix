import { IsUID } from '@nuvix/core/validators';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEnvTokenDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsUID()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  url!: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
