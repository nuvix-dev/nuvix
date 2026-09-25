export const versionSql = `
SELECT
  version(),
  current_setting('server_version_num') :: int4 AS version_number,
  (
    SELECT
      COUNT(*) :: int4 AS active_connections
    FROM
      pg_stat_activity
  ) AS active_connections,
  current_setting('max_connections') :: int4 AS max_connections
`
