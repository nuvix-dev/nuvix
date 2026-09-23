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

	test("authSession builds a second database once and reuses it, without any per-call schema check", () => {
		const authSession = {} as Session;
		let authDatabaseCalls = 0;

		const resource = new TenantResource("project-2", target, {
			createSql: () => ({ close: async () => {} }) as unknown as SQL,
			createDatabase: () =>
				({ for: () => ({}) as Session }) as unknown as Database,
			createAuthDatabase: () => {
				authDatabaseCalls++;
				return { for: () => authSession } as unknown as Database;
			},
		});

		expect(resource.authSession(["user:1"])).toBe(authSession);
		expect(resource.authSession(["guest"])).toBe(authSession);
		expect(authDatabaseCalls).toBe(1);
	});
});
