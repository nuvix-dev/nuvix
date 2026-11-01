/** Shared helpers for building metadata-introspection SQL fragments. */

/** System schemas that never count as user objects in metadata queries. */
export const DEFAULT_SYSTEM_SCHEMAS = ['information_schema', 'pg_catalog', 'pg_toast']

/**
 * Render a value as a safe SQL literal: numbers are validated as finite and
 * interpolated as-is; strings get single quotes doubled per SQL escaping.
 */
export function escapeLiteral(value: string | number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Invalid number: ${value}`)
    }
    return `${value}`
  }
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * Build an `IN`/`NOT IN` predicate over literal names. An explicit include
 * list wins; otherwise exclude (optionally seeded with defaults) is used;
 * when both are empty no predicate is emitted.
 */
export function filterByList(
  include?: string[],
  exclude?: string[],
  defaultExclude?: string[],
): string {
  let finalExclude = exclude ? [...exclude] : []
  if (defaultExclude) {
    finalExclude = defaultExclude.concat(finalExclude)
  }
  if (include && include.length > 0) {
    return `IN (${include.map(escapeLiteral).join(', ')})`
  }
  if (finalExclude.length > 0) {
    return `NOT IN (${finalExclude.map(escapeLiteral).join(', ')})`
  }
  return ''
}

/**
 * SQL fragment aggregating child rows from `source` into a JSONB array
 * (empty array instead of NULL when no rows match `filter`), so a single
 * SELECT can return each object with its nested children embedded.
 */
export function coalesceRowsToArray(source: string, filter: string): string {
  return `
COALESCE(
  (
    SELECT
      jsonb_agg(to_jsonb(${source})) FILTER (WHERE ${filter})
    FROM
      ${source}
  ),
  '[]'::jsonb
) AS ${source}`
}
