import {
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  StreamableFile,
  CallHandler,
  ExecutionContext,
  ClassSerializerContextOptions,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { isObject } from '@nestjs/common/utils/shared.utils';
import { loadPackage } from '@nestjs/common/utils/load-package.util';
import { ClassTransformOptions } from '@nestjs/common/interfaces/external/class-transform-options.interface';
import { TransformerPackage } from '@nestjs/common/interfaces/external/transformer-package.interface';
import { Document } from '@nuvix/database';

export const CLASS_SERIALIZER_OPTIONS = 'CLASS_SERIALIZER_OPTIONS';

let classTransformer: TransformerPackage = {} as any;

export interface PlainLiteralObject {
  [key: string]: any;
}

// NOTE (external)
// We need to deduplicate them here due to the circular dependency
// between core and common packages
const REFLECTOR = 'Reflector';

export interface ResolverTypeContextOptions
  extends ClassSerializerContextOptions {
  list?: boolean | string[];
}

export interface ClassSerializerInterceptorOptions
  extends ClassTransformOptions {
  transformerPackage?: TransformerPackage;
}

@Injectable()
export class ResolverInterceptor implements NestInterceptor {
  constructor(
    @Inject(REFLECTOR) protected readonly reflector: any,
    @Optional()
    protected readonly defaultOptions: ClassSerializerInterceptorOptions = {},
  ) {
    classTransformer =
      defaultOptions?.transformerPackage ??
      loadPackage('class-transformer', 'ClassSerializerInterceptor', () =>
        require('class-transformer'),
      );

    if (!defaultOptions?.transformerPackage) {
      require('class-transformer');
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextOptions = this.getContextOptions(context);
    const options = {
      ...this.defaultOptions,
      ...contextOptions,
    };
    return next
      .handle()
      .pipe(
        map((res: PlainLiteralObject | Array<PlainLiteralObject>) =>
          this.serialize(res, options),
        ),
      );
  }

  /**
   * Serializes responses that are non-null objects nor streamable files.
   */
  serialize(
    response: PlainLiteralObject | Array<PlainLiteralObject>,
    options: ResolverTypeContextOptions,
  ): PlainLiteralObject | Array<PlainLiteralObject> {
    if (!isObject(response) || response instanceof StreamableFile) {
      return response;
    }

    if (response instanceof Document) {
      response = response.getArrayCopy();
    }

    if (options.list) {
      const keys = Array.isArray(options.list) ? options.list : undefined;
      return this.serializeList(response, options, keys);
    }

    return Array.isArray(response)
      ? response.map((item) => this.transformToPlain(item, options))
      : this.transformToPlain(response, options);
  }

  serializeList(
    response: PlainLiteralObject | Array<PlainLiteralObject>,
    options: ResolverTypeContextOptions,
    keys?: string[],
  ): PlainLiteralObject | Array<PlainLiteralObject> {
    if (!isObject(response) || response instanceof StreamableFile) {
      return response;
    }

    if (keys && keys.length > 0) {
      const serializedResponse: PlainLiteralObject = {};

      for (const key of keys) {
        if (Array.isArray(response[key])) {
          serializedResponse[key] = response[key].map((item) =>
            this.transformToPlain(item, options),
          );
        } else if (isObject(response[key])) {
          serializedResponse[key] = this.transformToPlain(
            response[key],
            options,
          );
        } else {
          serializedResponse[key] = response[key];
        }
      }

      return serializedResponse;
    }

    const serializedResponse: PlainLiteralObject = {};

    for (const key in response) {
      console.log(key);
      if (Array.isArray(response[key])) {
        serializedResponse[key] = response[key].map((item) =>
          this.transformToPlain(item, options),
        );
      } else {
        serializedResponse[key] = response[key];
      }
    }

    return serializedResponse;
  }

  transformToPlain(
    plainOrClass: any,
    options: ResolverTypeContextOptions,
  ): PlainLiteralObject {
    delete options.list;
    if (!plainOrClass) {
      return plainOrClass;
    }
    if (!options.type) {
      return classTransformer.classToPlain(plainOrClass, options);
    }
    if (plainOrClass instanceof options.type) {
      return classTransformer.classToPlain(plainOrClass, options);
    }
    const instance = (classTransformer as any).plainToInstance(
      options.type,
      plainOrClass,
      options,
    );
    return classTransformer.classToPlain(instance, options);
  }

  protected getContextOptions(
    context: ExecutionContext,
  ): ResolverTypeContextOptions | undefined {
    return this.reflector.getAllAndOverride(CLASS_SERIALIZER_OPTIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}

export const ResponseType = (options: ResolverTypeContextOptions) =>
  SetMetadata(CLASS_SERIALIZER_OPTIONS, options);
