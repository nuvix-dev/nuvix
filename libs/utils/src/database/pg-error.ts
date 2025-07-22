import { DatabaseError } from 'pg';

type PgErrorType =
  | 'DATABASE_CONFLICT'
  | 'DATABASE_VALIDATION'
  | 'DATABASE_AUTH'
  | 'DATABASE_FORBIDDEN'
  | 'DATABASE_NOT_FOUND'
  | 'DATABASE_UNAVAILABLE'
  | 'DATABASE_INTERNAL'
  | 'DATABASE_UNKNOWN';

interface PgTransformedError {
  status: number;
  code: string;
  type: PgErrorType;
  message: string;
  details: {
    message: string;
    detail?: string;
    hint?: string;
    position?: string;
    table?: string;
    column?: string;
    constraint?: string;
  };
}

function safeMessage(defaultMessage: string, detail?: string): string {
  return detail || defaultMessage;
}

type ErrorMapEntry =
  | {
      status: number;
      type: PgErrorType;
      message: string | ((err: DatabaseError) => string);
    }
  | ((
      err: DatabaseError,
      authed: boolean,
    ) => Omit<PgTransformedError, 'code' | 'details'>);

const errorMapArray: [string, ErrorMapEntry][] = [
  // Class 23 — Integrity Constraint Violation
  [
    '23505',
    {
      status: 409,
      type: 'DATABASE_CONFLICT',
      message: 'The record already exists.',
    },
  ], // unique_violation
  [
    '23503',
    {
      status: 409,
      type: 'DATABASE_CONFLICT',
      message: 'The operation violates a foreign key constraint.',
    },
  ], // foreign_key_violation
  [
    '23502',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'A required value is missing or null.',
    },
  ], // not_null_violation
  [
    '23514',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'A value violates a check constraint.',
    },
  ], // check_violation

  // Custom logic for insufficient privilege
  [
    '42501',
    (err: DatabaseError, authed: boolean) =>
      authed
        ? {
            status: 403,
            type: 'DATABASE_FORBIDDEN',
            message: 'You do not have permission to perform this action.',
          }
        : {
            status: 401,
            type: 'DATABASE_AUTH',
            message: 'Authentication is required to perform this action.',
          },
  ], // insufficient_privilege

  // Other specific codes
  [
    '22P02',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'An invalid value was provided for a column.',
    },
  ], // invalid_text_representation
  [
    '42P01',
    {
      status: 404,
      type: 'DATABASE_NOT_FOUND',
      message: 'The requested table was not found.',
    },
  ], // undefined_table
  [
    '42703',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'The requested column does not exist.',
    },
  ], // undefined_column
  [
    'P0001',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: err => safeMessage('A database check failed.', err.detail),
    },
  ], // raise_exception
  [
    '57P01',
    {
      status: 503,
      type: 'DATABASE_UNAVAILABLE',
      message:
        'The database is currently undergoing maintenance. Please try again later.',
    },
  ], // admin_shutdown
] as const;

const SPECIFIC_ERROR_MAP: Map<string, ErrorMapEntry> = new Map(errorMapArray);

// Mappings for PostgreSQL error classes (the first two characters of the code)
const CLASS_ERROR_MAP: Map<
  string,
  { status: number; type: PgErrorType; message: string }
> = new Map([
  [
    '08',
    {
      status: 503,
      type: 'DATABASE_UNAVAILABLE',
      message: 'Connection Exception.',
    },
  ],
  [
    '22',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'Data Exception: Invalid data format.',
    },
  ],
  [
    '25',
    {
      status: 500,
      type: 'DATABASE_INTERNAL',
      message: 'Invalid Transaction State.',
    },
  ],
  [
    '40',
    {
      status: 409,
      type: 'DATABASE_CONFLICT',
      message:
        'Transaction Rollback: A conflict occurred that requires the transaction to be retried.',
    },
  ],
  [
    '42',
    {
      status: 400,
      type: 'DATABASE_VALIDATION',
      message: 'Syntax Error or Access Rule Violation.',
    },
  ],
  [
    '53',
    {
      status: 503,
      type: 'DATABASE_UNAVAILABLE',
      message: 'Insufficient Resources.',
    },
  ],
  [
    '54',
    {
      status: 500,
      type: 'DATABASE_INTERNAL',
      message: 'Program Limit Exceeded.',
    },
  ],
  [
    '57',
    {
      status: 500,
      type: 'DATABASE_INTERNAL',
      message: 'Operator Intervention.',
    },
  ],
  [
    'XX',
    { status: 500, type: 'DATABASE_INTERNAL', message: 'Internal Error.' },
  ],
]);

/**
 * Transforms a raw PostgreSQL error into a structured, user-friendly error object.
 * @param error The error thrown, expected to be an instance of `DatabaseError` from the `pg` driver.
 * @param authed A boolean indicating if the user is considered authenticated.
 * @returns A structured `PgTransformedError` object, or `null` if the input is not a valid DB error.
 */
export function transformPgError(
  error: unknown,
  authed: boolean = true,
): PgTransformedError | null {
  if (!(error instanceof DatabaseError)) {
    return null;
  }

  const code = error.code ?? 'UNKNOWN';
  let result: Omit<PgTransformedError, 'code' | 'details'>;

  const specificMapping = SPECIFIC_ERROR_MAP.get(code);
  const classMapping = CLASS_ERROR_MAP.get(code.substring(0, 2));

  if (specificMapping) {
    if (typeof specificMapping === 'function') {
      result = specificMapping(error, authed);
    } else {
      const message =
        typeof specificMapping.message === 'function'
          ? specificMapping.message(error)
          : specificMapping.message;
      result = { ...specificMapping, message };
    }
  } else if (classMapping) {
    result = classMapping;
  } else {
    // Fallback for any unhandled PostgreSQL error
    result = {
      status: 500,
      type: 'DATABASE_UNKNOWN',
      message: 'An unexpected database error occurred.',
    };
  }

  return {
    ...result,
    code,
    details: {
      message: error.message,
      detail: error.detail ?? null,
      hint: error.hint ?? null,
      position: error.position,
      table: error.table,
      column: error.column,
      constraint: error.constraint,
    },
  };
}
