import { authCollections } from "@nuvix/core/tenant-auth";
import type { NuvixDBConfig } from "@nuvix/db";

/**
 * Drives `bun run gen:types` (the `nuvix-db` CLI — see package.json).
 */
const config: NuvixDBConfig = {
	collections: authCollections,

	typeGeneration: {
		outputPath: "./src/types/generated.ts",
		packageName: "@nuvix/db",
		includeDocTypes: true,
		generateUtilityTypes: true,
		generateInputTypes: true,
		generateQueryTypes: false,
	},

	options: {
		debug: false,
		strict: true,
	},
};

export default config;
