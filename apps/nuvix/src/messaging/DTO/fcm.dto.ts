import { IsUID } from '@nuvix/core/validators';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateFcmProviderDTO {
  @IsString()
  @IsUID()
  providerId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  name: string;

  @IsOptional()
  @IsObject()
  serviceAccountJSON?: object;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
