import { Logger } from '@nestjs/common';
import { Cache, Memory } from '@nuvix/cache';
import {
  Database,
  Doc,
  Permission,
  Role,
  DuplicateException,
  Adapter,
  Authorization,
} from '@nuvix-tech/db';
import collections from '@nuvix/utils/collections';
import { Audit } from '@nuvix/audit';
import { Client } from 'pg';
import { AppConfigService } from '@nuvix/core';

export async function initSetup(config: AppConfigService) {
  const logger = new Logger('Setup');
  try {
    const { host, password, port, user, name } =
      config.getDatabaseConfig().platform;
    const client = new Client({
      host,
      password,
      port,
      user,
      database: name,
    });

    try {
      await client.connect();
    } catch (error: any) {
      logger.error("Can't connect to database.", error.message);
      throw error;
    }

    const adapter = new Adapter(client);
    const cacheAdapter = new Memory();
    const cache = new Cache(cacheAdapter);
    const dbForPlatform = new Database(adapter, cache);
    dbForPlatform.setMeta({
      schema: 'public',
      sharedTables: false,
      database: name,
      namespace: 'platform',
    });

    try {
      await cache.flush();
      await dbForPlatform.create();
    } catch (e) {
      if (!(e instanceof DuplicateException)) throw e;
    }

    logger.log(`Starting...`);
    await Authorization.skip(async () => {
      const consoleCollections = collections.console;
      for (const [_, collection] of Object.entries(consoleCollections)) {
        if (collection.$collection !== Database.METADATA) {
          continue;
        }
        if (!(await dbForPlatform.getCollection(collection.$id)).empty()) {
          continue;
        }

        logger.log(`Creating collection: ${collection.$id}...`);

        const attributes = collection.attributes.map(
          attribute => new Doc(attribute),
        );

        const indexes = (collection.indexes ?? []).map(index => new Doc(index));

        await dbForPlatform.createCollection({
          id: collection.$id,
          attributes,
          indexes,
        });
      }

      const defaultBucket = await dbForPlatform.getDocument(
        'buckets',
        'default',
      );
      if (
        defaultBucket.empty() &&
        !(await dbForPlatform.exists(dbForPlatform.schema, 'bucket_1'))
      ) {
        logger.log('Creating default bucket...');

        await dbForPlatform.createDocument(
          'buckets',
          new Doc({
            $id: 'default',
            $collection: 'buckets',
            name: 'Default',
            maximumFileSize: 10 * 1024 * 1024, // 10MB
            allowedFileExtensions: [],
            enabled: true,
            compression: 'gzip',
            encryption: true,
            antivirus: true,
            fileSecurity: true,
            $permissions: [
              Permission.read(Role.any()),
              Permission.create(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any()),
            ],
            search: 'buckets Default',
          }),
        );

        const bucket = await dbForPlatform.getDocument('buckets', 'default');
        logger.log('Creating files collection for default bucket...');

        const files = collections.bucket['files'];
        if (!files) {
          throw new Error('Files collection is not configured.');
        }

        const fileAttributes = files.attributes.map(
          attribute => new Doc(attribute),
        );

        const fileIndexes = files.indexes?.map(index => new Doc(index));

        await dbForPlatform.createCollection({
          id: `bucket_${bucket.getSequence()}`,
          attributes: fileAttributes,
          indexes: fileIndexes,
        });
      }
      if (
        !(await dbForPlatform.exists(dbForPlatform.schema, Audit.COLLECTION))
      ) {
        logger.log('Creating Audit Collection.');
        await new Audit(dbForPlatform).setup();
      }
      logger.log('Successfully complete the server setup.');

      await cache.flush();
    });
  } catch (error: any) {
    logger.error(`Error while setting up server: ${error.message}`);
    throw new Error('Something went worng in server setup process.');
  }
}
