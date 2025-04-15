import { InputType, Int, Field } from '@nestjs/graphql';

@InputType()
export class CreateBaseInput {
  @Field(() => Int, { description: 'Example field (placeholder)' })
  exampleField: number;
}
