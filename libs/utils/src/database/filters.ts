import {
  AttributeType,
  Authorization,
  Database,
  Doc,
  Query,
} from '@nuvix-tech/db';
import {
  APP_LIMIT_SUBQUERY,
  APP_LIMIT_SUBSCRIBERS_SUBQUERY,
  APP_OPENSSL_KEY_1,
} from '../constants';
import crypto from 'crypto';

type SecondArgType = {
  encode: (
    value: any,
    attribute: Doc<Record<string, any>>,
    database: Database,
  ) => any;
  decode: (
    value: any,
    document: Doc<Record<string, any>>,
    database: Database,
  ) => any | Promise<any>;
};

export const filters: Record<string, SecondArgType> = {
  casting: {
    encode: value => {
      return JSON.stringify({ value: value }, (key, value) => {
        return typeof value === 'number' && !isFinite(value)
          ? String(value)
          : value;
      });
    },
    decode: value => {
      if (value == null || value === undefined) {
        return null;
      }

      return JSON.parse(value as string)?.value;
    },
  },
  enum: {
    encode: (value, attribute) => {
      if (attribute.has('elements')) {
        attribute.delete('elements');
      }

      return value;
    },
    decode: (value, attribute) => {
      const formatOptions = attribute.get('formatOptions');
      if (formatOptions.elements) {
        attribute.set('elements', formatOptions.elements);
      }

      return value;
    },
  },
  range: {
    encode: (value, attribute) => {
      if (attribute.has('min')) {
        attribute.delete('min');
      }
      if (attribute.has('max')) {
        attribute.delete('max');
      }

      return value;
    },
    decode: (value, attribute) => {
      const formatOptions = attribute.get('formatOptions', {});
      if (formatOptions.min || formatOptions.max) {
        attribute.set('min', formatOptions.min).set('max', formatOptions.max);
      }

      return value;
    },
  },
  subQueryAttributes: {
    encode: _ => {
      return null;
    },
    decode: async (_, document, database) => {
      const attributes = await database.find('attributes', [
        Query.equal('collectionInternalId', [document.getSequence()]),
        Query.limit(database.getAdapter().$limitForAttributes),
      ]);

      attributes.forEach(attribute => {
        if (attribute.get('type') === AttributeType.Relationship) {
          const options = attribute.get('options');
          Object.keys(options).forEach(key => {
            attribute.set(key, options[key]);
          });
          attribute.delete('options');
        }
      });

      return attributes;
    },
  },
  subQueryIndexes: {
    encode: _ => {
      return null;
    },
    decode: async (_, document, database) => {
      return await database.find('indexes', [
        Query.equal('collectionInternalId', [document.getSequence()]),
        Query.limit(database.getAdapter().$limitForIndexes),
      ]);
    },
  },
  subQueryPlatforms: {
    encode: _ => {
      return null;
    },
    decode: (_, document, database) => {
      return database.find('platforms', [
        Query.equal('projectInternalId', [document.getSequence()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },

  subQueryKeys: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return database.find('keys', [
        Query.equal('projectInternalId', [document.getSequence()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  subQueryWebhooks: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return database.find('webhooks', [
        Query.equal('projectInternalId', [document.getSequence()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  subQuerySessions: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(() => {
        return database.find('sessions', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryTokens: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(() => {
        return database.find('tokens', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryChallenges: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(() => {
        return database.find('challenges', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryAuthenticators: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(() => {
        return database.find('authenticators', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryMemberships: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(async () => {
        return database.find('memberships', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryVariables: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return database.find('variables', [
        Query.equal('resourceInternalId', [document.getSequence()]),
        Query.equal('resourceType', ['function']),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },

  encrypt: {
    encode: value => {
      const key = APP_OPENSSL_KEY_1;
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();

      return JSON.stringify({
        data: encrypted,
        method: 'aes-128-gcm',
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        version: '1',
      });
    },
    decode: (value: any) => {
      if (value === null) {
        return null;
      }
      value = typeof value === 'string' ? JSON.parse(value) : value;
      let key: string;
      switch (value.version) {
        case '1':
          key = APP_OPENSSL_KEY_1;
          break;
        default:
          key = APP_OPENSSL_KEY_1;
      }
      const iv = Buffer.from(value.iv, 'hex');
      const tag = Buffer.from(value.tag, 'hex');
      const decipher = crypto.createDecipheriv(value.method, key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(value.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    },
  },

  subQueryProjectVariables: {
    encode: () => {
      return null;
    },
    decode: async (_, __, database) => {
      return await database.find('variables', [
        Query.equal('resourceType', ['project']),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  userSearch: {
    encode: (_, user) => {
      const searchValues = [
        user.getId(),
        user.get('email', ''),
        user.get('name', ''),
        user.get('phone', ''),
      ];

      user.get('labels', []).forEach((label: string) => {
        searchValues.push('label:' + label);
      });

      return searchValues.filter(Boolean).join(' ');
    },
    decode: value => {
      return value;
    },
  },
  subQueryTargets: {
    encode: () => {
      return null;
    },
    decode: (_, document, database) => {
      return Authorization.skip(() => {
        return database.find('targets', [
          Query.equal('userInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryTopicTargets: {
    encode: () => {
      return null;
    },
    decode: async (_, document, database) => {
      const targetIds = await Authorization.skip(async () => {
        const subscribers = await database.find('subscribers', [
          Query.equal('topicInternalId', [document.getSequence()]),
          Query.limit(APP_LIMIT_SUBSCRIBERS_SUBQUERY),
        ]);
        return subscribers.map(subscriber =>
          subscriber.get('targetInternalId'),
        );
      });

      if (targetIds.length > 0) {
        return database.skipValidation(() =>
          database.find('targets', [Query.equal('$internalId', targetIds)]),
        );
      }
      return [];
    },
  },
  providerSearch: {
    encode: (_, provider) => {
      const searchValues = [
        provider.getId(),
        provider.get('name', ''),
        provider.get('provider', ''),
        provider.get('type', ''),
      ];

      return searchValues.filter(Boolean).join(' ');
    },
    decode: value => {
      return value;
    },
  },
  topicSearch: {
    encode: (_, topic) => {
      const searchValues = [
        topic.getId(),
        topic.get('name', ''),
        topic.get('description', ''),
      ];

      return searchValues.filter(Boolean).join(' ');
    },
    decode: value => {
      return value;
    },
  },
  messageSearch: {
    encode: (_, message) => {
      const searchValues = [
        message.getId(),
        message.get('description', ''),
        message.get('status', ''),
      ];

      const data = message.get('data', {});
      const providerType = message.get('providerType', '');

      if (providerType === 'email') {
        searchValues.push(data.subject, 'email');
      } else if (providerType === 'sms') {
        searchValues.push(data.content, 'sms');
      } else {
        searchValues.push(data.title, 'push');
      }

      return searchValues.filter(Boolean).join(' ');
    },
    decode: (value: any) => {
      return value;
    },
  },
};
