process.env.NUVIX_PLATFORM_DB_DRIVER ??= "sqlite";
process.env.NUVIX_PLATFORM_DB_URL ??= ":memory:";
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??=
	"+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo=";

import { beforeAll, describe, expect, test } from "bun:test";
import { treaty } from "@elysia/eden";
import { FakeTenantProvisioner } from "@nuvix/core/tenants";
import { Elysia } from "elysia";
import { problemErrors } from "../../plugins/errors";
import { createPlatformDatabase } from "../../registry/setup";
import { projectRoutes } from "./routes";
import { ProjectService } from "./service";

/**
 * Composed the same way as `app.ts`, but with `FakeTenantProvisioner` in
 * place of `DockerTenantProvisioner` — route/composition coverage should
 * never depend on a real Docker host (that's `docker-provisioner.integration.test.ts`'s job).
 */
async function buildApp() {
	const db = await createPlatformDatabase();
	const service = new ProjectService(db, new FakeTenantProvisioner());
	const app = new Elysia().use(problemErrors()).use(projectRoutes(service));
	return treaty(app);
}

let client: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
	client = await buildApp();
});

describe("project routes", () => {
	test("POST /projects creates an active project", async () => {
		const { data, status } = await client.projects.post({ name: "Acme" });
		expect(status).toBe(200);
		expect(data?.name).toBe("Acme");
		expect(data?.status).toBe("active");
		expect(data?.publishableKey).toMatch(/^pk_[0-9a-f]{32}$/);
	});

	test("POST /projects rejects a missing name with 422", async () => {
		// @ts-expect-error — intentionally malformed body
		const { status } = await client.projects.post({});
		expect(status).toBe(422);
	});

	test("GET /projects lists with pagination meta", async () => {
		await client.projects.post({ name: "Listed" });
		const { data, status } = await client.projects.get({
			query: { limit: 1, offset: 0 },
		});
		expect(status).toBe(200);
		expect(data?.data.length).toBe(1);
		expect(data?.meta.total).toBeGreaterThanOrEqual(1);
	});

	test("GET /projects/:id returns 404 as problem+json for an unknown id", async () => {
		const { status, error } = await client.projects({ id: "missing" }).get();
		expect(status).toBe(404);
		expect(error?.value).toMatchObject({ code: "project_not_found" });
	});

	test("DELETE /projects/:id removes the project", async () => {
		const created = await client.projects.post({ name: "ToRemove" });
		const id = created.data!.$id;

		const del = await client.projects({ id }).delete();
		expect(del.status).toBe(204);

		const after = await client.projects({ id }).get();
		expect(after.status).toBe(404);
	});
});
