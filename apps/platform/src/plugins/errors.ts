import { type Elysia, problem } from 'elysia'
import { AppError } from '../shared/errors'

/**
 * Maps `AppError` to RFC-9457 problem+json responses.
 *
 * No i18n here (unlike `apps/server`'s equivalent plugin) — the platform app
 * is an internal control plane, not a localized end-user surface; `detail`
 * is always the English fallback. NOTE (elysia@2.0.0-rc.1): the handler is
 * applied directly to the consuming app via a transform — error handlers
 * registered inside a plugin instance never reach the consuming instance's
 * routes (the beta.6 `'global'` scope argument no longer exists).
 */
/** Register the single global error handler used by every platform route. */
export function problemErrors() {
  const handler = ({ error, set }: { error: AppError; set: any }) => {
    set.status = error.status
    return problem(error.status, {
      type: error.fields.type,
      title: error.fields.title,
      detail: error.fields.detail,
      ...(error.fields.code ? { code: error.fields.code } : {}),
      instance: error.message,
      errors: error.fields.errors,
    })
  }

  return (app: Elysia) => app.onError(AppError, handler)
}
