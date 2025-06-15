import { IsOptional, IsString } from 'class-validator';

export class ExtensionUpdateDTO {
  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  version?: string;
}
