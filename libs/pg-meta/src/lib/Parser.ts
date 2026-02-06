import { deparse, parse } from 'pgsql-parser'
import * as prettier from 'prettier'
import SqlFormatter from 'prettier-plugin-sql'
import { PgMetaException } from '../extra/execption'
import { FormatterOptions } from './types'

const DEFAULT_FORMATTER_OPTIONS = {
  plugins: [SqlFormatter],
  formatter: 'sql-formatter',
  language: 'postgresql',
  database: 'postgresql',
  parser: 'sql',
}

/**
 * Parses a SQL string into an AST.
 */
export function Parse(sql: string): ParseReturnValues {
  try {
    const data = parse(sql)

    return { data, error: null }
  } catch (error: any) {
    throw new PgMetaException(error.message)
  }
}
interface ParseReturnValues {
  data: object | null
  error: null | Error
}

/**
 * Deparses an AST into SQL string.
 */
export async function Deparse(parsedSql: object): Promise<DeparseReturnValues> {
  try {
    const data = await deparse(parsedSql, {})
    return { data, error: null }
  } catch (error: any) {
    throw new PgMetaException(error.message)
  }
}
interface DeparseReturnValues {
  data: string | null
  error: null | Error
}

/**
 * Formats a SQL string into a prettier-formatted SQL string.
 */
export async function Format(
  sql: string,
  options: FormatterOptions = {},
): Promise<FormatReturnValues> {
  try {
    const formatted = await prettier.format(sql, {
      ...DEFAULT_FORMATTER_OPTIONS,
      ...options,
    })

    return { data: formatted, error: null }
  } catch (error: any) {
    console.log(error)
    throw new PgMetaException(error.message)
  }
}
interface FormatReturnValues {
  data: string | null
  error: null | Error
}
