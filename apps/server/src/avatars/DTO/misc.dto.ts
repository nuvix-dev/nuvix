import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'
import {
  ArrayToLastElement,
  TransformStringToBoolean,
  TryTransformTo,
} from '@nuvix/core/validators'

export class CreditCardParamDTO {
  /**
   * Credit card code (e.g., 'visa', 'mastercard', etc.)
   */
  @IsString()
  @IsNotEmpty()
  declare code: string
}

export class BrowsersParamDTO {
  /**
   * Browser code (e.g., 'ch', 'ff', etc.)
   */
  @IsString()
  @IsNotEmpty()
  declare code: string
}

export class FlagsParamDTO {
  /**
   * Country code (e.g., 'us', 'in', etc.)
   */
  @IsString()
  @IsNotEmpty()
  declare code: string
}

export class InitialsQueryDTO {
  /**
   * User's name to generate initials from (e.g., 'John Doe')
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  declare name: string

  /**
   * Width of the generated avatar image (default: 100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('number')
  @IsNumber()
  @Min(1)
  @Max(2000)
  width = 100

  /**
   * Height of the generated avatar image (default: 100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('number')
  @IsNumber()
  @Min(1)
  @Max(2000)
  height = 100

  /**
   * Background color for the avatar (e.g., '#ff0000')
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  @Length(0, 7)
  declare background: string

  /**
   * Whether to generate a circular avatar (default: false)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TransformStringToBoolean()
  circle = false

  /**
   * Opacity of the generated avatar image (default: 100, range: 0-100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  opacity = 100

  /**
   * Quality of the generated avatar image (default: -1, range: 0-100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  quality = 100
}

export class CodesQuerDTO {
  /**
   * Width of the image (default: 100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(1)
  @Max(2000)
  width = 100

  /**
   * Height of the image (default: 100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(1)
  @Max(2000)
  height = 100

  /**
   * Quality of the image (default: 90, range: 0-100)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  quality = 90
}
