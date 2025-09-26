import { OmitType } from '@nestjs/swagger';
import { IsCustomID, IsUID } from '@nuvix/core/validators';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePushTargetDTO {
  @IsCustomID()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsOptional()
  @IsString()
  @IsUID()
  providerId?: string;
}

export class UpdatePushTargetDTO extends OmitType(CreatePushTargetDTO, [
  'targetId',
] as const) {}

export class TargetIdParamDTO {
  @IsUID()
  targetId!: string;
}
