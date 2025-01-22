import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { PageInfo } from 'src/base/objects/base.object';

export interface IPaginatedType<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

export function Paginated<T>(classRef: Type<T>): Type<IPaginatedType<T>> {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedType implements IPaginatedType<T> {
    @Field(() => [classRef])
    nodes: T[];

    @Field()
    pageInfo: PageInfo;
  }
  return PaginatedType as Type<IPaginatedType<T>>;
}
