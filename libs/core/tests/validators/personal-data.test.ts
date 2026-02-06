import { beforeEach, describe, expect, it } from 'vitest'
import { PersonalDataValidator } from '../../src/validators'

describe('PersonalData', () => {
  let validator: PersonalDataValidator | null = null

  describe('strict mode', () => {
    beforeEach(() => {
      validator = new PersonalDataValidator(
        'userId',
        'email@example.com',
        'name',
        '+129492323',
        true,
      )
    })

    it('should validate personal data in strict mode', () => {
      expect(validator?.$valid('userId')).toBe(false)
      expect(validator?.$valid('something.userId')).toBe(false)
      expect(validator?.$valid('userId.something')).toBe(false)
      expect(validator?.$valid('something.userId.something')).toBe(false)

      expect(validator?.$valid('email@example.com')).toBe(false)
      expect(validator?.$valid('something.email@example.com')).toBe(false)
      expect(validator?.$valid('email@example.com.something')).toBe(false)
      expect(validator?.$valid('something.email@example.com.something')).toBe(
        false,
      )

      expect(validator?.$valid('name')).toBe(false)
      expect(validator?.$valid('something.name')).toBe(false)
      expect(validator?.$valid('name.something')).toBe(false)
      expect(validator?.$valid('something.name.something')).toBe(false)

      expect(validator?.$valid('+129492323')).toBe(false)
      expect(validator?.$valid('something.+129492323')).toBe(false)
      expect(validator?.$valid('+129492323.something')).toBe(false)
      expect(validator?.$valid('something.+129492323.something')).toBe(false)

      expect(validator?.$valid('129492323')).toBe(false)
      expect(validator?.$valid('something.129492323')).toBe(false)
      expect(validator?.$valid('129492323.something')).toBe(false)
      expect(validator?.$valid('something.129492323.something')).toBe(false)

      expect(validator?.$valid('email')).toBe(false)
      expect(validator?.$valid('something.email')).toBe(false)
      expect(validator?.$valid('email.something')).toBe(false)
      expect(validator?.$valid('something.email.something')).toBe(false)

      // Test for success
      expect(validator?.$valid('893pu5egerfsv3rgersvd')).toBe(true)
    })
  })

  describe('non-strict mode', () => {
    beforeEach(() => {
      validator = new PersonalDataValidator(
        'userId',
        'email@example.com',
        'name',
        '+129492323',
        false,
      )
    })

    it('should validate personal data in non-strict mode', () => {
      expect(validator?.$valid('userId')).toBe(false)
      expect(validator?.$valid('USERID')).toBe(false)
      expect(validator?.$valid('something.USERID')).toBe(false)
      expect(validator?.$valid('USERID.something')).toBe(false)
      expect(validator?.$valid('something.USERID.something')).toBe(false)

      expect(validator?.$valid('email@example.com')).toBe(false)
      expect(validator?.$valid('EMAIL@EXAMPLE.COM')).toBe(false)
      expect(validator?.$valid('something.EMAIL@EXAMPLE.COM')).toBe(false)
      expect(validator?.$valid('EMAIL@EXAMPLE.COM.something')).toBe(false)
      expect(validator?.$valid('something.EMAIL@EXAMPLE.COM.something')).toBe(
        false,
      )

      expect(validator?.$valid('name')).toBe(false)
      expect(validator?.$valid('NAME')).toBe(false)
      expect(validator?.$valid('something.NAME')).toBe(false)
      expect(validator?.$valid('NAME.something')).toBe(false)
      expect(validator?.$valid('something.NAME.something')).toBe(false)

      expect(validator?.$valid('+129492323')).toBe(false)
      expect(validator?.$valid('129492323')).toBe(false)

      expect(validator?.$valid('email')).toBe(false)
      expect(validator?.$valid('EMAIL')).toBe(false)
      expect(validator?.$valid('something.EMAIL')).toBe(false)
      expect(validator?.$valid('EMAIL.something')).toBe(false)
      expect(validator?.$valid('something.EMAIL.something')).toBe(false)
    })
  })
})
