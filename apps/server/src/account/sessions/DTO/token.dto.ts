import { IsUID } from '@nuvix/core/validators/input.validator.js';
import { configuration } from '@nuvix/utils';
import {
  IsString,
  IsUrl,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
  IsNotEmpty,
  IsEmail,
  IsBoolean,
  IsPhoneNumber,
} from 'class-validator';

export class CreateOAuth2TokenDTO {
  @IsOptional()
  @IsUrl()
  success?: string;

  @IsOptional()
  @IsUrl()
  failure?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(configuration.limits.arrayElementSize, { each: true })
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  scopes: string[] = [];
}

export class CreateMagicURLTokenDTO {
  @IsUID()
  userId!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsBoolean()
  phrase?: boolean = false;
}

export class CreateEmailTokenDTO {
  @IsUID()
  userId!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  phrase?: boolean = false;
}

export class CreatePhoneTokenDTO {
  @IsUID()
  userId!: string;

  @IsNotEmpty()
  @IsPhoneNumber()
  @IsString()
  phone!: string;
}
