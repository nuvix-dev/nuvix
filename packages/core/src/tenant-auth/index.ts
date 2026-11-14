/** Tenant auth surface: collection definitions and schema provisioning. */
export { authCollections, filesCollection } from './collections'
export {
  AUTH_SCHEMA,
  bootstrapAuthSchema,
  createAuthDatabase,
  ensureAuthSchema,
} from './schema'
