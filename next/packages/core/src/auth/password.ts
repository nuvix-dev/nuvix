/**
 * Password hashing and verification via `Bun.password` (D5).
 *
 * Bun.password supports argon2id and bcrypt natively — no external packages.
 * Per D29, only argon2id and bcrypt are supported; legacy algos (MD5, SHA,
 * phpass, scrypt) are intentionally not supported.
 *
 * The default algorithm is argon2id with Bun's built-in defaults
 * (memoryCost: 65536, timeCost: 2). On successful login, `needsRehash`
 * detects if the stored hash uses an older cost setting and signals that
 * a transparent re-hash should occur.
 */

export type PasswordAlgorithm = "argon2id" | "bcrypt";

export interface HashOptions {
	algorithm?: PasswordAlgorithm;
	/** Argon2 memory cost in KiB (default 65536 = 64 MiB). */
	memoryCost?: number;
	/** Argon2 time cost / iterations (default 2). */
	timeCost?: number;
}

const DEFAULT_ALGORITHM: PasswordAlgorithm = "argon2id";

/**
 * Hash a plaintext password with the specified algorithm.
 * Returns the encoded hash string (includes algorithm + cost params).
 */
export async function hashPassword(
	password: string,
	options: HashOptions = {},
): Promise<string> {
	const algo = options.algorithm ?? DEFAULT_ALGORITHM;
	if (algo === "bcrypt") {
		return Bun.password.hash(password, { algorithm: "bcrypt" });
	}
	return Bun.password.hash(password, {
		algorithm: "argon2id",
		memoryCost: options.memoryCost ?? 65536,
		timeCost: options.timeCost ?? 2,
	});
}

/**
 * Verify a plaintext password against a stored hash.
 * Works with both argon2id and bcrypt hashes (auto-detected by Bun).
 */
export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return Bun.password.verify(password, hash);
}

/**
 * Detect the algorithm from an encoded hash string.
 * Argon2 hashes start with `$argon2`; bcrypt with `$2`.
 */
export function detectAlgorithm(hash: string): PasswordAlgorithm | null {
	if (hash.startsWith("$argon2")) return "argon2id";
	if (hash.startsWith("$2")) return "bcrypt";
	return null;
}

/**
 * Parse the cost parameters from an argon2 hash string.
 * Returns `{ memoryCost, timeCost, parallelism }` or null if not parseable.
 */
export function parseArgon2Options(
	hash: string,
): { memoryCost: number; timeCost: number; parallelism: number } | null {
	// Argon2 hash format: $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>
	const match = hash.match(/\$argon2\w+\$v=\d+\$m=(\d+),t=(\d+),p=(\d+)\$/);
	if (!match?.[1] || !match?.[2] || !match?.[3]) return null;
	const memoryCost = Number.parseInt(match[1], 10);
	const timeCost = Number.parseInt(match[2], 10);
	const parallelism = Number.parseInt(match[3], 10);
	if (
		Number.isNaN(memoryCost) ||
		Number.isNaN(timeCost) ||
		Number.isNaN(parallelism)
	) {
		return null;
	}
	return { memoryCost, timeCost, parallelism };
}

/**
 * Check whether a stored hash needs to be re-hashed because its algorithm
 * or cost parameters don't match the current defaults. Called after a
 * successful login to transparently upgrade hash strength.
 */
export function needsRehash(
	hash: string,
	targetAlgorithm: PasswordAlgorithm = DEFAULT_ALGORITHM,
	targetOptions: HashOptions = {},
): boolean {
	const currentAlgo = detectAlgorithm(hash);
	if (currentAlgo !== targetAlgorithm) return true;

	if (targetAlgorithm === "argon2id") {
		const params = parseArgon2Options(hash);
		if (!params) return true;
		const wantMemory = targetOptions.memoryCost ?? 65536;
		const wantTime = targetOptions.timeCost ?? 2;
		return params.memoryCost !== wantMemory || params.timeCost !== wantTime;
	}

	// For bcrypt, Bun handles cost detection internally — we only check algo match.
	return false;
}
