import { describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { DockerTenantProvisioner } from "./docker-provisioner";

/**
 * Live integration coverage against a REAL `nuvix/postgres:18.1` container
 * (AGENTS.md: "Live tenant behavior must be tested against exactly
 * nuvix/postgres:18.1 and must not be simulated while reported as
 * integration coverage."). Requires a reachable Docker daemon with that
 * image already present — skipped (not faked) when Docker isn't available.
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
	"DockerTenantProvisioner (live nuvix/postgres:18.1)",
	() => {
		test("provisions a real container, becomes queryable, then deprovisions cleanly", async () => {
			const provisioner = new DockerTenantProvisioner();
			const projectId = `it-${crypto.randomUUID().slice(0, 8)}`;

			const { handle, target } = await provisioner.provision({ projectId });
			expect(handle.containerName).toBe(`nuvix-tenant-${projectId}`);
			expect(target.port).toBeGreaterThan(0);

			try {
				await provisioner.waitUntilReady(target, { timeoutMs: 30_000 });

				const sql = new SQL({
					hostname: target.host,
					port: target.port,
					database: target.database,
					username: target.user,
					password: target.password,
				});
				try {
					// Confirms the image's first-boot bootstrap actually ran — not just
					// that the process is listening (matches the Database/Schemas
					// domain's real dependency: system.create_schema / cleanup_schema).
					const rows =
						await sql`select proname from pg_proc join pg_namespace on pg_proc.pronamespace = pg_namespace.oid where nspname = 'system' order by proname`;
					const names = rows.map((r: { proname: string }) => r.proname);
					expect(names).toContain("create_schema");
					expect(names).toContain("cleanup_schema");
				} finally {
					await sql.close();
				}
			} finally {
				await provisioner.deprovision(handle, { purge: true });
			}
		}, 60_000);

		test("deprovision keeps the volume by default, purge removes it", async () => {
			const provisioner = new DockerTenantProvisioner();
			const projectId = `it-${crypto.randomUUID().slice(0, 8)}`;
			const { handle } = await provisioner.provision({ projectId });

			await provisioner.deprovision(handle);
			const keptVolume = await Bun.spawn(
				["docker", "volume", "inspect", handle.volumeName],
				{
					stdout: "ignore",
					stderr: "ignore",
				},
			).exited;
			expect(keptVolume).toBe(0);

			await provisioner.deprovision(handle, { purge: true });
			const purgedVolume = await Bun.spawn(
				["docker", "volume", "inspect", handle.volumeName],
				{
					stdout: "ignore",
					stderr: "ignore",
				},
			).exited;
			expect(purgedVolume).not.toBe(0);
		}, 30_000);
	},
);
