import { IsString, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { APP_LIMIT_ARRAY_PARAMS_SIZE } from '@nuvix/utils';
import { IndexType, Order } from '@nuvix-tech/db';

export class CreateIndexDTO {
  @IsString()
  key!: string;

  @IsIn([IndexType.Key, IndexType.FullText, IndexType.Unique])
  type!: string;

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsString({ each: true })
  attributes!: string[];

  @IsArray()
  @ArrayMaxSize(APP_LIMIT_ARRAY_PARAMS_SIZE)
  @IsIn(Object.values(Order), { each: true })
  orders!: (string | null)[];
}
