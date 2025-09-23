import { IsString, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { IndexType, Order } from '@nuvix/db';
import { configuration } from '@nuvix/utils';

export class CreateIndexDTO {
  @IsString()
  key!: string;

  @IsIn([IndexType.Key, IndexType.FullText, IndexType.Unique])
  type!: string;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  attributes!: string[];

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsIn(Object.values(Order), { each: true })
  orders!: (string | null)[];
}
