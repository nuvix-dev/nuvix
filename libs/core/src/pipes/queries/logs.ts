import { BaseQueryPipe } from './base'

export class Logs extends BaseQueryPipe {
  public static override ALLOWED_ATTRIBUTES = ['time', 'period']

  public constructor() {
    super('stats', Logs.ALLOWED_ATTRIBUTES) //TODO: Update this later
  }
}
