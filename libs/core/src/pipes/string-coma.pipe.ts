import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { Exception } from '../extend/exception';

interface Options {}

export class ParseComaStringPipe
  implements PipeTransform<string, string[] | undefined>
{
  private readonly options: Options;

  constructor(options: Options = {}) {
    this.options = options;
  }

  transform(value: any, metadata: ArgumentMetadata): string[] | undefined {
    if (metadata.type !== 'query' && metadata.type !== 'param') {
      throw new Exception(
        'GENERAL_QUERY_INVALID',
        'ParseComaStringPipe can only be used with query parameters or route parameters',
      );
    }

    if (this.isEmpty(value)) {
      return undefined;
    }

    // Handle array input
    if (Array.isArray(value)) {
      return value.filter(item => !this.isEmpty(item));
    }

    // Handle string input
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '');
    }

    throw new Exception(
      'GENERAL_QUERY_INVALID',
      `Cannot parse value of type "${typeof value}" to string array`,
    );
  }

  private isEmpty(value: any): value is null | undefined | '' {
    return value === null || value === undefined || value === '';
  }
}
