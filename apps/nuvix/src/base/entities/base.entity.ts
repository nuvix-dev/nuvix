import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class Base {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
