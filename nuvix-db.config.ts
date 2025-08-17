import { NuvixDBConfig } from '@nuvix-tech/db/config';
import collections from '@nuvix/utils/collections';

const config: NuvixDBConfig = {
  collections: Array.from(
    new Set(
      [
        ...Object.values(collections.project),
        ...Object.values(collections.database),
        ...Object.values(collections.bucket),
        ...Object.values(collections.console).map(collection =>
          collection.$id === 'teams'
            ? { ...collection, $id: 'organizations', name: 'organizations' }
            : collection,
        ),
      ].filter(c => c.attributes?.length > 0),
    ),
  ),

  typeGeneration: {
    outputPath: './libs/utils/types/generated.ts',
    packageName: '@nuvix-tech/db',
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
