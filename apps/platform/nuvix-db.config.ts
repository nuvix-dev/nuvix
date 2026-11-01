import type { NuvixDBConfig } from '@nuvix/db'
import { platformCollections } from './src/registry/collections'

/**
 * Drives `bun run gen:types` (the `nuvix-db` CLI — see package.json).
 * `platformCollections` is the single source of truth for this app's schema;
 * see `src/registry/collections.ts` for why it's shared with the runtime
 * bootstrap (`src/registry/setup.ts`) instead of duplicated here.
 */
const config: NuvixDBConfig = {
  collections: platformCollections,

  typeGeneration: {
    outputPath: './src/types/generated.ts',
    packageName: '@nuvix/db',
    includeDocTypes: true,
    generateUtilityTypes: true,
    generateInputTypes: true,
    generateQueryTypes: false,
  },

  options: {
    debug: false,
    strict: true,
  },
}

export default config
