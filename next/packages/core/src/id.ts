import { ID as BaseID } from '@nuvix/db'

/**
 * `@nuvix/db`'s `ID` plus the v2 create-endpoint id convention (D28): ported
 * unchanged from the legacy `libs/core/src/helpers/ID.helper.ts` so every v2
 * app resolves ids the same way instead of each service reimplementing it.
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
