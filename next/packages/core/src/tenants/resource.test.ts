import { describe, expect, test } from "bun:test";
import type { Database, Session } from "@nuvix/db";
import type { SQL } from "bun";
import { TenantResource } from "./resource";
import type { TenantTarget } from "./types";

const target: TenantTarget = {
	host: "localhost",
	port: 5432,
	database: "tenant",
	user: "nuvix_admin",
	password: "secret",
};

describe("TenantResource", () => {
	test("injects its sole SQL handle into the database and closes it once", async () => {
		let databaseSql: SQL | undefined;
		let closeCalls = 0;
		const sql = {
			close: async () => {
				closeCalls++;
			},
		} as unknown as SQL;
		const session = {} as Session;

		const resource = new TenantResource("project-1", target, {
			createSql: () => sql,
			createDatabase: (input) => {
				databaseSql = input;
				return { for: () => session } as unknown as Database;
			},
		});

		expect(databaseSql).toBe(sql);
		expect(resource.session(["user:1"])).toBe(session);
		await Promise.all([resource.close(), resource.close()]);
		expect(closeCalls).toBe(1);
	});
});
