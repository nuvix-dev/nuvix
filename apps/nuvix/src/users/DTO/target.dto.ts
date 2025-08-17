import { OmitType, PartialType } from '@nestjs/swagger';
import { Database } from '@nuvix-tech/db';
import { IsCustomID } from '@nuvix/core/validators/input.validator.js';
import { MessageType } from '@nuvix/utils';
import { IsString, IsOptional, Length, IsIn } from 'class-validator';

export class CreateTargetDTO {
  @IsCustomID()
  targetId!: string;

  @IsString()
  @IsIn(Object.values(MessageType))
  providerType!: string;

  @IsString()
  @Length(1, Database.LENGTH_KEY)
  identifier!: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsString()
  @Length(1, 128)
  name!: string;
}

export class UpdateTargetDTO extends PartialType(
  OmitType(CreateTargetDTO, ['targetId', 'providerType']),
) {}
