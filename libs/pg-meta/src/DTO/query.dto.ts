import { IsObject, IsString } from 'class-validator';

export class QueryDto {
  @IsString()
  query: string;
}

export class DeparseDto {
  @IsObject()
  ast: object;
}
