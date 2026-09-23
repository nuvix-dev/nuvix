/**
 * @nuvix/core/auth — shared auth primitives.
 *
 * Pure crypto helpers with no DB or framework dependency. Used by every
 * auth-related service (account, users, teams, sessions, tokens, MFA).
 */

// Token/secret hashing (SHA-256, for bearer credentials)
export { Auth, hashSecret, verifySecret } from "./hash";

// Password hashing (argon2id/bcrypt via Bun.password)
export {
	detectAlgorithm,
	type HashOptions,
	hashPassword,
	needsRehash,
	type PasswordAlgorithm,
	parseArgon2Options,
	verifyPassword,
} from "./password";

// Cryptographic random generation
export {
	generateOtp,
	generateRecoveryCodes,
	generateSecret,
	generateToken,
} from "./secret";

// Password quality validators
export {
	containsPersonalData,
	isPasswordRecentlyUsed,
	type PersonalData,
} from "./validators";
