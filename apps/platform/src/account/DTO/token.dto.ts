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
  @IsString()
  @MaxLength(36)
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
  @IsString()
  @MaxLength(36)
  userId!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  phrase?: boolean = false;
}
