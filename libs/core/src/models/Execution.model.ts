import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ExecutionModel extends BaseModel {
  /**
   * Function ID.
   */
  @Expose() functionId = ''

  /**
   * The trigger that caused the function to execute.
   * Possible values can be: `http`, `schedule`, or `event`.
   */
  @Expose() trigger = ''

  /**
   * The status of the function execution.
   * Possible values can be: `waiting`, `processing`, `completed`, or `failed`.
   */
  @Expose() status = ''

  /**
   * HTTP request method type.
   */
  @Expose() requestMethod = ''

  /**
   * HTTP request path and query.
   */
  @Expose() requestPath = ''

  /**
   * HTTP response headers as a key-value object.
   * This will return only whitelisted headers.
   * All headers are returned if execution is created as synchronous.
   */
  @Expose() requestHeaders: Record<string, string>[] = []

  /**
   * HTTP response status code.
   */
  @Expose() responseStatusCode = 0

  /**
   * HTTP response body.
   * This will return empty unless execution is created as synchronous.
   */
  @Expose() responseBody = ''

  /**
   * HTTP response headers as a key-value object.
   * This will return only whitelisted headers.
   * All headers are returned if execution is created as synchronous.
   */
  @Expose() responseHeaders: Record<string, string>[] = []

  /**
   * Function logs. Includes the last 4,000 characters.
   * This will return an empty string unless the response is returned using an API key or as part of a webhook payload.
   */
  @Expose() logs = ''

  /**
   * Function errors. Includes the last 4,000 characters.
   * This will return an empty string unless the response is returned using an API key or as part of a webhook payload.
   */
  @Expose() errors = ''

  /**
   * Function execution duration in seconds.
   */
  @Expose() duration = 0

  /**
   * The scheduled time for execution.
   * If left empty, execution will be queued immediately.
   */
  @Expose() scheduledAt = ''

  constructor(partial: Partial<ExecutionModel>) {
    super()
    Object.assign(this, partial)
  }
}
