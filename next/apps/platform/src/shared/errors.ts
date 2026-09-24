/**
 * Error classes live in `@nuvix/core` so every v2 app shares one error-identity
 * contract (see `apps/server/src/shared/errors.ts` for the same re-export).
 */
export type { ProblemFields } from '@nuvix/core/errors'
export {
  AppError,
  BadGatewayError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@nuvix/core/errors'
