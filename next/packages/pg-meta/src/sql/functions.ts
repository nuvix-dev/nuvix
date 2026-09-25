export const functionsSql = `
WITH functions AS (
  SELECT
    *,
    COALESCE(
      p.proargmodes,
      array_fill('i'::text, array[cardinality(coalesce(p.proallargtypes, p.proargtypes))])
    ) AS arg_modes,
    COALESCE(
      p.proargnames,
      array_fill(''::text, array[cardinality(coalesce(p.proallargtypes, p.proargtypes))])
    ) AS arg_names,
    COALESCE(p.proallargtypes, p.proargtypes) AS arg_types,
    array_cat(
      array_fill(false, array[pronargs - pronargdefaults]),
      array_fill(true, array[pronargdefaults])
    ) AS arg_has_defaults
  FROM
    pg_proc AS p
  WHERE
    p.prokind = 'f'
)
SELECT
  f.oid::int8 AS id,
  n.nspname AS schema,
  f.proname AS name,
  l.lanname AS language,
  CASE
    WHEN l.lanname = 'internal' THEN ''
    ELSE f.prosrc
  END AS definition,
  CASE
    WHEN l.lanname = 'internal' THEN f.prosrc
    ELSE pg_get_functiondef(f.oid)
  END AS complete_statement,
  COALESCE(f_args.args, '[]'::jsonb) AS args,
  pg_get_function_arguments(f.oid) AS argument_types,
  pg_get_function_identity_arguments(f.oid) AS identity_argument_types,
  f.prorettype::int8 AS return_type_id,
  pg_get_function_result(f.oid) AS return_type,
  nullif(rt.typrelid::int8, 0) AS return_type_relation_id,
  f.proretset AS is_set_returning_function,
  CASE
    WHEN f.provolatile = 'i' THEN 'IMMUTABLE'
    WHEN f.provolatile = 's' THEN 'STABLE'
    WHEN f.provolatile = 'v' THEN 'VOLATILE'
  END AS behavior,
  f.prosecdef AS security_definer,
  f_config.config_params AS config_params
FROM
  functions f
  LEFT JOIN pg_namespace n ON f.pronamespace = n.oid
  LEFT JOIN pg_language l ON f.prolang = l.oid
  LEFT JOIN pg_type rt ON rt.oid = f.prorettype
  LEFT JOIN (
    SELECT
      oid,
      jsonb_object_agg(param, value) FILTER (WHERE param IS NOT NULL) AS config_params
    FROM
      (
        SELECT
          oid,
          (string_to_array(unnest(proconfig), '='))[1] AS param,
          (string_to_array(unnest(proconfig), '='))[2] AS value
        FROM
          functions
      ) AS t
    GROUP BY
      oid
  ) f_config ON f_config.oid = f.oid
  LEFT JOIN (
    SELECT
      oid,
      jsonb_agg(jsonb_build_object(
        'mode', t2.mode,
        'name', name,
        'type_id', type_id,
        'has_default', has_default
      )) AS args
    FROM
      (
        SELECT
          oid,
          unnest(arg_modes) AS mode,
          unnest(arg_names) AS name,
          unnest(arg_types)::int8 AS type_id,
          unnest(arg_has_defaults) AS has_default
        FROM
          functions
      ) AS t1,
      LATERAL (
        SELECT
          CASE
            WHEN t1.mode = 'i' THEN 'in'
            WHEN t1.mode = 'o' THEN 'out'
            WHEN t1.mode = 'b' THEN 'inout'
            WHEN t1.mode = 'v' THEN 'variadic'
            ELSE 'table'
          END AS mode
      ) AS t2
    GROUP BY
      oid
  ) f_args ON f_args.oid = f.oid
`
