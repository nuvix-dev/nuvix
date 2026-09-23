/**
 * Cryptographic token/secret hashing helpers.
 *
 * Every bearer credential stored at rest (session secrets, invite secrets,
 * verification tokens, recovery codes) goes through `Auth.hash()` before
 * persistence and `Auth.verify()` at presentation time. The scheme is a
 * straightforward SHA-256 hex digest — fast enough for high-entropy random
 * secrets (unlike passwords, which need intentionally slow KDFs — see
 * `./password.ts`). Verification uses constant-time comparison via Bun's
 * native `Bun.CryptoHasher` + `crypto.timingSafeEqual`.
 */

const encoder = new TextEncoder();

/**
 * SHA-256 hash of a raw secret, returned as lowercase hex.
 * Used for session secrets, token secrets, invite secrets, API keys — any
 * high-entropy random bearer credential that needs to be stored hashed
 * and looked up by hash.
 */
export function hashSecret(secret: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(encoder.encode(secret));
	return hasher.digest("hex");
}

/**
 * Constant-time comparison of a plaintext secret against its stored hash.
 * Returns `true` if `hashSecret(plain) === storedHash`.
 */
export function verifySecret(plain: string, storedHash: string): boolean {
	const computed = hashSecret(plain);
	// Both are fixed-length hex strings (64 chars for SHA-256).
	if (computed.length !== storedHash.length) return false;
	// Constant-time comparison — prevent timing side-channels.
	// Same approach as utils/jwt.ts's timingSafeEqual.
	let diff = 0;
	for (let i = 0; i < computed.length; i++) {
		diff |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
	}
	return diff === 0;
}

/** Convenience namespace matching the legacy `Auth.hash()` / `Auth.verify()` pattern. */
export const Auth = {
	hash: hashSecret,
	verify: verifySecret,
} as const;
