import { IsUID } from '@nuvix/core/validators';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsPhoneNumber,
  MaxLength,
} from 'class-validator';

export class CreateTelesignProviderDTO {
  @IsString()
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
  customerId?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
