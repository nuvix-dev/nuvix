import { Adapter, Database, type Session } from "@nuvix/db";
import { SQL } from "bun";
import { createAuthDatabase } from "../tenant-auth";
import { createTenantCacheFactory, type TenantCacheFactory } from "./cache";
import type { TenantTarget } from "./types";

export interface TenantResourceDependencies {
	createSql?: (target: TenantTarget) => SQL;
	createDatabase?: (
		sql: SQL,
		cache: ReturnType<TenantCacheFactory["forTenant"]>,
	) => Database;
	createAuthDatabase?: (
		sql: SQL,
		cache: ReturnType<TenantCacheFactory["forTenant"]>,
	) => Database;
	/** Shared across every `TenantResource` a pool constructs — resolved once, not per tenant. */
	cacheFactory?: TenantCacheFactory;
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

function createDatabase(
	sql: SQL,
	cache: ReturnType<TenantCacheFactory["forTenant"]>,
): Database {
	return new Database(new Adapter(sql), cache);
}

const defaultCacheFactory = createTenantCacheFactory();

/**
 * Owns one tenant's connection pool and document-plane database facades.
 * The same Bun `SQL` instance is injected into `@nuvix/db`; because the
 * adapter did not construct it, this resource remains its sole lifecycle
 * owner and closes it exactly once.
 *
 * The `auth` schema (users/sessions/teams/… — `@nuvix/core/tenant-auth`) is
 * bootstrapped exactly once, at project-creation time (the platform app's
 * `ProjectService` calls `bootstrapAuthSchema` directly against the fresh
 * tenant), never lazily here — `authSession` assumes the schema already
 * exists and does no readiness/exists check per call.
 */
export class TenantResource {
	private readonly sql: SQL;
	private readonly db: Database;
	private authDb?: Database;
	private closePromise?: Promise<void>;
	private readonly dependencies: TenantResourceDependencies;

	constructor(
		readonly projectId: string,
		target: TenantTarget,
		dependencies: TenantResourceDependencies = {},
	) {
		this.dependencies = dependencies;
		const cacheFactory = dependencies.cacheFactory ?? defaultCacheFactory;
		this.sql = (dependencies.createSql ?? createSql)(target);
		this.db = (dependencies.createDatabase ?? createDatabase)(
			this.sql,
			cacheFactory.forTenant(`tenant:${projectId}:default`),
		);
	}

	/** Creates a caller-scoped document session without exposing `Database.system()`. */
	session(roles: readonly string[]): Session {
		return this.db.for([...roles]);
	}

	/**
	 * Caller-scoped session over the dedicated `auth` schema. Bound on a
	 * second `Adapter` sharing this resource's one `SQL` pool (schema
	 * selection lives on mutable adapter state, so a second, dedicated
	 * adapter avoids racing the default schema against concurrent requests —
	 * see `tenant-auth/schema.ts`). Constructing it is a cheap, I/O-free
	 * object creation, cached after the first call — no per-call schema
	 * check, since provisioning already guaranteed it exists.
	 */
	authSession(roles: readonly string[]): Session {
		const cacheFactory = this.dependencies.cacheFactory ?? defaultCacheFactory;
		this.authDb ??= (
			this.dependencies.createAuthDatabase ?? createAuthDatabase
		)(this.sql, cacheFactory.forTenant(`tenant:${this.projectId}:auth`));
		return this.authDb.for([...roles]);
	}

	close(): Promise<void> {
		this.closePromise ??= this.sql.close();
		return this.closePromise;
	}
}
