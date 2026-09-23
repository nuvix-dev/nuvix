import { describe, expect, test } from "bun:test";
import { Auth, hashSecret, verifySecret } from "./hash";

describe("hashSecret", () => {
	test("produces a 64-char hex string (SHA-256)", () => {
		const hash = hashSecret("test-secret");
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	test("is deterministic", () => {
		expect(hashSecret("same")).toBe(hashSecret("same"));
	});

	test("different inputs produce different hashes", () => {
		expect(hashSecret("a")).not.toBe(hashSecret("b"));
	});

	test("empty string is hashable", () => {
		const hash = hashSecret("");
		expect(hash).toHaveLength(64);
	});
});

describe("verifySecret", () => {
	test("returns true for matching secret", () => {
		const secret = "my-session-secret-abc123";
		const hash = hashSecret(secret);
		expect(verifySecret(secret, hash)).toBe(true);
	});

	test("returns false for wrong secret", () => {
		const hash = hashSecret("correct-secret");
		expect(verifySecret("wrong-secret", hash)).toBe(false);
	});

	test("returns false for truncated hash", () => {
		const hash = hashSecret("secret");
		expect(verifySecret("secret", hash.slice(0, 32))).toBe(false);
	});
});

describe("Auth namespace", () => {
	test("Auth.hash is hashSecret", () => {
		expect(Auth.hash).toBe(hashSecret);
	});

	test("Auth.verify is verifySecret", () => {
		expect(Auth.verify).toBe(verifySecret);
	});
});
