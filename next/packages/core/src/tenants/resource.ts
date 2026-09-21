import { Cache, Memory } from "@nuvix/cache";
import { Adapter, Database, type Session } from "@nuvix/db";
import { SQL } from "bun";
import type { TenantTarget } from "./types";

export interface TenantResourceDependencies {
	createSql?: (target: TenantTarget) => SQL;
	createDatabase?: (sql: SQL) => Database;
}

function createSql(target: TenantTarget): SQL {
	return new SQL({
		hostname: target.host,
		port: target.port,
		database: target.database,
		username: target.user,
		password: target.password,
	});
}

function createDatabase(sql: SQL): Database {
	return new Database(new Adapter(sql), new Cache(new Memory()));
}

/**
 * Owns one tenant's connection pool and document-plane database facade.
 * The same Bun `SQL` instance is injected into `@nuvix/db`; because the
 * adapter did not construct it, this resource remains its sole lifecycle
 * owner and closes it exactly once.
 */
export class TenantResource {
	private readonly sql: SQL;
	private readonly db: Database;
	private closePromise?: Promise<void>;

	constructor(
		readonly projectId: string,
		target: TenantTarget,
		dependencies: TenantResourceDependencies = {},
	) {
		this.sql = (dependencies.createSql ?? createSql)(target);
		this.db = (dependencies.createDatabase ?? createDatabase)(this.sql);
	}

	/** Creates a caller-scoped document session without exposing `Database.system()`. */
	session(roles: readonly string[]): Session {
		return this.db.for([...roles]);
	}

	close(): Promise<void> {
		this.closePromise ??= this.sql.close();
		return this.closePromise;
	}
}
