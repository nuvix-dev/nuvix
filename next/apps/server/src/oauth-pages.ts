/**
 * OAuth2 relay pages — v1 parity (`GET /auth/oauth2/success|failure`).
 * Rendered with Handlebars (D9) from `assets/views/` and mounted at the app
 * root (unversioned, like legacy): the OAuth2 provider redirects the browser
 * here when no custom success/failure URL was supplied.
 */

import { Elysia, t } from 'elysia'
import Handlebars from 'handlebars'

const viewsDir = new URL('../../../../assets/views', import.meta.url).pathname

let cachedLayout: HandlebarsTemplateDelegate | undefined
let cachedSuccess: HandlebarsTemplateDelegate | undefined
let cachedFailure: HandlebarsTemplateDelegate | undefined

async function load(name: string): Promise<string> {
  return Bun.file(`${viewsDir}/${name}`).text()
}

async function layout(): Promise<HandlebarsTemplateDelegate> {
  if (!cachedLayout) cachedLayout = Handlebars.compile(await load('layout.hbs'))
  return cachedLayout
}

async function successTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (!cachedSuccess) cachedSuccess = Handlebars.compile(await load('oauth/success.hbs'))
  return cachedSuccess
}

async function failureTemplate(): Promise<HandlebarsTemplateDelegate> {
  if (!cachedFailure) cachedFailure = Handlebars.compile(await load('oauth/failure.hbs'))
  return cachedFailure
}

async function renderPage(body: string, title: string): Promise<string> {
  const page = await layout()
  return page({ title, body })
}

export const oauthPages = () =>
  new Elysia({ name: 'oauth-pages' })
    .get(
      '/auth/oauth2/success',
      {
        detail: { summary: 'OAuth2 success page', tags: ['System'] },
        query: t.Object({ error: t.Optional(t.String()) }),
      },
      async ({ set }) => {
        set.headers['Content-Type'] = 'text/html; charset=utf-8'
        const tpl = await successTemplate()
        return renderPage(tpl({ status: 'ok' }), 'Signed in')
      },
    )
    .get(
      '/auth/oauth2/failure',
      {
        detail: { summary: 'OAuth2 failure page', tags: ['System'] },
        query: t.Object({ error: t.Optional(t.String()) }),
      },
      async ({ set, query }) => {
        set.headers['Content-Type'] = 'text/html; charset=utf-8'
        let errorObj: { message?: string; type?: string; code?: unknown } = {
          message: 'An unknown error occurred.',
        }
        if (query.error) {
          try {
            errorObj = JSON.parse(query.error) as typeof errorObj
          } catch {
            errorObj = { message: query.error }
          }
        }
        const tpl = await failureTemplate()
        return renderPage(tpl({ status: 'error', error: errorObj }), 'Sign-in failed')
      },
    )
