import { ArgumentMetadata, Logger, PipeTransform } from '@nestjs/common';
import { Exception } from '../extend/exception';

interface Options {
  returnFirst?: boolean;
  split?: string;
}

export class ParseDuplicatePipe implements PipeTransform<string, any> {
  private readonly options: Options;
  private readonly logger = new Logger(ParseDuplicatePipe.name);
  constructor(options: Options = {}) {
    this.options = options;
    this.options.split = this.options?.split ?? ','; // default split value
  }

  transform(value: any, metadata: ArgumentMetadata): any {
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Invalid metadata type',
      );
    }

    if (this.isEmpty(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      return this.options?.returnFirst ? value[0] : value[value.length - 1];
    }

    if (this.options?.split && typeof value === 'string') {
      const splitValues = value.split(this.options?.split);
      return this.options?.returnFirst
        ? splitValues[0]
        : splitValues[splitValues.length - 1];
    }

    return value;
  }

  private isEmpty(value: any): value is null | undefined | '' {
    return value === null || value === undefined || value === '';
  }
}
