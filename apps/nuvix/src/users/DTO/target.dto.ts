import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Database } from '@nuvix/database';
import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class CreateTargetDTO {
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9.-_]{0,35}$/, {
    message:
      'Target ID must be alphanumeric and can include period, hyphen, and underscore. Cannot start with a special character. Max length is 36 chars.',
  })
  targetId: string;

  @IsString()
  @Matches(/^(email|sms|push)$/, {
    message: 'Provider type must be one of the following: email, sms, or push.',
  })
  providerType: string;

  @IsString()
  @Length(1, Database.LENGTH_KEY)
  identifier: string;

  @IsOptional()
  @IsString()
  providerId?: string;

  @IsString()
  @Length(1, 128)
  name: string;
}

export class UpdateTargetDTO extends PartialType(
  OmitType(CreateTargetDTO, ['targetId', 'providerType']),
) {}
