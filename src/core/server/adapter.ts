import { RequestMethod } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { pathToRegexp } from 'path-to-regexp';
import { LegacyRouteConverter } from '@nestjs/core/router/legacy-route-converter';
import { HookMethods } from './hooks/interface';

export class NuvixAdapter extends FastifyAdapter {
  private hooks: {
    path: string;
    regexp: RegExp;
    hookName: string;
    callback: Function;
  }[] = [];

  override async createMiddlewareFactory(
    requestMethod: RequestMethod,
  ): Promise<(path: string, callback: Function) => any> {
    return (
      path: string,
      callback: Function,
      hookName: (typeof HookMethods)[number] = 'onRequest',
    ) => {
      const hasEndOfStringCharacter = path.endsWith('$');
      path = hasEndOfStringCharacter ? path.slice(0, -1) : path;

      let normalizedPath = LegacyRouteConverter.tryConvert(path);
      normalizedPath = normalizedPath === '/*path' ? '*path' : normalizedPath;
      // Normalize the path to support the prefix if it set in application
      normalizedPath =
        this._pathPrefix && !normalizedPath.startsWith(this._pathPrefix)
          ? `${this._pathPrefix}${normalizedPath}*path`
          : normalizedPath;

      try {
        let { regexp: re } = pathToRegexp(normalizedPath);
        re = hasEndOfStringCharacter
          ? new RegExp(re.source + '$', re.flags)
          : re;
        console.log(re);
        // Store the hook instead of immediately applying it
        this.hooks.push({
          path: normalizedPath,
          regexp: re,
          hookName,
          callback,
        });

        // Apply the hook dynamically
        this.applyHook(normalizedPath, re, hookName, callback, normalizedPath);

        return this;
      } catch (e) {
        if (e instanceof TypeError) {
          LegacyRouteConverter.printError(path);
        }
        throw e;
      }
    };
  }

  private applyHook(
    path: string,
    regexp: RegExp,
    hookName: (typeof HookMethods)[number],
    callback: Function,
    normalizedPath: string,
  ) {
    // Register a hook for the specific lifecycle hook
    this.instance.addHook(hookName, async (...args) => {
      const request = args[0];
      const reply = args[1];

      const queryParamsIndex = request.originalUrl.indexOf('?');
      const pathname =
        queryParamsIndex >= 0
          ? request.originalUrl.slice(0, queryParamsIndex)
          : request.originalUrl;

      if (!regexp.exec(pathname + '/') && normalizedPath) {
        return Promise.resolve();
      }

      // Map arguments based on hook type
      switch (hookName) {
        case 'preSerialization':
        case 'onSend':
        case 'onError':
          // These hooks have (request, reply, payload, done) signature
          return callback(request, reply, ...args.slice(2));
        default:
          // Most hooks have (request, reply, done) signature
          return callback(request, reply);
      }
    });
  }
}
