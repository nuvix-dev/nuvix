import { ID as BaseID } from '@nuvix/db'

/**
 * `@nuvix/db`'s `ID` extended with the create-endpoint id convention shared
 * by every app: short values (or none) generate a fresh id, long values are
 * treated as caller-supplied custom ids.
 */
export class ID extends BaseID {
  /**
   * Resolves the id a create endpoint should use: the `'unique()'` magic
   * string (or nothing longer than 5 characters) generates a fresh id;
   * anything longer is treated as a caller-supplied custom id.
   */
  public static auto(id?: string, padding = 7): string {
    if (id === 'unique()') {
      return ID.unique(padding)
    }
    if (id && id.length > 5) {
      return ID.custom(id)
    }
    return ID.unique(padding)
  }
}
