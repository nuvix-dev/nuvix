import { DatabaseError } from 'pg';

export type PgTransformedError = {
    status: number;
    code: string;
    type: 'DATABASE_VALIDATION' | 'DATABASE_CONFLICT' | 'DATABASE_AUTH' | 'DATABASE_FORBIDDEN' | 'DATABASE_NOT_FOUND' | 'DATABASE_INTERNAL' | 'DATABASE_UNAVAILABLE' | 'DATABASE_UNKNOWN';
    message: string;
    details?: Record<string, any>;
};

function startsWith(code: string, prefix: string) {
    return code.startsWith(prefix);
}

function safeMessage(defaultMsg: string, detail?: string) {
    return detail || defaultMsg;
}

export function transformPgError(error: unknown, authed: boolean = true): PgTransformedError | null {
    if (!error || typeof error !== 'object' || !(error instanceof DatabaseError)) return null;

    const err = error as DatabaseError;
    const code = err.code || 'UNKNOWN';
    const message = err.message || '';

    const m = message.toLowerCase(); // for message-based logic
    let result: PgTransformedError | null = null;

    // Fast path specific codes
    switch (code) {
        case '23505': // unique_violation
            result = { status: 409, code, type: 'DATABASE_CONFLICT', message: 'Duplicate entry.' };
            break;
        case '23503': // foreign_key_violation
            result = { status: 409, code, type: 'DATABASE_CONFLICT', message: 'Foreign key constraint failed.' };
            break;
        case '25006': // read_only_sql_transaction
            result = { status: 405, code, type: 'DATABASE_INTERNAL', message: 'Read-only transaction violation.' };
            break;
        case '21000': // cardinality_violation
            result = {
                status: m.includes('requires a where clause') ? 400 : 500,
                code,
                type: m.includes('requires a where clause') ? 'DATABASE_VALIDATION' : 'DATABASE_INTERNAL',
                message: m.includes('requires a where clause') ? 'Missing WHERE clause in update/delete.' : 'Too many rows returned from subquery.',
            };
            break;
        case '22023': // invalid_parameter_value
            if (m.startsWith('role') && m.endsWith('does not exist')) {
                result = { status: 401, code, type: 'DATABASE_AUTH', message: 'Role in JWT does not exist.' };
            } else {
                result = { status: 400, code, type: 'DATABASE_VALIDATION', message: 'Invalid parameter value.' };
            }
            break;
        case '42883': // undefined function
            result = {
                status: m.startsWith('function xmlagg(') ? 406 : 404,
                code,
                type: m.startsWith('function xmlagg(') ? 'DATABASE_VALIDATION' : 'DATABASE_NOT_FOUND',
                message: m.startsWith('function xmlagg(') ? 'Unsupported aggregation function.' : 'Function not found.',
            };
            break;
        case '42P01': // undefined table
            result = { status: 404, code, type: 'DATABASE_NOT_FOUND', message: 'Table not found.' };
            break;
        case '42P17': // infinite recursion
            result = { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Infinite recursion detected.' };
            break;
        case '42501': // insufficient privilege
            result = {
                status: authed ? 403 : 401,
                code,
                type: authed ? 'DATABASE_FORBIDDEN' : 'DATABASE_AUTH',
                message: authed ? 'Insufficient privileges.' : 'Authentication required.',
            };
            break;
        case 'P0001': // RAISE EXCEPTION
            result = { status: 400, code, type: 'DATABASE_VALIDATION', message: safeMessage('Custom error raised.', err.detail) };
            break;
        case '57P01': // admin termination
            result = { status: 503, code, type: 'DATABASE_UNAVAILABLE', message: 'Connection terminated by administrator.' };
            break;
    }

    if (result) return {
        ...result,
        details: {
            message: err.message,
            detail: err.detail,
            hint: err.hint,
            position: err.position,
            table: err.table,
            column: err.column,
            constraint: err.constraint,
        },
    };

    // Pattern-based fallback rules
    if (startsWith(code, '08')) return { status: 503, code, type: 'DATABASE_UNAVAILABLE', message: 'Database connection error.' };
    if (startsWith(code, '09')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Triggered action exception.' };
    if (startsWith(code, '0L') || startsWith(code, '0P')) return { status: 403, code, type: 'DATABASE_FORBIDDEN', message: 'Invalid role or grantor.' };
    if (startsWith(code, '2D') || startsWith(code, '25') || startsWith(code, '28')) return {
        status: 500, code, type: 'DATABASE_INTERNAL', message: 'Transaction or authentication error.'
    };
    if (startsWith(code, '3B') || startsWith(code, '38') || startsWith(code, '39')) return {
        status: 500, code, type: 'DATABASE_INTERNAL', message: 'External routine or savepoint exception.'
    };
    if (startsWith(code, '40')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Transaction rollback error.' };
    if (startsWith(code, '53')) return { status: 503, code, type: 'DATABASE_UNAVAILABLE', message: 'Insufficient resources.' };
    if (startsWith(code, '54')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Query too complex.' };
    if (startsWith(code, '55')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Prerequisite object error.' };
    if (startsWith(code, '57') || startsWith(code, '58')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'System-level error.' };
    if (startsWith(code, 'F0')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Configuration file error.' };
    if (startsWith(code, 'HV')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Foreign data wrapper error.' };
    if (startsWith(code, 'P0')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'PL/pgSQL execution error.' };
    if (startsWith(code, 'XX')) return { status: 500, code, type: 'DATABASE_INTERNAL', message: 'Internal PostgreSQL error.' };

    // Fallback
    return {
        status: 500,
        code,
        type: 'DATABASE_UNKNOWN',
        message: 'An unexpected database error occurred.',
        details: process.env.NODE_ENV === 'development' ? {
            message: err.message,
            detail: err.detail,
            hint: err.hint,
            position: err.position,
            table: err.table,
            column: err.column,
            constraint: err.constraint,
        } : undefined,
    };
}
