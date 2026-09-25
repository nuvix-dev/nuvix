export const typesSql = `
SELECT
  t.oid::int8 as id,
  t.typname as name,
  n.nspname as schema,
  format_type (t.oid, null) as format,
  coalesce(t_enums.enums, '[]'::jsonb) as enums,
  coalesce(t_attributes.attributes, '[]'::jsonb) as attributes,
  obj_description (t.oid, 'pg_type') as comment
FROM
  pg_type t
  LEFT JOIN pg_namespace n ON n.oid = t.typnamespace
  LEFT JOIN (
    SELECT
      enumtypid,
      jsonb_agg(enumlabel order by enumsortorder) as enums
    FROM
      pg_enum
    GROUP BY
      enumtypid
  ) as t_enums ON t_enums.enumtypid = t.oid
  LEFT JOIN (
    SELECT
      oid,
      jsonb_agg(
        jsonb_build_object('name', a.attname, 'type_id', a.atttypid::int8)
        order by a.attnum asc
      ) as attributes
    FROM
      pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE
      c.relkind = 'c' and not a.attisdropped
    GROUP BY
      c.oid
  ) as t_attributes ON t_attributes.oid = t.typrelid
`
