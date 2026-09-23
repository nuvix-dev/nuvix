import { describe, expect, test } from "bun:test";
import { Doc } from "@nuvix/db";
import {
	createEncryptFilter,
	jsonFilter,
	registerAccountDbFilters,
	registerCoreDbFilters,
} from "./filters";

const document = new Doc({});

describe("jsonFilter", () => {
	test("round-trips a plain object through encode/decode", () => {
		const encoded = jsonFilter.encode(
			{ host: "db", port: 5432 },
			document,
			undefined as never,
		);
		expect(typeof encoded).toBe("string");
		expect(
			jsonFilter.decode(encoded as string, document, undefined as never),
		).toEqual({
			host: "db",
			port: 5432,
		});
	});

	test("encodes null/undefined to null", () => {
		expect(jsonFilter.encode(null, document, undefined as never)).toBeNull();
		expect(
			jsonFilter.encode(undefined, document, undefined as never),
		).toBeNull();
	});

	test("decode passes non-strings through unchanged", () => {
		expect(jsonFilter.decode(42, document, undefined as never)).toBe(42);
	});
});

describe("createEncryptFilter", () => {
	const key = crypto.getRandomValues(new Uint8Array(32));
	const filter = createEncryptFilter(key);

	test("round-trips a string through encode/decode", async () => {
		const encoded = await filter.encode(
			"super-secret",
			document,
			undefined as never,
		);
		expect(encoded).not.toBe("super-secret");
		expect(
			await filter.decode(encoded as string, document, undefined as never),
		).toBe("super-secret");
	});

	test("composes with jsonFilter to encrypt structured data (json → encrypt order)", async () => {
		const stringified = jsonFilter.encode(
			{ password: "p@ss" },
			document,
			undefined as never,
		) as string;
		const encrypted = await filter.encode(
			stringified,
			document,
			undefined as never,
		);

		const decrypted = await filter.decode(
			encrypted as string,
			document,
			undefined as never,
		);
		expect(
			jsonFilter.decode(decrypted as string, document, undefined as never),
		).toEqual({
			password: "p@ss",
		});
	});

	test("non-string encode input becomes null", async () => {
		expect(
			await filter.encode(undefined, document, undefined as never),
		).toBeNull();
	});
});

describe("registerCoreDbFilters", () => {
	test("is idempotent — registering twice in the same process does not throw", () => {
		const key = crypto.getRandomValues(new Uint8Array(32));
		expect(() => {
			registerCoreDbFilters(key);
			registerCoreDbFilters(key);
		}).not.toThrow();
	});
});

describe("registerAccountDbFilters", () => {
	test("registers accountEncrypt under a separate key from registerCoreDbFilters, idempotently", () => {
		const key = crypto.getRandomValues(new Uint8Array(32));
		expect(() => {
			registerAccountDbFilters(key);
			registerAccountDbFilters(key);
		}).not.toThrow();
	});
});
