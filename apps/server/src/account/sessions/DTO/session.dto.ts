import {
  type OAuthProviders,
  oAuthProvidersList,
} from '@nuvix/core/config/authProviders';
import { IsUID } from '@nuvix/core/validators/input.validator.js';
import { configuration } from '@nuvix/utils';
import { Expose } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEmailSessionDTO {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}

export class CreateSessionDTO {
  @IsUID()
  userId!: string;

  @IsString()
  @Length(200, 256)
  secret!: string;
}

export class CreateOAuth2SessionDTO {
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
  scopes?: string[] = [];
}

@Expose()
export class OAuth2CallbackDTO {
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  error?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  error_description?: string;
}

export class ProviderParamDTO {
  @IsString()
  @IsIn(oAuthProvidersList)
  provider!: OAuthProviders;
}
