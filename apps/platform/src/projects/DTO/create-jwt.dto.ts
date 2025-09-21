import { IsArray, IsInt, Max, Min } from 'class-validator';

export class CreateJwtDTO {
  @IsArray()
  declare scopes: string[];

  @IsInt()
  @Min(0)
  @Max(3600)
  declare duration: number;
}
