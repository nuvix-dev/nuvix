import { Injectable, Logger } from '@nestjs/common'
import { Context } from '@nuvix/utils'
import { ProjectsDoc } from '@nuvix/utils/types'
import { AppConfigService } from '../../config.service'
import {
  addAccessControlRequestHeadersToVaryHeader,
  addOriginToVaryHeader,
} from '../../helpers/vary.helper'
import { Hook } from '../../server/hooks/interface'
import { Origin } from '../../validators/network/origin'

interface CorsOptions {
  origin?: string | false
  methods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  credentials: boolean
  maxAge: number
  preflight: boolean
  strictPreflight: boolean
  project?: ProjectsDoc
}

@Injectable()
export class CorsHook implements Hook {
  private readonly logger = new Logger(CorsHook.name)

  constructor(private readonly appConfig: AppConfigService) {}

  private getDefaultOptions(project?: ProjectsDoc): CorsOptions {
    const cfg = this.appConfig.get('server')
    return {
      methods: [...cfg.methods],
      allowedHeaders: [...cfg.allowedHeaders],
      exposedHeaders: [...cfg.exposedHeaders],
      credentials: cfg.credentials,
      maxAge: 3600,
      preflight: true,
      strictPreflight: true,
      project,
    }
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    try {
      const project: ProjectsDoc = req[Context.Project]
      const origin = req.headers.origin
      const host = req.host
      if (!origin) {
        return
      }

      const validOrigin = this.determineOrigin(origin, project, host)
      const options: CorsOptions = {
        ...this.getDefaultOptions(project),
        origin: validOrigin,
      }

      this.setCorsHeaders(reply, req, options)

      if (req.method.toUpperCase() === 'OPTIONS' && options.preflight) {
        this.handlePreflight(req, reply, options)
      }
    } catch (err: any) {
      this.logger.error(`CORS setup failed: ${err.message}`)
      reply.status(500).send('Internal Server Error')
    }
  }

  private determineOrigin(
    origin: string,
    project: ProjectsDoc | null,
    host: string,
  ): string | false {
    const cfg = this.appConfig.get('server')
    const isConsoleRequest =
      !project ||
      project.empty() ||
      project.getId() === 'console' ||
      host === cfg.host

    if (isConsoleRequest) {
      return this.matchOrigin(origin, [...cfg.allowedOrigins], host)
        ? origin
        : false
    }

    const validator = new Origin(project?.get('platforms', []))
    return validator.$valid(origin) ? origin : false
  }

  private matchOrigin(
    origin: string,
    allowedOrigins: string[],
    requestHost: string,
  ): boolean {
    if (!allowedOrigins?.length) {
      return false
    }
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return true
    }

    try {
      const { hostname } = new URL(origin)
      if (hostname === requestHost) {
        return true
      }

      return allowedOrigins.some(a => {
        if (a.startsWith('*.') && hostname.endsWith(a.slice(1))) {
          return true
        }
        if (a.includes('*')) {
          const regex = new RegExp(
            `^${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*')}$`,
            'i',
          )
          return regex.test(origin)
        }
        return false
      })
    } catch {
      this.logger.warn(`Invalid origin: ${origin}`)
      return false
    }
  }

  private setCorsHeaders(
    reply: NuvixRes,
    req: NuvixRequest,
    opts: CorsOptions,
  ) {
    const originHeader =
      opts.credentials && opts.origin && opts.origin !== '*'
        ? req.headers.origin
        : opts.origin || '*'

    reply.raw.setHeader('Access-Control-Allow-Origin', originHeader || 'null')

    if (opts.credentials) {
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (opts.exposedHeaders?.length) {
      reply.raw.setHeader(
        'Access-Control-Expose-Headers',
        opts.exposedHeaders.join(', '),
      )
    }

    // Vary headers
    if (opts.origin && opts.origin !== '*') {
      addOriginToVaryHeader(reply)
    }
    addAccessControlRequestHeadersToVaryHeader(reply)
  }

  private handlePreflight(
    req: NuvixRequest,
    reply: NuvixRes,
    opts: CorsOptions,
  ): unknown | undefined {
    if (!opts.origin) {
      return reply.status(403).send('Origin not allowed')
    }
    if (opts.strictPreflight && !req.headers['access-control-request-method']) {
      return reply.status(400).send('Invalid Preflight Request')
    }

    reply.raw.setHeader('Access-Control-Allow-Methods', opts.methods.join(', '))

    const reqHeaders = req.headers['access-control-request-headers']
      ?.split(',')
      .map(h => h.trim())
    reply.raw.setHeader(
      'Access-Control-Allow-Headers',
      (reqHeaders?.length ? reqHeaders : opts.allowedHeaders).join(', '),
    )

    if (opts.maxAge) {
      reply.raw.setHeader('Access-Control-Max-Age', String(opts.maxAge))
    }
    reply.status(204).header('Content-Length', '0').send()
    return
  }
}
