export const tablesSql = `
SELECT
  c.oid :: int8 AS id,
  nc.nspname AS schema,
  c.relname AS name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  CASE
    WHEN c.relreplident = 'd' THEN 'DEFAULT'
    WHEN c.relreplident = 'i' THEN 'INDEX'
    WHEN c.relreplident = 'f' THEN 'FULL'
    ELSE 'NOTHING'
  END AS replica_identity,
  pg_total_relation_size(format('%I.%I', nc.nspname, c.relname)) :: int8 AS bytes,
  pg_size_pretty(
    pg_total_relation_size(format('%I.%I', nc.nspname, c.relname))
  ) AS size,
  pg_stat_get_live_tuples(c.oid) AS live_rows_estimate,
  pg_stat_get_dead_tuples(c.oid) AS dead_rows_estimate,
  obj_description(c.oid) AS comment,
  coalesce(pk.primary_keys, '[]'::jsonb) as primary_keys,
  coalesce(
    jsonb_agg(relationships) filter (where relationships is not null),
    '[]'::jsonb
  ) as relationships
FROM
  pg_namespace nc
  JOIN pg_class c ON nc.oid = c.relnamespace
  LEFT JOIN (
    SELECT
      table_id,
      jsonb_agg(_pk.*) as primary_keys
    FROM (
      SELECT
        n.nspname as schema,
        c.relname as table_name,
        a.attname as name,
        c.oid :: int8 as table_id
      FROM
        pg_index i,
        pg_class c,
        pg_attribute a,
        pg_namespace n
      WHERE
        i.indrelid = c.oid
        AND c.relnamespace = n.oid
        AND a.attrelid = c.oid
        AND a.attnum = ANY (i.indkey)
        AND i.indisprimary
    ) as _pk
    GROUP BY table_id
  ) as pk
  ON pk.table_id = c.oid
  LEFT JOIN (
    SELECT
      c.oid :: int8 as id,
      c.conname as constraint_name,
      nsa.nspname as source_schema,
      csa.relname as source_table_name,
      sa.attname as source_column_name,
      nta.nspname as target_table_schema,
      cta.relname as target_table_name,
      ta.attname as target_column_name
    FROM
      pg_constraint c
    JOIN (
      pg_attribute sa
      JOIN pg_class csa ON sa.attrelid = csa.oid
      JOIN pg_namespace nsa ON csa.relnamespace = nsa.oid
    ) ON sa.attrelid = c.conrelid AND sa.attnum = ANY (c.conkey)
    JOIN (
      pg_attribute ta
      JOIN pg_class cta ON ta.attrelid = cta.oid
      JOIN pg_namespace nta ON cta.relnamespace = nta.oid
    ) ON ta.attrelid = c.confrelid AND ta.attnum = ANY (c.confkey)
    WHERE
      c.contype = 'f'
  ) as relationships
  ON (relationships.source_schema = nc.nspname AND relationships.source_table_name = c.relname)
  OR (relationships.target_table_schema = nc.nspname AND relationships.target_table_name = c.relname)
WHERE
  c.relkind IN ('r', 'p')
  AND NOT pg_is_other_temp_schema(nc.oid)
  AND (
    pg_has_role(c.relowner, 'USAGE')
    OR has_table_privilege(
      c.oid,
      'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
    )
    OR has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
  )
GROUP BY
  c.oid,
  c.relname,
  c.relrowsecurity,
  c.relforcerowsecurity,
  c.relreplident,
  nc.nspname,
  pk.primary_keys
`
