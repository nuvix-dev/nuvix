/** Resolves request locale precedence and exposes a translator through the Elysia context. */
import {
  createTranslator,
  resolveLocale,
  type TranslationLoader,
  type Translator,
} from '@nuvix/i18n'
import { Elysia } from 'elysia'

export interface LocaleContextOptions {
  loader: TranslationLoader
  /** Cached list of available locale codes. */
  available: string[]
  fallback?: string
}

/** Resolve locale headers independently so error handling can translate without the derive chain. */
export async function getTranslator(
  headers: Headers,
  options: LocaleContextOptions,
): Promise<Translator> {
  const locale = resolveLocale({
    // User preference can be inserted here when authenticated account context is available.
    headerLocale: headers.get('x-nuvix-locale'),
    acceptLanguage: headers.get('accept-language'),
    available: options.available,
    fallback: options.fallback,
  })

  return createTranslator({
    loader: options.loader,
    locale,
    fallback: options.fallback,
  })
}

/** Exposes the resolved translator to downstream plugins; `locale.locale` contains the code string. */
export function localeContext(options: LocaleContextOptions) {
  return new Elysia({ name: 'locale-context' }).derive('plugin', async ({ request }) => ({
    // Await resolution so handlers receive a translator rather than a pending promise.
    locale: await getTranslator(request.headers, options),
  }))
}
