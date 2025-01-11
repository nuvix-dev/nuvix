import { IsArray, IsInt, Max, Min } from "class-validator";


export class CreateJwtDto {

  @IsArray()
  scopes: string[]

  @IsInt()
  @Min(0)
  @Max(3600)
  duration: number;
}