import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { oAuthProviders } from "src/core/config/authProviders";


export class oAuth2Dto {
  @IsIn(Object.keys(oAuthProviders))
  provider: string;

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