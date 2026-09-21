import { describe, expect, test } from "bun:test";
import type { Database } from "@nuvix/db";
import type { SQL } from "bun";
import type { ResolvedProject } from "../platform";
import { TenantResourcePool } from "./pool";

function project(id: string): ResolvedProject {
	return {
		id,
		target: {
			host: "localhost",
			port: 5432,
			database: id,
			user: "nuvix_admin",
			password: "secret",
		},
	};
}

describe("TenantResourcePool", () => {
	test("reuses resources and evicts the least-recently-used tenant", async () => {
		const closed: string[] = [];
		const pool = new TenantResourcePool({
			max: 2,
			dependencies: {
				createSql: (target) =>
					({
						close: async () => {
							closed.push(target.database);
						},
					}) as unknown as SQL,
				createDatabase: () => ({}) as Database,
			},
		});

		const first = await pool.get(project("first"));
		await pool.get(project("second"));
		expect(await pool.get(project("first"))).toBe(first);

		await pool.get(project("third"));
		expect(closed).toEqual(["second"]);

		await pool.close();
		expect(closed.sort()).toEqual(["first", "second", "third"]);
	});

	test("rejects an invalid capacity", () => {
		expect(() => new TenantResourcePool({ max: 0 })).toThrow(
			/positive integer/,
		);
	});
});
