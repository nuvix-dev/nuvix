/**
 * @nuvix/core/auth — shared auth primitives.
 *
 * Pure crypto helpers with no DB or framework dependency. Used by every
 * auth-related service (account, users, teams, sessions, tokens, MFA).
 */

// Token/secret hashing (SHA-256, for bearer credentials)
export { Auth, hashSecret, verifySecret } from './hash'
// Password hashing (argon2id/bcrypt via Bun.password)
export {
  detectAlgorithm,
  type HashOptions,
  hashPassword,
  needsRehash,
  type PasswordAlgorithm,
  parseArgon2Options,
  verifyPassword,
} from './password'
// Cryptographic random generation
export {
  generateOtp,
  generateRecoveryCodes,
  generateSecret,
  generateToken,
} from './secret'
// Token types
export { TokenType } from './token-types'

// RFC-6238 TOTP (Web Crypto)
export {
  base32Decode,
  base32Encode,
  generateTotp,
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
} from './totp'

// Password quality validators
export {
  containsPersonalData,
  isPasswordRecentlyUsed,
  type PersonalData,
} from './validators'
