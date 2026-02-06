import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class VcsContentModel extends BaseModel {
  /**
   * Content size in bytes. Only files have size, and for directories, 0 is returned.
   */
  @Expose() size = 0 // Default to 0

  /**
   * If a content is a directory. Directories can be used to check nested contents.
   */
  @Expose() isDirectory = false // Default to false

  /**
   * Name of directory or file.
   */
  @Expose() name = '' // Default to empty string

  constructor(partial: Partial<VcsContentModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
