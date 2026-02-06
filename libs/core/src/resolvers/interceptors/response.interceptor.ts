import {
  CallHandler,
  ClassSerializerContextOptions,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  StreamableFile,
} from '@nestjs/common'
import { ClassTransformOptions } from '@nestjs/common/interfaces/external/class-transform-options.interface'
import { TransformerPackage } from '@nestjs/common/interfaces/external/transformer-package.interface'
import { isObject } from '@nestjs/common/utils/shared.utils.js'
import { Reflector } from '@nestjs/core'
import { Doc } from '@nuvix/db'
import * as classTransformer from 'class-transformer'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export const CLASS_SERIALIZER_OPTIONS = 'CLASS_SERIALIZER_OPTIONS'

export interface PlainLiteralObject {
  [key: string]: any
}

// NOTE (external)
// We need to deduplicate them here due to the circular dependency
// between core and common packages
const REFLECTOR = 'Reflector'

export interface ResolverTypeContextOptions
  extends ClassSerializerContextOptions {
  list?: boolean | string[]
}

export interface ClassSerializerInterceptorOptions
  extends ClassTransformOptions {
  transformerPackage?: TransformerPackage
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(
    @Inject(REFLECTOR) protected readonly reflector: Reflector,
    @Optional()
    protected readonly defaultOptions: ClassSerializerInterceptorOptions = {
      excludePrefixes: ['$tenant'],
    },
  ) {
    // classTransformer =
    //   defaultOptions?.transformerPackage ??
    //   loadPackage('class-transformer', 'ClassSerializerInterceptor', () =>
    //     require('class-transformer'),
    //   )
    // if (!defaultOptions?.transformerPackage) {
    //   require('class-transformer')
    // }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextOptions = this.getContextOptions(context)
    const options = {
      ...this.defaultOptions,
      ...contextOptions,
    }
    return next
      .handle()
      .pipe(
        map((res: PlainLiteralObject | PlainLiteralObject[]) =>
          this.serialize(res, options),
        ),
      )
  }

  /**
   * Serializes responses that are non-null objects nor streamable files.
   */
  serialize(
    response: PlainLiteralObject | PlainLiteralObject[],
    options: ResolverTypeContextOptions,
  ): PlainLiteralObject | PlainLiteralObject[] {
    if (!isObject(response) || response instanceof StreamableFile) {
      return response
    }

    if (response instanceof Doc) {
      response = response.toObject()
    }

    if (options.list) {
      const keys = Array.isArray(options.list) ? options.list : undefined
      return this.serializeList(response, options, keys)
    }

    return Array.isArray(response)
      ? response.map(item => {
          if (item instanceof Doc) {
            item = item.toObject()
          }
          return this.transformToPlain(item, options)
        })
      : this.transformToPlain(response, options)
  }

  serializeList(
    response: PlainLiteralObject | PlainLiteralObject[],
    options: ResolverTypeContextOptions,
    keys?: string[],
  ): PlainLiteralObject | PlainLiteralObject[] {
    if (!isObject(response) || response instanceof StreamableFile) {
      return response
    }

    if (keys && keys.length > 0) {
      const serializedResponse: PlainLiteralObject = {}

      for (const key of keys) {
        const value = (response as PlainLiteralObject)[key]
        if (Array.isArray(value)) {
          serializedResponse[key] = value.map(item => {
            if (item instanceof Doc) {
              item = item.toObject()
            }
            return this.transformToPlain(item, options)
          })
        } else if (isObject(value)) {
          serializedResponse[key] = this.transformToPlain(
            value instanceof Doc ? value.toObject() : value,
            options,
          )
        } else {
          serializedResponse[key] = value
        }
      }

      return serializedResponse
    }

    const serializedResponse: PlainLiteralObject = {}

    for (const key in response) {
      const value = (response as PlainLiteralObject)[key]
      if (Array.isArray(value)) {
        serializedResponse[key] = value.map(item => {
          if (item instanceof Doc) {
            item = item.toObject()
          }
          return this.transformToPlain(item, options)
        })
      } else {
        serializedResponse[key] = value
      }
    }

    return serializedResponse
  }

  transformToPlain(
    plainOrClass: any,
    options: ResolverTypeContextOptions,
  ): PlainLiteralObject {
    delete options.list
    if (!plainOrClass) {
      return plainOrClass
    }
    if (!options.type) {
      return classTransformer.instanceToPlain(plainOrClass, options)
    }
    if (plainOrClass instanceof options.type) {
      return classTransformer.instanceToPlain(plainOrClass, options)
    }
    const instance = (classTransformer as any).plainToInstance(
      options.type,
      plainOrClass,
      options,
    )
    return classTransformer.instanceToPlain(instance, options)
  }

  protected getContextOptions(
    context: ExecutionContext,
  ): ResolverTypeContextOptions | undefined {
    return this.reflector.getAllAndOverride(CLASS_SERIALIZER_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ])
  }
}
