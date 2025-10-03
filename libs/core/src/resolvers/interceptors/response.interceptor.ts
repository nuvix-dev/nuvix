import {
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  StreamableFile,
  CallHandler,
  ExecutionContext,
  ClassSerializerContextOptions,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { isObject } from '@nestjs/common/utils/shared.utils.js'
import { loadPackage } from '@nestjs/common/utils/load-package.util.js'
import { ClassTransformOptions } from '@nestjs/common/interfaces/external/class-transform-options.interface'
import { TransformerPackage } from '@nestjs/common/interfaces/external/transformer-package.interface'
import { Doc } from '@nuvix/db'
import { Reflector } from '@nestjs/core'

export const CLASS_SERIALIZER_OPTIONS = 'CLASS_SERIALIZER_OPTIONS'

let classTransformer: TransformerPackage = {} as any

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
    classTransformer =
      defaultOptions?.transformerPackage ??
      loadPackage('class-transformer', 'ClassSerializerInterceptor', () =>
        require('class-transformer'),
      )

    if (!defaultOptions?.transformerPackage) {
      require('class-transformer')
    }
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
        map((res: PlainLiteralObject | Array<PlainLiteralObject>) =>
          this.serialize(res, options),
        ),
      )
  }

  /**
   * Serializes responses that are non-null objects nor streamable files.
   */
  serialize(
    response: PlainLiteralObject | Array<PlainLiteralObject>,
    options: ResolverTypeContextOptions,
  ): PlainLiteralObject | Array<PlainLiteralObject> {
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
    response: PlainLiteralObject | Array<PlainLiteralObject>,
    options: ResolverTypeContextOptions,
    keys?: string[],
  ): PlainLiteralObject | Array<PlainLiteralObject> {
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
      return classTransformer.classToPlain(plainOrClass, options)
    }
    if (plainOrClass instanceof options.type) {
      return classTransformer.classToPlain(plainOrClass, options)
    }
    const instance = (classTransformer as any).plainToInstance(
      options.type,
      plainOrClass,
      options,
    )
    return classTransformer.classToPlain(instance, options)
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
