import { IsObject, IsString } from 'class-validator';

export class QueryDTO {
  @IsString()
  query: string;
}

export class DeparseDTO {
  @IsObject()
  ast: object;
}
