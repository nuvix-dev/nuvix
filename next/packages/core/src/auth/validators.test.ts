import { describe, expect, it } from "bun:test";
import { hashPassword } from "./password";
import { containsPersonalData, isPasswordRecentlyUsed } from "./validators";

describe("containsPersonalData", () => {
	it("rejects password containing user id", () => {
		expect(
			containsPersonalData("mySecret-usr_12345-pw", { userId: "usr_12345" }),
		).toBe(true);
	});

	it("rejects password containing email local part", () => {
		expect(
			containsPersonalData("aliceInWonderland123", {
				email: "alice@example.com",
			}),
		).toBe(true);
	});

	it("rejects password containing name parts", () => {
		expect(
			containsPersonalData("super-johndoe-pass", { name: "John Doe" }),
		).toBe(true);
		expect(containsPersonalData("passDoe123", { name: "John Doe" })).toBe(true);
	});

	it("rejects password containing phone digits", () => {
		expect(
			containsPersonalData("pass19876543210word", {
				phone: "+1 (987) 654-3210",
			}),
		).toBe(true);
	});

	it("allows passwords with no matching personal data", () => {
		expect(
			containsPersonalData("completely-random-password-99!", {
				userId: "usr_999",
				email: "someone@else.com",
				name: "Alice Smith",
				phone: "+1234567890",
			}),
		).toBe(false);
	});

	it("ignores short fragments under 3 characters", () => {
		expect(containsPersonalData("passwordLi", { name: "Bo Li" })).toBe(false);
	});
});

describe("isPasswordRecentlyUsed", () => {
	it("returns false if maxHistory is 0", async () => {
		const hash = await hashPassword("secret123");
		expect(await isPasswordRecentlyUsed("secret123", [hash], 0)).toBe(false);
	});

	it("returns false if history is empty", async () => {
		expect(await isPasswordRecentlyUsed("secret123", [], 5)).toBe(false);
	});

	it("detects recently used password in history within limit", async () => {
		const hash1 = await hashPassword("oldSecret1");
		const hash2 = await hashPassword("oldSecret2");
		const hash3 = await hashPassword("oldSecret3");

		expect(
			await isPasswordRecentlyUsed("oldSecret2", [hash1, hash2, hash3], 2),
		).toBe(true);
		expect(
			await isPasswordRecentlyUsed("oldSecret3", [hash1, hash2, hash3], 2),
		).toBe(false);
	});
});
