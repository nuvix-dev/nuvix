import { CreateBaseInput } from './create-base.input';
import { InputType, Field, Int, PartialType } from '@nestjs/graphql';

@InputType()
export class UpdateBaseInput extends PartialType(CreateBaseInput) {
  @Field(() => Int)
  id: number;
}
