import { describe, expect, test } from "bun:test";
import { Cache, Memory } from "@nuvix/cache";
import { Doc } from "@nuvix/db";
import { SQL } from "bun";
import { DockerTenantProvisioner } from "../tenants/docker-provisioner";
import { authCollections } from "./collections";
import {
	AUTH_SCHEMA,
	bootstrapAuthSchema,
	createAuthDatabase,
	ensureAuthSchema,
} from "./schema";

/**
 * Live integration coverage against a REAL `nuvix/postgres:18.1` container
 * (AGENTS.md). Requires a reachable Docker daemon with that image already
 * present — skipped (not faked) when Docker isn't available.
 */
async function dockerAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(
			["docker", "image", "inspect", "nuvix/postgres:18.1"],
			{
				stdout: "ignore",
				stderr: "ignore",
			},
		);
		return (await proc.exited) === 0;
	} catch {
		return false;
	}
}

const hasDocker = await dockerAvailable();

describe.skipIf(!hasDocker)(
	"bootstrapAuthSchema (live nuvix/postgres:18.1)",
	() => {
		test("creates the auth schema + every collection exactly once, and is safe to re-run", async () => {
			const provisioner = new DockerTenantProvisioner();
			const projectId = `it-authschema-${crypto.randomUUID().slice(0, 8)}`;
			const { handle, target } = await provisioner.provision({ projectId });

			try {
				await provisioner.waitUntilReady(target, { timeoutMs: 30_000 });

				// This is the one-shot, project-creation-time call — not a per-request path.
				await bootstrapAuthSchema(target);

				const sql = new SQL({
					hostname: target.host,
					port: target.port,
					database: target.database,
					username: target.user,
					password: target.password,
				});
				try {
					const rows =
						await sql`select schema_name from information_schema.schemata where schema_name = ${AUTH_SCHEMA}`;
					expect(rows.length).toBe(1);

					const db = createAuthDatabase(sql, new Cache(new Memory()));
					for (const collection of authCollections) {
						expect(await db.exists(undefined, collection.$id)).toBe(true);
					}

					// Idempotent: re-running against an already-bootstrapped tenant is a no-op, not an error.
					await ensureAuthSchema(db);

					// End-to-end smoke: the schema is actually usable for document writes.
					const system = db.system();
					const user = await system.createDocument(
						"users",
						new Doc({
							$id: "smoke-user",
							$permissions: [],
							email: "smoke@example.com",
							status: true,
						}),
					);
					expect(user.get("email")).toBe("smoke@example.com");
				} finally {
					await sql.close();
				}
			} finally {
				await provisioner.deprovision(handle, { purge: true });
			}
		}, 60_000);
	},
);
