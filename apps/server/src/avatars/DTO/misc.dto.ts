import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator'
import {
  ArrayToLastElement,
  TransformStringToBoolean,
  TryTransformTo,
} from 'libs/core/src/validators'

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
  @ArrayToLastElement()
  @IsString()
  declare name: string

  /**
   * Width of the generated avatar image (default: 100)
   */
  @ArrayToLastElement()
  @TryTransformTo('number')
  @IsNumber()
  @Min(1)
  @Max(2000)
  width: number = 100

  /**
   * Height of the generated avatar image (default: 100)
   */
  @ArrayToLastElement()
  @TryTransformTo('number')
  @IsNumber()
  @Min(1)
  @Max(2000)
  height: number = 100

  /**
   * Background color for the avatar (e.g., '#ff0000')
   */
  @ArrayToLastElement()
  @IsString()
  background: string = ''

  /**
   * Whether to generate a circular avatar (default: false)
   */
  @ArrayToLastElement()
  @TransformStringToBoolean()
  circle: boolean = false

  /**
   * Opacity of the generated avatar image (default: 100, range: 0-100)
   */
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  opacity: number = 100

  /**
   * Quality of the generated avatar image (default: -1, range: 0-100)
   */
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  quality: number = 100
}

export class CodesQuerDTO {
  /**
   * Width of the image (default: 100)
   */
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(1)
  @Max(2000)
  width: number = 100

  /**
   * Height of the image (default: 100)
   */
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(1)
  @Max(2000)
  height: number = 100

  /**
   * Quality of the image (default: 90, range: 0-100)
   */
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  @Min(0)
  @Max(100)
  quality: number = 90
}
