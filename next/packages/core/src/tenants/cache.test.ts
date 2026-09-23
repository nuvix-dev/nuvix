import { describe, expect, test } from "bun:test";
import { createTenantCacheFactory } from "./cache";

describe("createTenantCacheFactory", () => {
	test("without a redis URL, returns an independent in-memory cache per tenant", async () => {
		const factory = createTenantCacheFactory();
		const a = factory.forTenant("tenant:a");
		const b = factory.forTenant("tenant:b");

		await a.set("key", { value: 1 });
		expect(await a.get<{ value: number }>("key")).toEqual({ value: 1 });
		expect(await b.get("key")).toBeNull();

		await factory.close();
	});

	test("close() is safe to call when no redis client was ever created", async () => {
		const factory = createTenantCacheFactory();
		await expect(factory.close()).resolves.toBeUndefined();
	});
});
