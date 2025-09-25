#!/usr/bin/env bash
set -euo pipefail

TEMPLATE="/etc/pgcat/pgcat.toml.template"
OUTPUT="/etc/pgcat/pgcat.toml"

# Preconditions
if [[ ! -f "$TEMPLATE" ]]; then
  echo "pgcat template not found: $TEMPLATE" >&2
  exit 1
fi

# Validate required envs 
REQUIRED_VARS=(
  APP_PGCAT_ADMIN_USER
  APP_PGCAT_ADMIN_PASSWORD
  APP_DATABASE_HOST
  APP_DATABASE_PORT
  APP_DATABASE_NAME
  APP_DATABASE_PASSWORD
  APP_DATABASE_ADMIN_PASSWORD
)
for v in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Missing required environment variable: $v" >&2
    exit 1
  fi
done

# Truncate/create the output file
: > "$OUTPUT"

while IFS= read -r line || [[ -n "$line" ]]; do
     # Replace ${VAR} with the value of the environment variable
     # This works for both quoted strings and numeric values
     while [[ "$line" =~ (\$\{([A-Za-z_][A-Za-z0-9_]*)\}) ]]; do
         VAR_NAME="${BASH_REMATCH[2]}"
         VAR_VALUE="${!VAR_NAME:-}"  # default empty if not set
         # Escape backslashes and slashes in value
         VAR_VALUE="${VAR_VALUE//\\/\\\\}"
         VAR_VALUE="${VAR_VALUE//\//\\/}"
         line="${line//${BASH_REMATCH[1]}/$VAR_VALUE}"
     done
     echo "$line" >> "$OUTPUT"
 done < "$TEMPLATE"
 
# Tighten permissions and execute PgCat with the generated config
chmod 600 "$OUTPUT" || true
 exec pgcat "$OUTPUT"
