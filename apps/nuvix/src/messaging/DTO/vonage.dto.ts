import { IsUID } from '@nuvix/core/validators';
import {
  IsBoolean,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVonageProviderDTO {
  @IsUID()
  providerId: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsPhoneNumber()
  from?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  apiSecret?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
