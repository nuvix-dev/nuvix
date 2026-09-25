export const schemasSql = `
SELECT
  n.oid::int8 as id,
  n.nspname as name,
  u.rolname as owner
FROM
  pg_namespace n,
  pg_roles u
WHERE
  n.nspowner = u.oid
  AND (
    pg_has_role(n.nspowner, 'USAGE')
    OR has_schema_privilege(n.oid, 'CREATE, USAGE')
  )
  AND NOT pg_catalog.starts_with(n.nspname, 'pg_temp_')
  AND NOT pg_catalog.starts_with(n.nspname, 'pg_toast_temp_')
`
