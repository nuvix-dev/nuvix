import { describe, expect, test } from "bun:test";
import {
	detectAlgorithm,
	hashPassword,
	needsRehash,
	parseArgon2Options,
	verifyPassword,
} from "./password";

describe("hashPassword + verifyPassword", () => {
	test("argon2id (default): hash and verify round-trip", async () => {
		const hash = await hashPassword("correct-horse-battery-staple");
		expect(hash).toContain("$argon2id$");
		expect(await verifyPassword("correct-horse-battery-staple", hash)).toBe(
			true,
		);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	test("bcrypt: hash and verify round-trip", async () => {
		const hash = await hashPassword("bcrypt-test", { algorithm: "bcrypt" });
		expect(hash).toMatch(/^\$2[aby]?\$/);
		expect(await verifyPassword("bcrypt-test", hash)).toBe(true);
		expect(await verifyPassword("wrong", hash)).toBe(false);
	});

	test("custom argon2 cost parameters", async () => {
		const hash = await hashPassword("custom-cost", {
			memoryCost: 32768,
			timeCost: 3,
		});
		const opts = parseArgon2Options(hash);
		expect(opts).not.toBeNull();
		if (!opts) throw new Error("Expected opts to be defined");
		expect(opts.memoryCost).toBe(32768);
		expect(opts.timeCost).toBe(3);
		expect(await verifyPassword("custom-cost", hash)).toBe(true);
	});
});

describe("detectAlgorithm", () => {
	test("detects argon2id", () => {
		expect(detectAlgorithm("$argon2id$v=19$m=65536,t=2,p=1$salt$hash")).toBe(
			"argon2id",
		);
	});

	test("detects bcrypt", () => {
		expect(detectAlgorithm("$2b$10$salthashblob")).toBe("bcrypt");
	});

	test("returns null for unknown", () => {
		expect(detectAlgorithm("plaintext")).toBeNull();
	});
});

describe("parseArgon2Options", () => {
	test("parses standard argon2 hash", () => {
		const opts = parseArgon2Options(
			"$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$someHash",
		);
		expect(opts).toEqual({ memoryCost: 65536, timeCost: 2, parallelism: 1 });
	});

	test("returns null for non-argon2 hash", () => {
		expect(parseArgon2Options("$2b$10$salthash")).toBeNull();
	});
});

describe("needsRehash", () => {
	test("returns true when algorithm differs", async () => {
		const bcryptHash = await hashPassword("test", { algorithm: "bcrypt" });
		expect(needsRehash(bcryptHash, "argon2id")).toBe(true);
	});

	test("returns false when algorithm and cost match defaults", async () => {
		const hash = await hashPassword("test");
		expect(needsRehash(hash)).toBe(false);
	});

	test("returns true when argon2 cost differs", async () => {
		const hash = await hashPassword("test", {
			memoryCost: 32768,
			timeCost: 3,
		});
		// Default target is memoryCost: 65536, timeCost: 2
		expect(needsRehash(hash)).toBe(true);
	});

	test("returns false when target matches custom cost", async () => {
		const hash = await hashPassword("test", {
			memoryCost: 32768,
			timeCost: 3,
		});
		expect(
			needsRehash(hash, "argon2id", { memoryCost: 32768, timeCost: 3 }),
		).toBe(false);
	});
});
