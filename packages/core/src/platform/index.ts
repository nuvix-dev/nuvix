/** Platform surface: platform collections and the platform database bootstrap. */
export { platformCollections } from './collections'
export {
  createPlatformDatabase,
  ensurePlatformSchema,
  type PlatformDatabaseOptions,
} from './database'
export {
  KeyRegistry,
  type OAuthProviderInfo,
  type PlatformInfo,
  ProjectRegistry,
  type ResolvedApiKey,
  type ResolvedProject,
  type WebhookInfo,
} from './registry'
