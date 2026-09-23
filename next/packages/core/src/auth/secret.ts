/**
 * Cryptographically secure random secret/token/OTP generation.
 *
 * Every bearer credential is generated here — session secrets, invite
 * secrets, verification tokens, magic-URL tokens, phone OTPs, recovery
 * codes. All use `crypto.getRandomValues` (Web Crypto API, native in Bun).
 */

const HEX_CHARS = "0123456789abcdef";
const ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a cryptographically random hex string of `byteLength` bytes
 * (returned as `byteLength * 2` hex chars).
 *
 * Default 64 bytes = 128 hex chars = 512 bits of entropy — suitable for
 * session secrets and any high-security bearer token.
 */
export function generateSecret(byteLength = 64): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	let hex = "";
	for (const byte of bytes) {
		hex += HEX_CHARS[byte >> 4];
		hex += HEX_CHARS[byte & 0x0f];
	}
	return hex;
}

/**
 * Generate a numeric OTP (one-time password) of `length` digits.
 * Used for email-OTP, phone-OTP, and MFA challenge codes.
 *
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateOtp(length = 6): string {
	let result = "";
	const bytes = new Uint8Array(length);
	while (result.length < length) {
		crypto.getRandomValues(bytes);
		for (const byte of bytes) {
			// Reject values >= 250 to avoid modulo bias with 10 digits.
			// 250 is the largest multiple of 10 <= 255.
			if (byte < 250 && result.length < length) {
				result += String(byte % 10);
			}
		}
	}
	return result;
}

/**
 * Generate a set of recovery codes.
 *
 * Each code is `codeLength` alphanumeric characters. By default generates
 * 6 codes of 10 characters each (v1 parity).
 */
export function generateRecoveryCodes(count = 6, codeLength = 10): string[] {
	const codes: string[] = [];
	for (let i = 0; i < count; i++) {
		let code = "";
		const bytes = new Uint8Array(codeLength * 2); // over-allocate for rejection sampling
		while (code.length < codeLength) {
			crypto.getRandomValues(bytes);
			for (const byte of bytes) {
				// Reject values >= 252 (36 * 7 = 252) to avoid modulo bias with 36 chars.
				if (byte < 252 && code.length < codeLength) {
					code += ALPHANUMERIC[byte % 36];
				}
			}
		}
		codes.push(code);
	}
	return codes;
}

/**
 * Generate a random alphanumeric string of `length` characters.
 * Used for generic tokens with configurable length (4–128 chars per contract).
 */
export function generateToken(length = 6): string {
	let result = "";
	const bytes = new Uint8Array(length * 2);
	while (result.length < length) {
		crypto.getRandomValues(bytes);
		for (const byte of bytes) {
			if (byte < 252 && result.length < length) {
				result += ALPHANUMERIC[byte % 36];
			}
		}
	}
	return result;
}
