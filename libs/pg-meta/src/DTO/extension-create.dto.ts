import { IsOptional, IsString } from 'class-validator';

export class ExtensionCreateDTO {
  @IsString()
  declare name: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
