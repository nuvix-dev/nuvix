import { Query } from '@nestjs/common'
import { ApiQuery } from '@nestjs/swagger'
import type { BaseQueryPipe } from '../pipes/queries/base'
import { configuration } from '@nuvix/utils'
import { ParseQueryPipe } from '../pipes'

/**
 * A decorator that:
 * 1. Applies a NestJS `@Query` parameter decorator with the provided pipe.
 * 2. Adds Swagger documentation for queries[] automatically from `pipe.ALLOWED_ATTRIBUTES`.
 */
export function QueryFilter(pipe: typeof BaseQueryPipe | ParseQueryPipe) {
  const allowed = (pipe as typeof BaseQueryPipe).ALLOWED_ATTRIBUTES ?? []

  return (
    target: Object,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) => {
    Query('queries', pipe)(target, propertyKey, parameterIndex)

    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)
    if (descriptor) {
      ApiQuery({
        name: 'queries',
        required: false,
        type: String,
        isArray: true,
        description: `Array of query strings generated using the Query class provided by the SDK. [Learn more about queries](https://docs.nuvix.in/database/queries). Maximum of ${configuration.limits.arrayParamsSize} queries are allowed, each ${configuration.limits.arrayElementSize} characters long. You may filter on the following attributes: ${allowed.join(', ')}.`,
      })(target, propertyKey, descriptor)
    }
  }
}

/**
 * A decorator that:
 * 1. Applies a NestJS `@Query` parameter decorator for 'search'.
 * 2. Adds Swagger documentation for 'search' parameter.
 */
export function QuerySearch() {
  return (
    target: Object,
    propertyKey: string | symbol,
    parameterIndex: number,
  ) => {
    Query('search')(target, propertyKey, parameterIndex)

    const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey)
    if (descriptor) {
      ApiQuery({
        name: 'search',
        required: false,
        type: String,
        description: `Search term to filter your list results. Max length: 256 chars.`,
      })(target, propertyKey, descriptor)
    }
  }
}
