import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';


export class UpdateSmtpDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  @Length(0, 255)
  @IsNotEmpty()
  senderName: string;

  @IsEmail()
  @IsNotEmpty()
  senderEmail: string;

  @IsEmail()
  @IsNotEmpty()
  replyTo: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsInt()
  @IsNotEmpty()
  port: number;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsIn(['tls', 'ssl'])
  @IsNotEmpty()
  secure: 'tls' | 'ssl';
}


export class SmtpTestsDto {
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