import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFeedbackDTO {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  type: string = 'platform';
}
