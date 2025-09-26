import { applyDecorators, SetMetadata, Type } from '@nestjs/common';
import {
  CLASS_SERIALIZER_OPTIONS,
  ResolverTypeContextOptions,
} from '../resolvers/interceptors';
import { ApiResponse } from '@nestjs/swagger';

function ResModel(type: Type<any>): MethodDecorator;
function ResModel(options: ResolverTypeContextOptions): MethodDecorator;
function ResModel(
  type: Type<any>,
  options: Omit<ResolverTypeContextOptions, 'type'>,
): MethodDecorator;
function ResModel(
  typeOrOptions: ResolverTypeContextOptions | Type<any>,
  extra?: Omit<ResolverTypeContextOptions, 'type'>,
): MethodDecorator {
  if (typeof typeOrOptions === 'object' && !typeOrOptions.type) {
    throw new Error('You must provide a type or options with a type property');
  }
  const _options =
    typeof typeOrOptions === 'function'
      ? { type: typeOrOptions, ...extra }
      : { ...typeOrOptions };
  return applyDecorators(
    SetMetadata(CLASS_SERIALIZER_OPTIONS, _options),
    ApiResponse({
      type: _options.type,
    }),
  );
}

export { ResModel };
