import { IsString } from 'class-validator';

export class ColumnIdParamDto {
  @IsString()
  id: string;
}
