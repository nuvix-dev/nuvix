import { PasswordValidator } from './password.validator'

export class PersonalDataValidator extends PasswordValidator {
  constructor(
    private userId: string | null = null,
    private email: string | null = null,
    private name: string | null = null,
    private phone: string | null = null,
    private strict = false,
    allowEmpty = false,
  ) {
    super(allowEmpty)
  }

  override $description =
    'Password must not include any personal data like your name, email, phone number, etc.'

  /**
   * Is valid
   *
   * @param password - The password to validate
   *
   * @return boolean
   */
  override $valid(password: string): boolean {
    if (!super.$valid(password)) {
      return false
    }

    if (!this.strict) {
      password = password.toLowerCase()
      this.userId = this.userId?.toLowerCase() || null
      this.email = this.email?.toLowerCase() || null
      this.name = this.name?.toLowerCase() || null
      this.phone = this.phone?.toLowerCase() || null
    }

    if (this.userId && password.includes(this.userId)) {
      return false
    }

    if (this.email && password.includes(this.email)) {
      return false
    }

    if (
      this.email?.includes('@') &&
      password.includes(this.email.split('@')[0]!)
    ) {
      return false
    }

    if (this.name && password.includes(this.name)) {
      return false
    }

    if (this.phone && password.includes(this.phone.replace('+', ''))) {
      return false
    }

    if (this.phone && password.includes(this.phone)) {
      return false
    }

    return true
  }
}
