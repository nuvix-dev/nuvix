import { OmitType } from '@nestjs/swagger';
import { IsCustomID } from '@nuvix/core/validators';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePushTargetDTO {
  @IsString()
  @IsNotEmpty()
  @IsCustomID()
  targetId!: string;

  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsOptional()
  @IsString()
  @IsCustomID()
  providerId?: string;
}

export class UpdatePushTargetDTO extends OmitType(CreatePushTargetDTO, [
  'targetId',
]) {}

export class TargetIdParamDTO {
  @IsString()
  @IsNotEmpty()
  @IsCustomID()
  targetId!: string;
}
