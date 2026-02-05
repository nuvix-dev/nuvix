import { ArgumentMetadata, Logger, PipeTransform } from '@nestjs/common'
import { Exception } from '../extend/exception'
import { Validator } from '@nuvix/db'

interface Options {
  allowEmpty?: boolean
}

export class ParseValidatorPipe implements PipeTransform<string, any> {
  private readonly options: Options
  private readonly logger = new Logger(ParseValidatorPipe.name)
  constructor(
    private readonly validator: Validator,
    options: Options = {
      allowEmpty: true,
    },
  ) {
    this.options = options
  }

  async transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Invalid metadata type',
      )
    }
    this.logger.debug(
      `Validating ${metadata.type} parameter "${metadata.data}" with value: ${value}`,
    )
    if (Array.isArray(value)) {
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        `Expected a single value but received an array for ${metadata.type} parameter "${metadata.data}"`,
      )
    }

    if (this.isEmpty(value)) {
      if (this.options.allowEmpty) {
        return value
      } else {
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          `${metadata.type} parameter "${metadata.data}" cannot be empty`,
        )
      }
    }

    let isValid = false
    let mayBePromise = this.validator.$valid(value)
    if (mayBePromise instanceof Promise) {
      isValid = await mayBePromise
    } else {
      isValid = mayBePromise
    }

    if (!isValid) {
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        this.validator.$description,
      )
    }

    return value
  }

  private isEmpty(value: any): value is null | undefined | '' {
    return value === null || value === undefined || value === ''
  }
}
