import { DataSource } from '@nuvix/pg'
import { ProjectsDoc } from '@nuvix/utils/types'

interface SetupDatabaseMeta {
  request?: NuvixRequest
  res?: NuvixRes
  project?: ProjectsDoc
  extra?: Record<string, any>
  extraPrefix?: string
  client: DataSource
}

export const setupDatabaseMeta = async ({
  client,
  request,
  extra,
  extraPrefix,
}: SetupDatabaseMeta) => {
  const escapeString = (value: string): string => {
    return `'${value.replace(/'/g, "''")}'`
  }

  const sqlChunks: string[] = []

  if (request) {
    const headers: Record<string, string | string[]> = {}
    for (const [k, v] of Object.entries(request.headers ?? {})) {
      headers[k.toLowerCase()] = v!
    }
    sqlChunks.push(`
      SET LOCAL "request.method" = ${escapeString(request.method?.toUpperCase() || 'GET')};
      SET LOCAL "request.path" = ${escapeString(request.url || '')};
      SET LOCAL "request.id" = ${escapeString(request.id || '')};
      SET LOCAL "request.headers" = ${escapeString(JSON.stringify(headers))};
      SET LOCAL "request.ip" = ${escapeString(request.ip || '')};
    `)
  }

  if (extra) {
    const processValue = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        if (key && value != null) {
          const fullKey = prefix ? `${prefix}.${key}` : key

          if (typeof value === 'object' && !Array.isArray(value)) {
            // Recursively process nested objects
            processValue(value, fullKey)
          } else {
            // Set the value for primitive types and arrays
            const finalKey = extraPrefix
              ? `"${extraPrefix}.${fullKey}"`
              : `"${fullKey}"`
            sqlChunks.push(
              `SET LOCAL ${finalKey} = ${escapeString(String(value))};`,
            )
          }
        }
      }
    }

    processValue(extra)
  }

  if (!sqlChunks.length) {
    return
  }

  const finalSQL = sqlChunks.join('\n')
  await client.execute(finalSQL)
}
