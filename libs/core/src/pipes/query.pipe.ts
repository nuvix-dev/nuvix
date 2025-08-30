import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Exception } from '../extend/exception';
import {
  QueriesValidator,
  Query,
  QueryException,
  type BaseValidator,
} from '@nuvix-tech/db';

interface Options {
  validators?: BaseValidator[];
  maxLength?: number;
  validate?: boolean;
}

export class ParseQueryPipe
  extends QueriesValidator
  implements PipeTransform<string | string[], Query[]>
{
  private readonly options: Options;
  private readonly fields: string[];

  constructor(...fields: string[]);
  constructor(fields: string[], options?: Options);
  constructor(options: Options);
  constructor(...fieldsOrOptions: any[]) {
    let fields: string[];
    let options: Options;
    if (Array.isArray(fieldsOrOptions[0])) {
      fields = fieldsOrOptions[0] as string[];
      options = (fieldsOrOptions[1] as Options) || {};
    } else if (typeof fieldsOrOptions[0] === 'string') {
      fields = fieldsOrOptions as string[];
      options = {};
    } else {
      fields = [];
      options = (fieldsOrOptions[0] as Options) || {};
    }
    super(options.validators, options.maxLength);
    this.fields = fields;
    this.options = options;
  }

  transform(value: any, metadata: ArgumentMetadata): Query[] {
    if (metadata.type !== 'query') {
      throw new Exception(
        Exception.GENERAL_QUERY_INVALID,
        'ParseQueryPipe can only be used with query parameters',
      );
    }

    if (this.isEmpty(value)) {
      return [];
    }

    const queries = Array.isArray(value) ? value : [value];

    try {
      const parsedQueries = Query.parseQueries(queries);
      if (!this.$valid(parsedQueries)) {
        throw new Exception(Exception.GENERAL_QUERY_INVALID, this.$description);
      }
      return queries;
    } catch (error) {
      if (error instanceof Exception) {
        throw error;
      }
      throw new Exception(
        Exception.GENERAL_QUERY_INVALID,
        error instanceof QueryException
          ? error.message
          : `Failed to parse query: ${(error as Error)?.message ?? 'Unknown error'}`,
      );
    }
  }

  private isEmpty(value: any): value is null | undefined | '' {
    return value === null || value === undefined || value === '';
  }
}
