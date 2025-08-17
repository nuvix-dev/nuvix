import { IsObject, IsString } from 'class-validator';

export class QueryDTO {
  @IsString()
  declare query: string;
}

export class DeparseDTO {
  @IsObject()
  declare ast: object;
}
