import {
  Authorization,
  Database,
  DatetimeValidator,
  Document,
  Query,
  RangeValidator,
} from '@nuvix/database';
import {
  APP_DATABASE_ATTRIBUTE_DATETIME,
  APP_DATABASE_ATTRIBUTE_EMAIL,
  APP_DATABASE_ATTRIBUTE_ENUM,
  APP_DATABASE_ATTRIBUTE_FLOAT_RANGE,
  APP_DATABASE_ATTRIBUTE_INT_RANGE,
  APP_DATABASE_ATTRIBUTE_IP,
  APP_DATABASE_ATTRIBUTE_URL,
  APP_LIMIT_SUBQUERY,
  APP_LIMIT_SUBSCRIBERS_SUBQUERY,
  APP_OPENSSL_KEY_1,
} from 'src/Utils/constants';
import crypto from 'crypto';
import { EmailValidator } from '../validators/email.validator';
import { URLValidator } from '../validators/url.validator';
import { IPValidator } from '../validators/ip.validator';
import { WhiteList } from '../validators/whitelist.validator';

export const filters = {
  casting: {
    serialize: (value: any) => {
      return JSON.stringify({ value: value }, (key, value) => {
        return typeof value === 'number' && !isFinite(value)
          ? String(value)
          : value;
      });
    },
    deserialize: (value: any) => {
      if (value == null || value === undefined) {
        return null;
      }

      return JSON.parse(value)?.value;
    },
  },
  enum: {
    serialize: ((value: any, attribute: Document) => {
      if (attribute.isSet('elements')) {
        attribute.removeAttribute('elements');
      }

      return value;
    }) as any,
    deserialize: ((value: any, attribute: Document) => {
      const formatOptions = JSON.parse(
        attribute.getAttribute('formatOptions', '[]'),
      );
      if (formatOptions.elements) {
        attribute.setAttribute('elements', formatOptions.elements);
      }

      return value;
    }) as any,
  },
  range: {
    serialize: (value: any, attribute: Document) => {
      if (attribute.isSet('min')) {
        attribute.removeAttribute('min');
      }
      if (attribute.isSet('max')) {
        attribute.removeAttribute('max');
      }

      return value;
    },
    deserialize: (value: any, attribute: Document) => {
      const formatOptions = JSON.parse(
        attribute.getAttribute('formatOptions', '[]'),
      );
      if (formatOptions.min || formatOptions.max) {
        attribute
          .setAttribute('min', formatOptions.min)
          .setAttribute('max', formatOptions.max);
      }

      return value;
    },
  },
  subQueryAttributes: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      const attributes = await database.find('attributes', [
        Query.equal('collectionInternalId', [document.getInternalId()]),
        Query.limit(database.getLimitForAttributes()),
      ]);

      attributes.forEach(attribute => {
        if (attribute.getAttribute('type') === Database.VAR_RELATIONSHIP) {
          const options = attribute.getAttribute('options');
          Object.keys(options).forEach(key => {
            attribute.setAttribute(key, options[key]);
          });
          attribute.removeAttribute('options');
        }
      });

      return attributes;
    },
  },
  subQueryIndexes: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('indexes', [
        Query.equal('collectionInternalId', [document.getInternalId()]),
        Query.limit(database.getLimitForIndexes()),
      ]);
    },
  },
  subQueryPlatforms: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('platforms', [
        Query.equal('projectInternalId', [document.getInternalId()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },

  subQueryKeys: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('keys', [
        Query.equal('projectInternalId', [document.getInternalId()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  subQueryWebhooks: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('webhooks', [
        Query.equal('projectInternalId', [document.getInternalId()]),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  subQuerySessions: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('sessions', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryTokens: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('tokens', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryChallenges: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('challenges', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryAuthenticators: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('authenticators', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryMemberships: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('memberships', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  subQueryVariables: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('variables', [
        Query.equal('resourceInternalId', [document.getInternalId()]),
        Query.equal('resourceType', ['function']),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },

  encrypt: {
    serialize: (value: any) => {
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
    deserialize: (value: any) => {
      if (value === null) {
        return null;
      }
      value = typeof value === 'string' ? JSON.parse(value) : value;
      let key: string;
      switch (value.version) {
        case '1':
          key = APP_OPENSSL_KEY_1;
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
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await database.find('variables', [
        Query.equal('resourceType', ['project']),
        Query.limit(APP_LIMIT_SUBQUERY),
      ]);
    },
  },
  userSearch: {
    serialize: (value: any, user: Document) => {
      const searchValues = [
        user.getId(),
        user.getAttribute('email', ''),
        user.getAttribute('name', ''),
        user.getAttribute('phone', ''),
      ];

      user.getAttribute('labels', []).forEach((label: string) => {
        searchValues.push('label:' + label);
      });

      return searchValues.filter(Boolean).join(' ');
    },
    deserialize: (value: any) => {
      return value;
    },
  },
  subQueryTargets: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      return await Authorization.skip(async () => {
        return await database.find('targets', [
          Query.equal('userInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBQUERY),
        ]);
      });
    },
  },
  // subProjectQueryTargets: {
  //   serialize: (value: any) => {
  //     return null;
  //   },
  //   deserialize: async (value: any, document: Document, database: Database) => {
  //     return await Authorization.skip(async () => {
  //       const db = new Database(database.getAdapter(), database.getCache());
  //       db.setDatabase('messaging');
  //       return await db.find('targets', [
  //         Query.equal('userInternalId', [document.getInternalId()]),
  //         Query.limit(APP_LIMIT_SUBQUERY),
  //       ]);
  //     });
  //   },
  // },
  subQueryTopicTargets: {
    serialize: (value: any) => {
      return null;
    },
    deserialize: async (value: any, document: Document, database: Database) => {
      const targetIds = await Authorization.skip(async () => {
        const subscribers = await database.find('subscribers', [
          Query.equal('topicInternalId', [document.getInternalId()]),
          Query.limit(APP_LIMIT_SUBSCRIBERS_SUBQUERY),
        ]);
        return subscribers.map((subscriber: Document) =>
          subscriber.getAttribute('targetInternalId'),
        );
      });

      if (targetIds.length > 0) {
        return await database.skipValidation(async () => {
          return await database.find('targets', [
            Query.equal('$internalId', targetIds),
          ]);
        });
      }
      return [];
    },
  },
  providerSearch: {
    serialize: (value: any, provider: Document) => {
      const searchValues = [
        provider.getId(),
        provider.getAttribute('name', ''),
        provider.getAttribute('provider', ''),
        provider.getAttribute('type', ''),
      ];

      return searchValues.filter(Boolean).join(' ');
    },
    deserialize: (value: any) => {
      return value;
    },
  },
  topicSearch: {
    serialize: (value: any, topic: Document) => {
      const searchValues = [
        topic.getId(),
        topic.getAttribute('name', ''),
        topic.getAttribute('description', ''),
      ];

      return searchValues.filter(Boolean).join(' ');
    },
    deserialize: (value: any) => {
      return value;
    },
  },
  messageSearch: {
    serialize: (value: any, message: Document) => {
      const searchValues = [
        message.getId(),
        message.getAttribute('description', ''),
        message.getAttribute('status', ''),
      ];

      const data = JSON.parse(message.getAttribute('data', '{}'));
      const providerType = message.getAttribute('providerType', '');

      if (providerType === 'email') {
        searchValues.push(data.subject, 'email');
      } else if (providerType === 'sms') {
        searchValues.push(data.content, 'sms');
      } else {
        searchValues.push(data.title, 'push');
      }

      return searchValues.filter(Boolean).join(' ');
    },
    deserialize: (value: any) => {
      return value;
    },
  },
};

export const formats = {
  [APP_DATABASE_ATTRIBUTE_EMAIL]: {
    create: () => new EmailValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_DATETIME]: {
    create: () => new DatetimeValidator(),
    type: Database.VAR_DATETIME,
  },
  [APP_DATABASE_ATTRIBUTE_ENUM]: {
    create: (attribute: any) => {
      const elements = attribute.formatOptions.elements;
      return new WhiteList(elements, true);
    },
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_IP]: {
    create: () => new IPValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_URL]: {
    create: () => new URLValidator(),
    type: Database.VAR_STRING,
  },
  [APP_DATABASE_ATTRIBUTE_INT_RANGE]: {
    create: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, `integer`);
    },
    type: Database.VAR_INTEGER,
  },
  [APP_DATABASE_ATTRIBUTE_FLOAT_RANGE]: {
    create: (attribute: any) => {
      const min = attribute.formatOptions.min ?? -Infinity;
      const max = attribute.formatOptions.max ?? Infinity;
      return new RangeValidator(min, max, `float`);
    },
    type: Database.VAR_FLOAT,
  },
};
