import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { Doc } from '@nuvix/db'
import { Exception } from '@nuvix/core/extend/exception'
import { RatelimitService } from '@nuvix/core/rate-limit.service'
import { Context, KeyArgs, RouteContext } from '@nuvix/utils'
import { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
}

@Injectable()
export class ThrottlerGuard implements CanActivate {
  constructor(private readonly ratelimitService: RatelimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: NuvixRequest = context.switchToHttp().getRequest()
    const response: NuvixRes = context.switchToHttp().getResponse()

    const rateLimitOptions =
      request.routeOptions?.config?.[RouteContext.RATE_LIMIT]
    if (!rateLimitOptions) {
      return true
    }

    const abuseKeys = this.generateAbuseKeys(rateLimitOptions, request)
    const project = this.getProject(request)
    const user = this.getUser(request)

    let closestResult: RateLimitResult | null = null

    for (const abuseKey of abuseKeys) {
      const rateLimitKey = this.buildRateLimitKey(
        request,
        project,
        user,
        abuseKey,
      )
      const result = await this.ratelimitService.checkRateLimit(rateLimitKey, {
        limit: rateLimitOptions.limit,
        window: rateLimitOptions.ttl ?? 3600,
      })

      if (!closestResult || result.remaining < closestResult.remaining) {
        closestResult = result
      }

      if (!result.allowed) {
        this.setRateLimitHeaders(response, result)
        throw new Exception(Exception.GENERAL_RATE_LIMIT_EXCEEDED).addDetails({
          limit: result.limit,
          remaining: result.remaining,
          reset: result.resetTime,
        })
      }
    }

    if (closestResult) {
      this.setRateLimitHeaders(response, closestResult)
    }

    return true
  }

  private generateAbuseKeys(
    rateLimitOptions: any,
    request: NuvixRequest,
  ): string[] {
    const { key: templateKey } = rateLimitOptions

    if (typeof templateKey === 'function') {
      const keyArgs: KeyArgs = {
        ip: request.ip,
        params: request.params ?? {},
        body: request.body ?? {},
        user: this.getUser(request),
        req: request,
      }
      const result = templateKey(keyArgs)
      return Array.isArray(result) ? result : [result]
    }

    if (typeof templateKey === 'string') {
      return [templateKey]
    }

    return ['ip:{ip}']
  }

  private getProject(request: NuvixRequest): ProjectsDoc {
    return request[Context.Project] ?? new Doc({ $id: 'global' })
  }

  private getUser(request: NuvixRequest): UsersDoc {
    return request[Context.User] ?? new Doc({ $id: 'anonymous' })
  }

  private buildRateLimitKey(
    request: NuvixRequest,
    project: ProjectsDoc,
    user: UsersDoc,
    abuseKey: string,
  ): string {
    const config = request.routeOptions.config
    const processedKey = this.processTemplate(abuseKey, request)
    return `rl:${config.method}:${request.host + request.url}:${project.getId()}:${user.getId()}::${processedKey}`
  }

  private processTemplate(template: string, request: NuvixRequest): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      switch (key) {
        case 'ip':
          return request.ip
        case 'url':
          return request.routeOptions.config.url
        case 'userId':
          return (request[Context.User]?.getId() || 'anonymous').toString()
        default:
          return this.processCustomKey(key, request)
      }
    })
  }

  private processCustomKey(key: string, request: NuvixRequest): string {
    if (key.startsWith('param-')) {
      return this.getParamValue(key.slice(6), request)
    }

    if (key.startsWith('header.')) {
      return this.getHeaderValue(key.slice(7), request)
    }

    return 'unknown'
  }

  private getParamValue(paramName: string, request: NuvixRequest): string {
    // Check params first
    const paramValue = (request.params as any)?.[paramName]
    if (paramValue !== undefined) {
      if (Array.isArray(paramValue)) {
        return JSON.stringify(paramValue)
      }
      return paramValue
    }

    // If not found in params, check body
    const bodyValue = (request.body as any)?.[paramName]
    if (bodyValue !== undefined) {
      if (Array.isArray(bodyValue)) {
        return JSON.stringify(bodyValue)
      }
      return bodyValue
    }

    return 'unknown'
  }

  private getHeaderValue(headerName: string, request: NuvixRequest): string {
    const value = request.headers[headerName.toLowerCase()]
    return (Array.isArray(value) ? value[0] : value) || 'unknown'
  }

  private setRateLimitHeaders(
    response: NuvixRes,
    result: RateLimitResult,
  ): void {
    response.header('X-RateLimit-Limit', result.limit.toString())
    response.header('X-RateLimit-Remaining', result.remaining.toString())
    response.header('X-RateLimit-Reset', result.resetTime.toString())
  }
}
