import { Elysia, problem } from 'elysia'
import { AppError } from '../shared/errors'

/**
 * Maps `AppError` to RFC-9457 problem+json responses (D19).
 *
 * No i18n here (unlike `apps/server`'s equivalent plugin) — the platform app
 * is an internal control plane, not a localized end-user surface; `detail`
 * is always the English fallback. NOTE (elysia@2.0.0-beta.6): error handlers
 * registered inside a plugin must use `'global'` scope or they never reach
 * the consuming instance's routes.
 */
export function problemErrors() {
  return new Elysia({ name: 'problem-errors' }).error('global', AppError, ({ error, set }) => {
    set.status = error.status
    return problem(error.status, {
      type: error.fields.type,
      title: error.fields.title,
      detail: error.fields.detail,
      ...(error.fields.code ? { code: error.fields.code } : {}),
      instance: error.message,
      errors: error.fields.errors,
    })
  })
}
