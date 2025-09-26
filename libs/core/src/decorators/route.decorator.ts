import { type ThrottleOptions } from '@nuvix/utils';
import {
  applyDecorators,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Options,
  Head,
  All,
  type Type,
} from '@nestjs/common';
import {
  AuditEvent,
  type _AuditEvent,
  type AuditEventKey,
  type ResourcePath,
} from './events.decorator';
import { Auth, Sdk, type AuthType, type SdkOptions } from './sdk.decorator';
import { Scope } from './scope.decorator';
import type { Scopes } from '../config';
import { Throttle } from './throttle.decorator';
import { ResModel } from './res-model.decorator';
import type { ResolverTypeContextOptions } from '../resolvers';

type RouteMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

interface RouteOptions {
  path?: string | string[];
  auth?: AuthType | AuthType[];
  method?: RouteMethod | 'ALL' | RouteMethod[];
  scopes?: Scopes | Scopes[];
  audit?: Record<AuditEventKey, _AuditEvent | ResourcePath>;
  throttle?: number | ThrottleOptions;
  resModel?:
    | Type<any>
    | ResolverTypeContextOptions
    | { type: Type<unknown>; options: ResolverTypeContextOptions };
  sdk?: SdkOptions;
}

export const Route = (options: RouteOptions = {}) => {
  const decorators = [];
  const methods = options.method
    ? Array.isArray(options.method)
      ? options.method
      : [options.method]
    : ['GET'];
  const path = options.path || '';
  for (const method of methods) {
    switch (method) {
      case 'GET':
        decorators.push(Get(path));
        break;
      case 'POST':
        decorators.push(Post(path));
        break;
      case 'PUT':
        decorators.push(Put(path));
        break;
      case 'PATCH':
        decorators.push(Patch(path));
        break;
      case 'DELETE':
        decorators.push(Delete(path));
        break;
      case 'OPTIONS':
        decorators.push(Options(path));
        break;
      case 'HEAD':
        decorators.push(Head(path));
        break;
      case 'ALL':
        decorators.push(All(path));
        break;
      default:
        throw new Error(`Invalid method: ${method}`);
    }
  }

  if (options.auth) {
    decorators.push(Auth(options.auth));
  }
  if (options.scopes) {
    decorators.push(Scope(options.scopes));
  }
  if (options.audit) {
    for (const key in options.audit) {
      decorators.push(
        AuditEvent(key as AuditEventKey, options.audit[key as AuditEventKey]),
      );
    }
  }
  if (options.throttle) {
    decorators.push(Throttle(options.throttle as any));
  }
  if (options.resModel) {
    decorators.push(ResModel(options.resModel as any));
  }
  decorators.push(Sdk(options.sdk));
  return applyDecorators(...decorators);
};
