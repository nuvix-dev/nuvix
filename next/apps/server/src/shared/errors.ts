/**
 * Application errors mapped to RFC-9457 problem+json responses.
 *
 * Every thrown `AppError` is converted by the Elysia error handler in
 * `app.ts` into a `application/problem+json` body:
 *
 *   { type, title, status, detail, code?, instance?, errors? }
 *
 * The error classes themselves live in `@nuvix/core` so every v2 app
 * (`apps/server`, `apps/platform`, …) shares one error-identity contract
 * instead of redefining it per app; this module re-exports them so existing
 * `../shared/errors` imports throughout `apps/server` keep working.
 */
export type { ProblemFields } from "@nuvix/core/errors";
export {
	AppError,
	BadGatewayError,
	BadRequestError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
	UnauthorizedError,
} from "@nuvix/core/errors";
