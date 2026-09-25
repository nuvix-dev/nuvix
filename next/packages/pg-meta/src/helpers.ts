export const DEFAULT_SYSTEM_SCHEMAS = ['information_schema', 'pg_catalog', 'pg_toast']

export function escapeLiteral(value: string | number): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Invalid number: ${value}`)
    }
    return `${value}`
  }
  return `'${value.replace(/'/g, "''")}'`
}

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
