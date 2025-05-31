import { OmitType } from '@nestjs/mapped-types';
import { IsUID } from '@nuvix/core/validators';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePushTargetDTO {
  @IsString()
  @IsNotEmpty()
  @IsUID()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsOptional()
  @IsString()
  @IsUID()
  providerId?: string;
}

export class UpdatePushTargetDTO extends OmitType(CreatePushTargetDTO, [
  'targetId',
]) {}

export class TargetIdParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsUID()
  targetId: string;
}
