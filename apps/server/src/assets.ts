/**
 * Runtime asset tree — the single source of asset paths for the server app.
 *
 * Resolved relative to THIS module so both layouts agree: in the source tree
 * `src/assets.ts` sits three levels under the repo root, and the AOT bundle
 * emits to `dist/` beside `src/` — same depth, same resolution.
 */

/** Root directory of the runtime assets (avatars, fonts, i18n, mail, views, geoip). */
export const ASSETS_ROOT = new URL('../../../assets/', import.meta.url).pathname

/** ICU translation catalogs consumed by the i18n loader. */
export const translationsDir = `${ASSETS_ROOT}locale/translations`

/** Handlebars mail templates consumed by the mail composer and mails worker. */
export const mailTemplatesDir = `${ASSETS_ROOT}locale/templates`

/** OAuth2 consent/error relay pages. */
export const viewsDir = `${ASSETS_ROOT}views`

/** Browser/flag avatar sheets. */
export const avatarsDir = `${ASSETS_ROOT}avatars/`

/** Font used to render generated avatars. */
export const avatarFontFile = `${ASSETS_ROOT}fonts/Varela-Regular.ttf`

/** GeoIP country database (bundled .mmdb reader). */
export const geoipDatabase = `${ASSETS_ROOT}dbip/dbip-country-lite-2024-09.mmdb`
