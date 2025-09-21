import { PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateKeyDTO {
  @IsString()
  @MaxLength(128)
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  scopes!: string[];

  @IsOptional()
  @IsDateString()
  expire!: string;
}

export class UpdateKeyDTO extends PartialType(CreateKeyDTO) {}
