import { NuvixDBConfig } from '@nuvix/db';
import collections from '@nuvix/utils/collections';

const config: NuvixDBConfig = {
  collections: Array.from(
    new Set(
      [
        ...Object.values(collections.auth),
        ...Object.values(collections.project),
        ...Object.values(collections.database),
        ...Object.values(collections.bucket),
        ...Object.values(collections.console).map(collection =>
          collection.$id === 'teams'
            ? { ...collection, $id: 'organizations', name: 'organizations' }
            : Object.keys({ ...collections.auth, ...collections.common }).includes(collection.$id)
              ? undefined as any
              : collection,
        ),
      ].filter(Boolean).filter(c => c.attributes?.length > 0),
    ),
  ),

  typeGeneration: {
    outputPath: './libs/utils/types/generated.ts',
    packageName: '@nuvix/db',
    includeDocTypes: true,
    generateUtilityTypes: true,
    generateQueryTypes: false,
    generateInputTypes: true,
  },

  options: {
    debug: false,
    strict: true,
  },
};

export default config;
