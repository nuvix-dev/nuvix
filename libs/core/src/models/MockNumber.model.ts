import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MockNumberModel extends BaseModel {
  /**
   * Mock phone number for testing phone authentication. Useful for testing phone authentication without sending an SMS.
   */
  @Expose() phone: string = '' // Default to empty string

  /**
   * Mock OTP for the number.
   */
  @Expose() otp: string = '' // Default to empty string

  constructor(partial: Partial<MockNumberModel>) {
    super()
    Object.assign(this, partial)
  }
}
