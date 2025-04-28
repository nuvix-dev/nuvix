import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class PolicyUpdateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  definition?: string;

  @IsOptional()
  @IsString()
  check?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  roles?: string[];
}
