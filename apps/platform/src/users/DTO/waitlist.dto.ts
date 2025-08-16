import {
  IsEmail,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateWaitlistDTO {
  @IsEmail()
  @MaxLength(2000)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  note?: string;

  @IsOptional()
  @IsBoolean()
  notified?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
