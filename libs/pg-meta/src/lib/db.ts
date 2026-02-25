import { Pool } from 'pg'
import { PgMetaException } from '../extra/execption'
import { PostgresMetaResult } from './types'

function formatDatabaseError(error: any, sql: string): string {
  let formatted = ''

  if (error.severity) formatted += `${error.severity}:  `
  if (error.code) formatted += `${error.code}: `
  if (error.message) formatted += error.message
  formatted += '\n'

  if (error.position) {
    const position = Number(error.position) - 1
    const lines = sql.split('\n')

    let currentOffset = 0
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i]!.length + 1
      if (currentOffset + lineLength > position) {
        const lineNumber = i + 1
        const lineOffset = position - currentOffset
        formatted += `LINE ${lineNumber}: ${lines[i]}\n`
        formatted += `${' '.repeat(5 + lineNumber.toString().length + 2 + lineOffset)}^\n`
        break
      }
      currentOffset += lineLength
    }
  }

  if (error.detail) formatted += `DETAIL:  ${error.detail}\n`
  if (error.hint) formatted += `HINT:  ${error.hint}\n`
  if (error.internalQuery) formatted += `QUERY:  ${error.internalQuery}\n`
  if (error.where) formatted += `CONTEXT:  ${error.where}\n`

  return formatted
}

export const init = (
  pool: Pool,
): {
  query: (
    sql: string,
    trackQueryInSentry?: boolean,
  ) => Promise<PostgresMetaResult<any>>
  end: () => Promise<void>
} => {
  return {
    async query(sql: string): Promise<PostgresMetaResult<any>> {
      try {
        const res = await pool.query(sql)
        return { data: res.rows, error: null }
      } catch (error: any) {
        if (error?.constructor?.name === 'DatabaseError') {
          const formattedError = formatDatabaseError(error, sql)
          throw new PgMetaException(error.message, {
            ...error,
            formattedError,
          })
        }

        if (error?.code === 'RESULT_SIZE_EXCEEDED') {
          throw new PgMetaException(
            `Query result size (${error.resultSize} bytes) exceeded the configured limit (${error.maxResultSize} bytes)`,
            {
              ...error,
              formattedError: error.message,
              resultSize: error.resultSize,
              maxResultSize: error.maxResultSize,
            },
          )
        }

        throw new PgMetaException(error.message || 'Unknown error', {
          ...error,
          formattedError: error.message,
        })
      }
    },

    async end(): Promise<void> {
      await pool.end()
    },
  }
}
