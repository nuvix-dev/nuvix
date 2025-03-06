import { SetMetadata, Type } from '@nestjs/common';
import {
  CLASS_SERIALIZER_OPTIONS,
  ResolverTypeContextOptions,
} from '../resolvers/interceptors';

export const ResModel = (options: ResolverTypeContextOptions | Type<any>) =>
  typeof options === 'function'
    ? SetMetadata(CLASS_SERIALIZER_OPTIONS, { type: options })
    : SetMetadata(CLASS_SERIALIZER_OPTIONS, options);
