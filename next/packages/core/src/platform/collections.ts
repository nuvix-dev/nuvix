import { AttributeType, type Collection, Database, ID, IndexType } from '@nuvix/db'

/** Control-plane schema shared by the platform writer and server resolver. */
const projects: Collection = {
  $collection: Database.METADATA,
  $id: ID.custom('projects'),
  name: 'Projects',
  documentSecurity: false,
  enabled: true,
  attributes: [
    {
      $id: ID.custom('name'),
      key: 'name',
      type: AttributeType.String,
      size: 128,
      required: true,
    },
    {
      $id: ID.custom('status'),
      key: 'status',
      type: AttributeType.String,
      size: 32,
      required: true,
      default: 'provisioning',
    },
    {
      $id: ID.custom('publishableKey'),
      key: 'publishableKey',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('containerName'),
      key: 'containerName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('volumeName'),
      key: 'volumeName',
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required: true,
    },
    {
      $id: ID.custom('target'),
      key: 'target',
      type: AttributeType.String,
      size: 8192,
      required: false,
      default: null,
      filters: ['json', 'encrypt'],
    },
    {
      $id: ID.custom('errorMessage'),
      key: 'errorMessage',
      type: AttributeType.String,
      size: 1024,
      required: false,
      default: null,
    },
  ],
  indexes: [
    {
      $id: ID.custom('publishableKey'),
      key: 'idx_publishable_key',
      type: IndexType.Unique,
      attributes: ['publishableKey'],
    },
  ],
}

export const platformCollections: Collection[] = [projects]
