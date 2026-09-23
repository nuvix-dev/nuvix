import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Cache, Memory } from "@nuvix/cache";
import { Adapter, Database, Doc, SQLiteAdapter } from "@nuvix/db";
import { registerCoreDbFilters } from "../db";
import { decodeEncryptionKey } from "../tenants";
import { platformCollections } from "./collections";

export interface PlatformDatabaseOptions {
	driver: "sqlite" | "postgres";
	url: string;
	encryptionKey: string;
}

async function createAdapter(
	options: PlatformDatabaseOptions,
): Promise<Adapter | SQLiteAdapter> {
	if (options.driver === "postgres") {
		const adapter = new Adapter(options.url);
		// Required: `@nuvix/db` folds an unset namespace into table names as the
		// literal string "undefined" on Postgres, which breaks its own internal
		// metadata bookkeeping (surfaced as a "relation ...undefined... does not
		// exist" error the first time a fresh schema is bootstrapped).
		adapter.setMeta({ namespace: "platform" });
		return adapter;
	}

	if (options.url !== ":memory:") {
		await mkdir(path.dirname(options.url), { recursive: true });
	}
	return new SQLiteAdapter(options.url);
}

export async function ensurePlatformSchema(db: Database): Promise<void> {
	if (!(await db.exists())) await db.create();

	for (const collection of platformCollections) {
		if (await db.exists(undefined, collection.$id)) continue;
		await db.createCollection({
			id: collection.$id,
			attributes: collection.attributes.map((attribute) => new Doc(attribute)),
			indexes: collection.indexes.map((index) => new Doc(index)),
			permissions: [],
			documentSecurity: collection.documentSecurity,
			enabled: collection.enabled,
		});
	}
}

export async function createPlatformDatabase(
	options: PlatformDatabaseOptions,
): Promise<Database> {
	registerCoreDbFilters(decodeEncryptionKey(options.encryptionKey));
	const db = new Database(
		await createAdapter(options),
		new Cache(new Memory()),
	);
	await ensurePlatformSchema(db);
	return db;
}
