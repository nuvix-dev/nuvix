/** Problem-details error plugin with caller-localized detail messages. */
import type { Translator } from '@nuvix/i18n'
import { Elysia, problem } from 'elysia'
import { AppError } from '../shared/errors'

export interface ProblemErrorsOptions {
  /** Resolves the request's translator for localized error details. */
  getTranslator?: (headers: Headers) => Promise<Translator>
}

/** Maps application errors to RFC 9457 problem+json responses through one global composed-route contract. */
export function problemErrors(options: ProblemErrorsOptions = {}) {
  return new Elysia({ name: 'problem-errors' }).error(
    'global',
    AppError,
    async ({ error, set, request }) => {
      let detail = error.fields.detail
      if (error.fields.messageKey && options.getTranslator) {
        try {
          const translator = await options.getTranslator(request.headers)
          detail = translator.format(error.fields.messageKey, error.fields.params)
        } catch {
          // Translation failures must never mask the original error.
        }
      }

      set.status = error.status
      return problem(error.status, {
        type: error.fields.type,
        title: error.fields.title,
        detail,
        // Stable machine code — the field SDKs branch on. Omitted (not
        // null) when an error has no specific code yet.
        ...(error.fields.code ? { code: error.fields.code } : {}),
        instance: error.message,
        errors: error.fields.errors,
      })
    },
  )
}
