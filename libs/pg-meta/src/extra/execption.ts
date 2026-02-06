import { HttpException } from '@nestjs/common'

export class PgMetaException extends HttpException {
  public extra: {
    errorCode?: string
    errorHint?: string
    formattedError?: string
    [key: string]: any
  }
  constructor(
    message: string,
    extra?: {
      errorCode?: string
      errorHint?: string
      formattedError?: string
      [key: string]: any
    },
    statusCode = 500,
  ) {
    super(
      {
        message,
        statusCode,
        ...extra,
      },
      statusCode,
    )
    this.extra = extra || {}
  }

  static createDefaultException(message: string, statusCode: number) {
    return new PgMetaException(
      message,
      {
        errorCode: 'DEFAULT_ERROR_CODE',
        errorHint: 'Default error hint',
      },
      statusCode,
    )
  }
}
