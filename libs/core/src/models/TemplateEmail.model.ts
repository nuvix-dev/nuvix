import { Exclude, Expose } from 'class-transformer'
import { TemplateModel } from './Template.model'

@Exclude()
export class TemplateEmailModel extends TemplateModel {
  /**
   * Name of the sender.
   */
  @Expose() senderName = '' // Default to empty string

  /**
   * Email of the sender.
   */
  @Expose() senderEmail = '' // Default to empty string

  /**
   * Reply to email address.
   */
  @Expose() replyTo = '' // Default to empty string

  /**
   * Email subject.
   */
  @Expose() subject = '' // Default to empty string

  constructor(partial: Partial<TemplateEmailModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
