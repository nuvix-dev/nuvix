import { IsString, IsArray, ArrayMaxSize, IsEnum, IsIn } from 'class-validator';
import { IndexType, Order } from '@nuvix/db';
import { configuration } from '@nuvix/utils';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIndexDTO {
  @IsString()
  key!: string;

  @ApiProperty({ enum: IndexType })
  @IsEnum(IndexType)
  type!: IndexType;

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  attributes!: string[];

  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsIn([Order.Asc, Order.Desc, null], { each: true })
  @ApiProperty({ enum: [Order.Asc, Order.Desc, null], isArray: true })
  orders!: (Order | null)[];
}
