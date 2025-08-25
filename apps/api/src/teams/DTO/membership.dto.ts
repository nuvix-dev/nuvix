import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsOptional,
} from 'class-validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from '@nuvix/utils';
import { IsUID } from '@nuvix/core/validators/input.validator.js';

export class CreateMembershipDTO {
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @IsOptional()
  @IsUID()
  userId?: string;

  @IsOptional()
  @IsPhoneNumber()
  @IsNotEmpty()
  phone?: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  roles: string[] = [];

  @IsOptional()
  @IsUrl()
  @IsNotEmpty()
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @IsNotEmpty()
  name?: string;
}

export class UpdateMembershipDTO {
  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  roles!: string[];
}

export class UpdateMembershipStatusDTO {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @MaxLength(256)
  secret!: string;
}
