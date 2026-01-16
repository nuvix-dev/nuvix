import { ID as BaseID } from '@nuvix/db'

/**
 * Helper class to generate ID strings for resources.
 */
export class ID extends BaseID {
  /**
   * Auto Handle the ID generation for the resource.
   *
   * @returns {string}
   */
  public static auto(id?: string, padding: number = 7): string {
    if (id === 'unique()') {
      return ID.unique(padding)
    } else if (id && id.length > 5) {
      return ID.custom(id)
    }
    return ID.unique(padding)
  }
}
