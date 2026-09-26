export type PgErrorType =
  | 'database_conflict'
  | 'database_validation'
  | 'database_auth'
  | 'database_forbidden'
  | 'general_not_found'
  | 'database_unavailable'
  | 'database_internal'
  | 'database_unknown'

export interface PgTransformedError {
  status: number
  code: string
  type: PgErrorType
  message: string
  details: {
    message: string
    detail?: string
    hint?: string
    position?: string
    table?: string
    column?: string
    constraint?: string
  }
}

interface RawPgError {
  code?: string
  message: string
  detail?: string
  hint?: string
  position?: string
  table?: string
  column?: string
  constraint?: string
}

function safeMessage(defaultMessage: string, detail?: string): string {
  return detail || defaultMessage
}

function stripSqlFromMessage(message: string): string {
  const match = message.match(
    /^(select|insert|update|delete|create|drop|alter|truncate|with|explain)\s[\s\S]*?\s-\s(.+)$/im,
  )
  return match ? (match[2] as string) : message
}

type ErrorMapEntry =
  | {
      status: number
      type: PgErrorType
      message: string | ((err: RawPgError) => string)
    }
  | ((err: RawPgError, authed: boolean) => Omit<PgTransformedError, 'code' | 'details'>)

const specificErrorEntries: [string, ErrorMapEntry][] = [
  [
    '23505',
    {
      status: 409,
      type: 'database_conflict',
      message: 'The record already exists.',
    },
  ],
  [
    '23503',
    {
      status: 409,
      type: 'database_conflict',
      message: 'The operation violates a foreign key constraint.',
    },
  ],
  [
    '23502',
    {
      status: 400,
      type: 'database_validation',
      message: 'A required value is missing or null.',
    },
  ],
  [
    '23514',
    {
      status: 400,
      type: 'database_validation',
      message: 'A value violates a check constraint.',
    },
  ],
  [
    '42501',
    (_err: RawPgError, authed: boolean) =>
      authed
        ? {
            status: 403,
            type: 'database_forbidden',
            message: 'You do not have permission to perform this action.',
          }
        : {
            status: 401,
            type: 'database_auth',
            message: 'Authentication is required to perform this action.',
          },
  ],
  [
    '22P02',
    {
      status: 400,
      type: 'database_validation',
      message: 'An invalid value was provided for a column.',
    },
  ],
  [
    '42P01',
    {
      status: 404,
      type: 'general_not_found',
      message: 'The requested table was not found.',
    },
  ],
  [
    '42703',
    {
      status: 400,
      type: 'database_validation',
      message: 'The requested column does not exist.',
    },
  ],
  [
    'P0001',
    {
      status: 400,
      type: 'database_validation',
      message: (err: RawPgError) => safeMessage('A database check failed.', err.detail),
    },
  ],
  [
    '57P01',
    {
      status: 503,
      type: 'database_unavailable',
      message: 'The database is currently undergoing maintenance. Please try again later.',
    },
  ],
]

const SPECIFIC_ERROR_MAP: Map<string, ErrorMapEntry> = new Map(specificErrorEntries)

const CLASS_ERROR_MAP: Map<string, { status: number; type: PgErrorType; message: string }> =
  new Map([
    [
      '08',
      {
        status: 503,
        type: 'database_unavailable',
        message: 'Connection Exception.',
      },
    ],
    [
      '22',
      {
        status: 400,
        type: 'database_validation',
        message: 'Data Exception: Invalid data format.',
      },
    ],
    [
      '25',
      {
        status: 500,
        type: 'database_internal',
        message: 'Invalid Transaction State.',
      },
    ],
    [
      '40',
      {
        status: 409,
        type: 'database_conflict',
        message:
          'Transaction Rollback: A conflict occurred that requires the transaction to be retried.',
      },
    ],
    [
      '42',
      {
        status: 400,
        type: 'database_validation',
        message: 'Syntax Error or Access Rule Violation.',
      },
    ],
    [
      '53',
      {
        status: 503,
        type: 'database_unavailable',
        message: 'Insufficient Resources.',
      },
    ],
    [
      '54',
      {
        status: 500,
        type: 'database_internal',
        message: 'Program Limit Exceeded.',
      },
    ],
    [
      '57',
      {
        status: 500,
        type: 'database_internal',
        message: 'Operator Intervention.',
      },
    ],
    ['XX', { status: 500, type: 'database_internal', message: 'Internal Error.' }],
  ])

export function transformPgError(error: unknown, authed = true): PgTransformedError | null {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null
  }

  const pgErr = error as RawPgError
  const code = pgErr.code ?? 'UNKNOWN'
  let result: Omit<PgTransformedError, 'code' | 'details'>

  const specificMapping = SPECIFIC_ERROR_MAP.get(code)
  const classMapping = CLASS_ERROR_MAP.get(code.substring(0, 2))

  if (specificMapping) {
    if (typeof specificMapping === 'function') {
      result = specificMapping(pgErr, authed)
    } else {
      const message =
        typeof specificMapping.message === 'function'
          ? specificMapping.message(pgErr)
          : specificMapping.message
      result = { ...specificMapping, message }
    }
  } else if (classMapping) {
    result = classMapping
  } else {
    result = {
      status: 500,
      type: 'database_unknown',
      message: 'An unexpected database error occurred.',
    }
  }

  return {
    ...result,
    code,
    details: {
      message: pgErr.message,
      detail: pgErr.detail || stripSqlFromMessage(pgErr.message),
      hint: pgErr.hint,
      position: pgErr.position,
      table: pgErr.table,
      column: pgErr.column,
      constraint: pgErr.constraint,
    },
  }
}
