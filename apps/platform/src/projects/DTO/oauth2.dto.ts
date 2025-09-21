import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { oAuthProviders } from '@nuvix/core/config/authProviders';

export class oAuth2DTO {
  @IsIn(Object.keys(oAuthProviders))
  provider!: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
