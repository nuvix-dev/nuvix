import type { Elysia } from 'elysia'

/** Handles CORS preflight requests and attaches origin, credential, and variation headers to responses. */

export interface CorsOptions {
  /** Allowed origins. Use `true` for any, or a list of exact origins. */
  origin: true | string[]
  methods?: string[]
  allowedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

const DEFAULTS: Required<Omit<CorsOptions, 'origin'>> = {
  methods: 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS'.split(','),
  allowedHeaders: [
    'content-type',
    'authorization',
    'x-nuvix-session',
    'x-nuvix-jwt',
    'x-nuvix-key',
    'x-nuvix-mode',
  ],
  credentials: true,
  maxAge: 86400,
}

export function cors(options: CorsOptions) {
  const opts = { ...DEFAULTS, ...options }

  return (app: Elysia) =>
    app
      .request(({ request, set }) => {
        const origin = request.headers.get('origin')
        if (!origin) return

        const allowed = opts.origin === true ? '*' : opts.origin.includes(origin) ? origin : null
        if (!allowed) return

        set.headers['access-control-allow-origin'] = allowed
        if (opts.credentials && allowed !== '*') {
          set.headers['access-control-allow-credentials'] = 'true'
        }
        set.headers.vary = 'Origin'
      })
      .options('/*', ({ set }) => {
        set.status = 204
        set.headers['access-control-allow-methods'] = opts.methods.join(',')
        set.headers['access-control-allow-headers'] = opts.allowedHeaders.join(',')
        set.headers['access-control-max-age'] = String(opts.maxAge)
        return new Response(null, { status: 204 })
      })
}
