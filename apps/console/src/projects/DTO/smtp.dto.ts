import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateSmtpDTO {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  @IsNotEmpty()
  senderName: string;

  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  senderEmail: string;

  @IsOptional()
  @IsEmail()
  @IsNotEmpty()
  replyTo: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  host: string;

  @IsOptional()
  @IsInt()
  @IsNotEmpty()
  port: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsIn(['tls', 'ssl'])
  @IsNotEmpty()
  secure: 'tls' | 'ssl';
}

export class SmtpTestsDTO {
  @IsEmail({}, { each: true })
  @Length(0, 10, { each: true })
  emails: string[];

  @IsString()
  @Length(0, 255)
  @IsNotEmpty()
  senderName: string;

  @IsEmail()
  @IsNotEmpty()
  senderEmail: string;

  @IsEmail()
  @IsOptional()
  replyTo?: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsIn(['tls', 'ssl'])
  @IsOptional()
  secure?: 'tls' | 'ssl';
}
