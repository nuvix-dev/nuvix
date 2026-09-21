import { describe, expect, test } from "bun:test";

// app.ts reads config.jwtSecret at import time (config's other fields are
// lazy getters — see packages/utils/src/config.ts — so only vars actually
// read at import time need seeding here).
process.env.NUVIX_JWT_SECRET ||= "test-secret";

const { app } = await import("../src/app");

describe("openapi", () => {
	test("serves spec including registered routes", async () => {
		const res = await app.handle(new Request("http://x/v2/openapi/json"));
		expect(res.status).toBe(200);

		const spec = (await res.json()) as { paths: Record<string, unknown> };
		expect(Object.keys(spec.paths)).toContain("/v2/health");
	});

	test("serves scalar UI", async () => {
		const res = await app.handle(new Request("http://x/v2/openapi"));
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("<html");
	});
});
