import { configuration } from '@nuvix/utils';
import {
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  MaxLength,
  IsArray,
  ArrayMaxSize,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class CreateMembershipDTO {
  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  declare email: string;

  @IsOptional()
  @IsNotEmpty()
  declare userId: string;

  @IsOptional()
  @IsPhoneNumber()
  @IsNotEmpty()
  declare phone: string;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  declare roles: string[];

  @IsUrl()
  @IsNotEmpty()
  declare url: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @IsNotEmpty()
  declare name: string;
}

export class UpdateMembershipDTO {
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  declare roles: string[];
}

export class UpdateMembershipStatusDTO {
  @IsNotEmpty()
  @IsString()
  declare userId: string;

  @IsNotEmpty()
  @MaxLength(256)
  declare secret: string;
}
