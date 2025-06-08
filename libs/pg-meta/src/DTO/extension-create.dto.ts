import { IsOptional, IsString } from 'class-validator';

export class ExtensionCreateDTO {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
