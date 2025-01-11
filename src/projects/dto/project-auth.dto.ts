import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsString, Matches, ValidateNested } from "class-validator";
import { IsInt, Min, Max } from "class-validator";


export class AuthSessionAlertsDto {
  @IsBoolean()
  alerts: boolean;
}

export class AuthLimitDto {
  @IsInt()
  @Min(0)
  @Max(100) /**@todo update to env variable */
  limit: number;
}


export class AuthDurationDto {
  @IsInt()
  @Min(0)
  @Max(31536000)
  duration: number;
}

export class AuthMethodStatusDto {
  @IsBoolean()
  status: boolean;
}

export class AuthPasswordHistoryDto {
  @IsInt()
  @Min(0)
  @Max(20) /**@todo update to env variable */
  limit: number;
}

export class AuthPasswordDictionaryDto {
  @IsBoolean()
  enabled: boolean;
}

export class AuthPersonalDataDto {
  @IsBoolean()
  enabled: boolean;
}

export class AuthMaxSessionsDto {
  @IsInt()
  @Min(0)
  @Max(50) /**@todo update to env variable */
  limit: number;
}

export class AuthMockNumbersDto {
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => MockNumber)
  numbers: MockNumber[];
}

class MockNumber {
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/)
  phone: string;

  @IsString()
  otp: string;
}
