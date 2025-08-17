import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Exception } from '../extend/exception';
import { Query, QueryException } from '@nuvix-tech/db';

interface Options {}

export class ParseQueryPipe
  implements PipeTransform<string | string[], Query[]>
{
  private readonly options: Options;
  private readonly fields: string[];

  constructor(...fields: string[]);
  constructor(fields: string[], options?: Options);
  constructor(...fieldsOrOptions: (string | string[] | Options)[]) {
    if (Array.isArray(fieldsOrOptions[0])) {
      this.fields = fieldsOrOptions[0] as string[];
      this.options = (fieldsOrOptions[1] as Options) || {};
    } else if (typeof fieldsOrOptions[0] === 'string') {
      this.fields = fieldsOrOptions as string[];
      this.options = {};
    } else {
      this.fields = [];
      this.options = (fieldsOrOptions[0] as Options) || {};
    }
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
      return Query.parseQueries(queries);
    } catch (error) {
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
