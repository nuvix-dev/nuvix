import { describe, expect, test } from "bun:test";
import {
	generateOtp,
	generateRecoveryCodes,
	generateSecret,
	generateToken,
} from "./secret";

describe("generateSecret", () => {
	test("default: 128 hex chars (64 bytes)", () => {
		const secret = generateSecret();
		expect(secret).toHaveLength(128);
		expect(secret).toMatch(/^[0-9a-f]+$/);
	});

	test("custom byte length", () => {
		const secret = generateSecret(32);
		expect(secret).toHaveLength(64);
	});

	test("each call produces a different secret", () => {
		const a = generateSecret();
		const b = generateSecret();
		expect(a).not.toBe(b);
	});
});

describe("generateOtp", () => {
	test("default: 6 numeric digits", () => {
		const otp = generateOtp();
		expect(otp).toHaveLength(6);
		expect(otp).toMatch(/^\d{6}$/);
	});

	test("custom length", () => {
		const otp = generateOtp(8);
		expect(otp).toHaveLength(8);
		expect(otp).toMatch(/^\d{8}$/);
	});

	test("each call produces a different OTP (probabilistic)", () => {
		const otps = new Set(Array.from({ length: 20 }, () => generateOtp()));
		// With 6 digits (1M possibilities) and 20 samples, collision is ~0.02%
		expect(otps.size).toBeGreaterThan(15);
	});
});

describe("generateRecoveryCodes", () => {
	test("default: 6 codes of 10 alphanumeric chars", () => {
		const codes = generateRecoveryCodes();
		expect(codes).toHaveLength(6);
		for (const code of codes) {
			expect(code).toHaveLength(10);
			expect(code).toMatch(/^[a-z0-9]{10}$/);
		}
	});

	test("custom count and length", () => {
		const codes = generateRecoveryCodes(3, 8);
		expect(codes).toHaveLength(3);
		for (const code of codes) {
			expect(code).toHaveLength(8);
		}
	});

	test("codes are unique within a batch", () => {
		const codes = generateRecoveryCodes(10, 10);
		expect(new Set(codes).size).toBe(10);
	});
});

describe("generateToken", () => {
	test("default: 6 alphanumeric chars", () => {
		const token = generateToken();
		expect(token).toHaveLength(6);
		expect(token).toMatch(/^[a-z0-9]{6}$/);
	});

	test("custom length", () => {
		const token = generateToken(20);
		expect(token).toHaveLength(20);
	});
});
