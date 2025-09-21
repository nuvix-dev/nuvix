import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  IsIn,
} from 'class-validator';

export class CreateProjectDTO {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  region!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  @IsIn(['dev', 'prod'])
  env?: 'dev' | 'prod' = 'dev';
}
