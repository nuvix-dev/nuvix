import { IsUID } from '@nuvix/core/validators/input.validator.js';
import {
  APP_LIMIT_ARRAY_ELEMENT_SIZE,
  APP_LIMIT_ARRAY_PARAMS_SIZE,
} from '@nuvix/utils';
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
  @MaxLength(APP_LIMIT_ARRAY_ELEMENT_SIZE, { each: true })
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
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
