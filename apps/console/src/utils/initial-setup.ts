import { Logger } from '@nestjs/common';
import { Cache, Memory } from '@nuvix/cache';
import { Database, Document, MariaDB, Permission, Role } from '@nuvix/database';
import collections from '@nuvix/utils/collections';
import {
  APP_DATABASE_HOST,
  APP_DATABASE_NAME,
  APP_DATABASE_PASSWORD,
  APP_DATABASE_PORT,
  APP_DATABASE_USER,
} from '@nuvix/utils/constants';
import { createPool } from 'mysql2/promise';
import { Audit } from '@nuvix/audit';

export async function initSetup() {
  const logger = new Logger('Server Init');
  try {
    const pool = createPool({
      host: APP_DATABASE_HOST,
      user: APP_DATABASE_USER,
      password: APP_DATABASE_PASSWORD,
      port: APP_DATABASE_PORT,
    });
    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${APP_DATABASE_NAME}\`;`);
    await pool.end();

    const adapter = new MariaDB({
      connection: {
        host: APP_DATABASE_HOST,
        user: APP_DATABASE_USER,
        password: APP_DATABASE_PASSWORD,
        database: APP_DATABASE_NAME,
        port: APP_DATABASE_PORT,
      },
      maxVarCharLimit: 5000,
    });
    adapter.init();

    const cacheAdapter = new Memory();
    const cache = new Cache(cacheAdapter);

    const dbForPlatform = new Database(adapter, cache);

    logger.log(`[Setup] - Starting...`);
    const consoleCollections = collections.console;
    for (const [key, collection] of Object.entries(consoleCollections) as any) {
      if ((collection as any).$collection !== Database.METADATA) {
        continue;
      }
      if (!(await dbForPlatform.getCollection(key)).isEmpty()) {
        continue;
      }

      logger.log(`[Setup] - Creating collection: ${collection.$id}...`);

      const attributes = collection.attributes.map(
        (attribute: any) =>
          new Document({
            $id: attribute.$id,
            type: attribute.type,
            size: attribute.size,
            required: attribute.required,
            signed: attribute.signed,
            array: attribute.array,
            filters: attribute.filters,
            default: attribute.default ?? null,
            format: attribute.format ?? '',
          }),
      );

      const indexes = collection.indexes.map(
        (index: any) =>
          new Document({
            $id: index.$id,
            type: index.type,
            attributes: index.attributes,
            lengths: index.lengths,
            orders: index.orders,
          }),
      );

      await dbForPlatform.createCollection(key, attributes, indexes);
    }

    const defaultBucket = await dbForPlatform.getDocument('buckets', 'default');
    if (
      defaultBucket.isEmpty() &&
      !(await dbForPlatform.exists(dbForPlatform.getDatabase(), 'bucket_1'))
    ) {
      logger.log('[Setup] - Creating default bucket...');

      await dbForPlatform.createDocument(
        'buckets',
        new Document({
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

      logger.log('[Setup] - Creating files collection for default bucket...');

      const files = collections.buckets.files ?? [];
      if (!files) {
        throw new Error('Files collection is not configured.');
      }

      const fileAttributes = (files as any).attributes.map(
        (attribute: any) =>
          new Document({
            $id: attribute.$id,
            type: attribute.type,
            size: attribute.size,
            required: attribute.required,
            signed: attribute.signed,
            array: attribute.array,
            filters: attribute.filters,
            default: attribute.default ?? null,
            format: attribute.format ?? '',
          }),
      );

      const fileIndexes = (files as any).indexes.map(
        (index: any) =>
          new Document({
            $id: index.$id,
            type: index.type,
            attributes: index.attributes,
            lengths: index.lengths,
            orders: index.orders,
          }),
      );

      await dbForPlatform.createCollection(
        `bucket_${bucket.getInternalId()}`,
        fileAttributes,
        fileIndexes,
      );
    }
    if (
      !(await dbForPlatform.exists(
        dbForPlatform.getDatabase(),
        Audit.COLLECTION,
      ))
    ) {
      logger.log('[Setup] - Creating Audit Collection.');
      await new Audit(dbForPlatform).setup();
    }
    logger.log('[Setup] - Successfully complete the server setup.');
  } catch (error) {
    logger.error(`[Setup] - Error while setting up server: ${error.message}`);
    throw new Error('Something went worng in server setup process.');
  }
}
