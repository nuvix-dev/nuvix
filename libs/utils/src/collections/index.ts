import { Database, ID } from '@nuvix/database';
import { commonCollections } from './common';
import { consoleCollections } from './console';
import { bucketCollections, dbCollections } from './misc';
import { projectCollections } from './project';

/**
 * $collection: id of the parent collection where this will be inserted
 * $id: id of this collection
 * name: name of this collection
 * project: whether this collection should be created per project
 * attributes: list of attributes
 * indexes: list of indexes
 */
const collections = {
  project: {
    auth: {
      users: projectCollections.users,
      tokens: commonCollections.tokens,
      authenticators: commonCollections.authenticators,
      challenges: commonCollections.challenges,
      sessions: commonCollections.sessions,
      identities: commonCollections.identities,
      teams: projectCollections.teams,
      memberships: projectCollections.memberships,
      targets: commonCollections.targets,
    },
    storage: {
      buckets: commonCollections.buckets,
    },
    messaging: {
      providers: commonCollections.providers,
      messages: commonCollections.messages,
      topics: commonCollections.topics,
      subscribers: commonCollections.subscribers,
    },
    functions: {
      functions: projectCollections.functions,
      deployments: projectCollections.deployments,
    },
  },
  projects: projectCollections,
  console: consoleCollections,
  buckets: bucketCollections,
  databases: dbCollections,
  docSchema: {
    collections: {
      ...dbCollections.collections,
      $collection: ID.custom(Database.METADATA),
      attributes: [
        ...dbCollections.collections.attributes.filter(
          v => !['databaseId', 'databaseInternalId'].includes(v.$id),
        ),
      ],
    },
    attributes: {
      ...projectCollections.attributes,
      $collection: ID.custom(Database.METADATA),
      attributes: projectCollections.attributes.attributes.filter(
        v => !['databaseId', 'databaseInternalId'].includes(v.$id),
      ),
      indexes: [
        {
          $id: ID.custom('_key_collection'),
          type: Database.INDEX_KEY,
          attributes: ['collectionInternalId'],
          lengths: [Database.LENGTH_KEY],
          orders: [Database.ORDER_ASC],
        },
      ],
    },
    indexes: {
      ...projectCollections.indexes,
      $collection: ID.custom(Database.METADATA),
      attributes: projectCollections.indexes.attributes.filter(
        v => !['databaseId', 'databaseInternalId'].includes(v.$id),
      ),
      indexes: [
        {
          $id: ID.custom('_key_collection'),
          type: Database.INDEX_KEY,
          attributes: ['collectionInternalId'],
          lengths: [Database.LENGTH_KEY],
          orders: [Database.ORDER_ASC],
        },
      ],
    },
  },
};

export default collections;
