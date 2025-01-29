import { IsString, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from 'src/Utils/constants';
import { Database } from '@nuvix/database';

export class CreateIndexDTO {
  @IsString()
  key: string;

  @IsIn([Database.INDEX_KEY, Database.INDEX_FULLTEXT, Database.INDEX_UNIQUE])
  type: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  attributes: string[];

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsIn(['ASC', 'DESC'], { each: true })
  orders: string[];
}
