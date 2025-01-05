import { IsNotEmpty, IsString } from "class-validator"


export class UpdatePaymentMethodDto {
  @IsNotEmpty()
  @IsString()
  paymentMethodId: string

  @IsNotEmpty()
  @IsString()
  expiryMonth: number

  @IsNotEmpty()
  @IsString()
  expiryYear: number
}