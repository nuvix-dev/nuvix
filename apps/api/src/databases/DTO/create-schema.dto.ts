import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDocumentSchema {
  @ApiProperty({
    description: 'Schema name',
    example: 'my_schema',
    type: String,
    required: true,
    minLength: 1,
    maxLength: 255,
    pattern: '^[a-zA-Z0-9_]+$',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Schema description',
    example: 'This is my schema',
    type: String,
    required: false,
    minLength: 0,
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateSchema extends CreateDocumentSchema {
  @ApiProperty({
    description: 'Schema type, either managed or unmanaged',
    enum: ['managed', 'unmanaged'],
    example: 'managed',
  })
  @IsIn(['managed', 'unmanaged'])
  @IsNotEmpty()
  type: 'managed' | 'unmanaged' = 'managed';
}
