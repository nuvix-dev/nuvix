import { ASSETS } from '@nuvix/utils/constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const _dirname = join(ASSETS.ROOT, 'sql');

export const columnPrivilegesSql = readFileSync(
  join(_dirname, 'column_privileges.sql'),
  'utf-8',
);
export const columnsSql = readFileSync(join(_dirname, 'columns.sql'), 'utf-8');
export const configSql = readFileSync(join(_dirname, 'config.sql'), 'utf-8');
export const extensionsSql = readFileSync(
  join(_dirname, 'extensions.sql'),
  'utf-8',
);
export const foreignTablesSql = readFileSync(
  join(_dirname, 'foreign_tables.sql'),
  'utf-8',
);
export const functionsSql = readFileSync(
  join(_dirname, 'functions.sql'),
  'utf-8',
);
export const indexesSql = readFileSync(join(_dirname, 'indexes.sql'), 'utf-8');
export const materializedViewsSql = readFileSync(
  join(_dirname, 'materialized_views.sql'),
  'utf-8',
);
export const policiesSql = readFileSync(
  join(_dirname, 'policies.sql'),
  'utf-8',
);
export const publicationsSql = readFileSync(
  join(_dirname, 'publications.sql'),
  'utf-8',
);
export const tableRelationshipsSql = readFileSync(
  join(_dirname, 'table_relationships.sql'),
  'utf-8',
);
export const rolesSql = readFileSync(join(_dirname, 'roles.sql'), 'utf-8');
export const schemasSql = readFileSync(join(_dirname, 'schemas.sql'), 'utf-8');
export const tablePrivilegesSql = readFileSync(
  join(_dirname, 'table_privileges.sql'),
  'utf-8',
);
export const tablesSql = readFileSync(join(_dirname, 'tables.sql'), 'utf-8');
export const triggersSql = readFileSync(
  join(_dirname, 'triggers.sql'),
  'utf-8',
);
export const typesSql = readFileSync(join(_dirname, 'types.sql'), 'utf-8');
export const versionSql = readFileSync(join(_dirname, 'version.sql'), 'utf-8');
export const viewsKeyDependenciesSql = readFileSync(
  join(_dirname, 'views_key_dependencies.sql'),
  'utf-8',
);
export const viewsSql = readFileSync(join(_dirname, 'views.sql'), 'utf-8');
