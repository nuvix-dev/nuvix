import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { IsInt, Min, Max } from 'class-validator';

export class AuthSessionAlertsDTO {
  @IsBoolean()
  alerts: boolean;
}

export class AuthLimitDTO {
  @IsInt()
  @Min(0)
  @Max(100) /**@todo update to env variable */
  limit: number;
}

export class AuthDurationDTO {
  @IsInt()
  @Min(0)
  @Max(31536000)
  duration: number;
}

export class AuthMethodStatusDTO {
  @IsBoolean()
  status: boolean;
}

export class AuthPasswordHistoryDTO {
  @IsInt()
  @Min(0)
  @Max(20) /**@todo update to env variable */
  limit: number;
}

export class AuthPasswordDictionaryDTO {
  @IsBoolean()
  enabled: boolean;
}

export class AuthPersonalDataDTO {
  @IsBoolean()
  enabled: boolean;
}

export class AuthMaxSessionsDTO {
  @IsInt()
  @Min(0)
  @Max(50) /**@todo update to env variable */
  limit: number;
}

export class AuthMockNumbersDTO {
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
