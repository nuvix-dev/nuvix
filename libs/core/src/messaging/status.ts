export class Status {
  /**
   * Message that is not ready to be sent
   */
  static readonly DRAFT = 'draft';
  /**
   * Scheduled to be sent for a later time
   */
  static readonly SCHEDULED = 'scheduled';
  /**
   * Picked up by the worker and starting to send
   */
  static readonly PROCESSING = 'processing';
  /**
   * Sent without errors
   */
  static readonly SENT = 'sent';
  /**
   * Sent with some errors
   */
  static readonly FAILED = 'failed';
}
