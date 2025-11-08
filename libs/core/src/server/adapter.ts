import { RequestMethod } from '@nestjs/common'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { pathToRegexp } from 'path-to-regexp'
import { LegacyRouteConverter } from '@nestjs/core/router/legacy-route-converter.js'
import { HookMethods } from './hooks/interface'

export class NuvixAdapter extends FastifyAdapter {
  override async createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): Promise<(path: string, callback: Function) => any> {
    return (
      path: string,
      callback: Function,
      hookName: (typeof HookMethods)[number] = 'onRequest',
    ) => {
      const hasEndOfStringCharacter = path.endsWith('$')
      path = hasEndOfStringCharacter ? path.slice(0, -1) : path

      let normalizedPath = LegacyRouteConverter.tryConvert(path)

      // Fallback to "*path" to support plugins like GraphQL
      normalizedPath = normalizedPath === '/*path' ? '*path' : normalizedPath

      // Normalize the path to support the prefix if it set in application
      if (this._pathPrefix && !normalizedPath.startsWith(this._pathPrefix)) {
        normalizedPath = `${this._pathPrefix}${normalizedPath}`
        if (normalizedPath.endsWith('/')) {
          normalizedPath = `${normalizedPath}{*path}`
        }
      }

      try {
        let { regexp: re } = pathToRegexp(normalizedPath)
        re = hasEndOfStringCharacter
          ? new RegExp(re.source + '$', re.flags)
          : re

        this.applyHook(re, hookName, callback, normalizedPath)
        return this
      } catch (e) {
        if (e instanceof TypeError) {
          LegacyRouteConverter.printError(path)
        }
        throw e
      }
    }
  }

  private hookRegistry = new Map<
    string, // key = hookName + normalizedPath
    Function[]
  >()

  private applyHook(
    regexp: RegExp,
    hookName: (typeof HookMethods)[number],
    callback: Function,
    normalizedPath: string,
  ) {
    const key = `${hookName}:${normalizedPath}`
    if (!this.hookRegistry.has(key)) {
      this.hookRegistry.set(key, [])
      // Register a single Fastify hook for this key
      this.instance.addHook(hookName, async (...args: any[]) => {
        const request: NuvixRequest = args[0]
        const reply: NuvixRes = args[1]

        const queryParamsIndex = request.originalUrl.indexOf('?')
        const pathname =
          queryParamsIndex >= 0
            ? request.originalUrl.slice(0, queryParamsIndex)
            : request.originalUrl

        // Match the path
        if (!regexp.exec(pathname + '/') && normalizedPath) {
          return Promise.resolve()
        }

        const nextFn =
          typeof args[args.length - 1] === 'function'
            ? args[args.length - 1]
            : (e: Error) => {
                if (e) throw e
              }

        const extra = args.slice(2, -1)
        if (extra.length) {
          request['hooks_args'] = {
            ...request['hooks_args'],
            [hookName]: { args: extra },
          }
        }

        // Execute all registered callbacks in order
        const fns = this.hookRegistry.get(key) ?? []
        for (const fn of fns) {
          switch (hookName) {
            case 'preSerialization':
            case 'onSend':
            case 'onError':
              await fn(request, reply, nextFn, ...extra)
              break
            default:
              await fn(request, reply, nextFn)
          }
        }
      })
    }

    // Add callback to the stack
    this.hookRegistry.get(key)!.push(callback)
  }
}
