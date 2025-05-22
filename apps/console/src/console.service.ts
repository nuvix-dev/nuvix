import { Inject, Injectable, Logger } from '@nestjs/common';
import { Database, Document, Permission, Query, Role } from '@nuvix/database';
import collections from '@nuvix/core/collections';
import {
  DB_FOR_CONSOLE,
  APP_DATABASE_HOST,
  APP_DATABASE_USER,
  APP_DATABASE_PASSWORD,
  APP_DATABASE_NAME,
  APP_DATABASE_PORT,
} from '@nuvix/utils/constants';
import { createPool } from 'mysql2/promise';

@Injectable()
export class ConsoleService {
  private readonly logger = new Logger('CONSOLE');

  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly dbForConsole: Database,
  ) {}

  async createPlan() {
    const plans = [
      {
        $id: 'tier-0',
        name: 'Free',
        order: 0,
        price: 0,
        trial: 0,
        bandwidth: 5,
        storage: 2,
        members: 1,
        webhooks: 2,
        platforms: 3,
        users: 75000,
        teams: 100,
        databases: 1,
        buckets: 3,
        fileSize: 50,
        functions: 5,
        executions: 750000,
        realtime: 250,
        logs: 1,
        addons: {},
        customSmtp: false,
        emailBranding: true,
        requiresPaymentMethod: false,
        requiresBillingAddress: false,
        isAvailable: true,
        selfService: true,
        premiumSupport: false,
        budgeting: false,
        supportsMockNumbers: false,
        backupsEnabled: false,
        backupPolicies: -1,
      },
      {
        $id: 'tier-1',
        name: 'Pro',
        order: 10,
        price: 15,
        trial: 0,
        bandwidth: 300,
        storage: 150,
        members: 0,
        webhooks: 0,
        platforms: 0,
        users: 200000,
        teams: 0,
        databases: 0,
        buckets: 0,
        fileSize: 5000,
        functions: 0,
        executions: 3500000,
        realtime: 500,
        logs: 168,
        addons: {
          bandwidth: {
            unit: 'GB',
            price: 40,
            currency: 'USD',
            value: 100,
            multiplier: 1000000000,
            invoiceDesc: 'Calculated for all bandwidth used.',
          },
          storage: {
            unit: 'GB',
            price: 3,
            currency: 'USD',
            value: 100,
            multiplier: 1000000000,
            invoiceDesc:
              'Calculated for all compute operations (incl. functions builds, functions executions, hosting builds, and video transcoding time).',
          },
          member: {
            unit: '',
            price: 15,
            currency: 'USD',
            value: 1,
            invoiceDesc: 'Per additional member',
          },
          users: {
            unit: '',
            price: 0,
            currency: 'USD',
            value: 1000,
            invoiceDesc:
              'Active users across all projects in your organization.',
          },
          executions: {
            unit: '',
            price: 2,
            currency: 'USD',
            value: 1000000,
            invoiceDesc:
              'Calculated for all functions executed in your organization',
          },
          realtime: {
            unit: '',
            price: 5,
            currency: 'USD',
            value: 1000,
            invoiceDesc:
              'Calculated for all realtime concurrent connections sent to the projects in your organization.',
          },
        },
        customSmtp: true,
        emailBranding: false,
        requiresPaymentMethod: true,
        requiresBillingAddress: false,
        isAvailable: true,
        selfService: true,
        premiumSupport: true,
        budgeting: true,
        supportsMockNumbers: true,
        backupsEnabled: true,
        backupPolicies: 1,
      },
      {
        $id: 'tier-2',
        name: 'Scale',
        order: 20,
        price: 599,
        trial: 0,
        bandwidth: 300,
        storage: 150,
        members: 0,
        webhooks: 0,
        platforms: 0,
        users: 200000,
        teams: 0,
        databases: 0,
        buckets: 0,
        fileSize: 5000,
        functions: 0,
        executions: 3500000,
        realtime: 750,
        logs: 672,
        addons: {
          bandwidth: {
            unit: 'GB',
            price: 40,
            currency: 'USD',
            value: 100,
            multiplier: 1000000000,
            invoiceDesc:
              'Calculated for all bandwidth used across your organization.',
          },
          storage: {
            unit: 'GB',
            price: 3,
            currency: 'USD',
            value: 100,
            multiplier: 1000000000,
            invoiceDesc:
              'Calculated for all storage operations across your organization (including storage files, database data, function code, and static website hosting)',
          },
          member: {
            unit: '',
            price: 0,
            currency: 'USD',
            value: 0,
            invoiceDesc: 'Per additional member',
          },
          users: {
            unit: '',
            price: 0,
            currency: 'USD',
            value: 1000,
            invoiceDesc: 'Per 1,000 additional users',
          },
          executions: {
            unit: '',
            price: 2,
            currency: 'USD',
            value: 1000000,
            invoiceDesc: 'Every 1 million additional executions',
          },
          realtime: {
            unit: '',
            price: 5,
            currency: 'USD',
            value: 1000,
            invoiceDesc: 'Every 1000 concurrent connection',
          },
        },
        customSmtp: true,
        emailBranding: false,
        requiresPaymentMethod: true,
        requiresBillingAddress: false,
        isAvailable: true,
        selfService: true,
        premiumSupport: true,
        budgeting: true,
        supportsMockNumbers: true,
        backupsEnabled: true,
        backupPolicies: 2147483647,
      },
    ];

    for (const plan of plans) {
      const existingPlan = await this.dbForConsole.findOne('plans', [
        Query.equal('$id', [plan.$id]),
      ]);

      if (existingPlan.isEmpty()) {
        await this.dbForConsole.createDocument(
          'plans',
          new Document<any>({
            ...plan,
            $permissions: [
              Permission.read(Role.any()),
              Permission.create(Role.any()),
              Permission.update(Role.any()),
              Permission.delete(Role.any()),
            ],
          }),
        );
      }
    }

    return plans;
  }

  async getPlans() {
    return await this.dbForConsole.find('plans');
  }

  async getPlanById(id: string) {
    return await this.dbForConsole.findOne('plans', [Query.equal('$id', [id])]);
  }

  async initConsole() {
    try {
      try {
        const pool = createPool({
          host: APP_DATABASE_HOST,
          user: APP_DATABASE_USER,
          password: APP_DATABASE_PASSWORD,
          port: APP_DATABASE_PORT,
        });
        await pool.query(
          `CREATE DATABASE IF NOT EXISTS \`${this.dbForConsole.getDatabase()}\`;`,
        );
        await this.dbForConsole.create();
        await pool.end();
      } catch (e) {
        this.logger.error(e);
      }
      this.logger.log(`[Setup] - Starting...`);
      const consoleCollections = collections.console;
      for (const [key, collection] of Object.entries(
        consoleCollections,
      ) as any) {
        if ((collection as any).$collection !== Database.METADATA) {
          continue;
        }
        if (!(await this.dbForConsole.getCollection(key)).isEmpty()) {
          continue;
        }

        this.logger.log(`[Setup] - Creating collection: ${collection.$id}...`);

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

        await this.dbForConsole.createCollection(key, attributes, indexes);
      }

      const defaultBucket = await this.dbForConsole.getDocument(
        'buckets',
        'default',
      );
      if (
        defaultBucket.isEmpty() &&
        !(await this.dbForConsole.exists(
          this.dbForConsole.getDatabase(),
          'bucket_1',
        ))
      ) {
        this.logger.log('[Setup] - Creating default bucket...');

        await this.dbForConsole.createDocument(
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

        const bucket = await this.dbForConsole.getDocument(
          'buckets',
          'default',
        );

        this.logger.log(
          '[Setup] - Creating files collection for default bucket...',
        );

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

        await this.dbForConsole.createCollection(
          `bucket_${bucket.getInternalId()}`,
          fileAttributes,
          fileIndexes,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Setup] - Error while setting up console: ${error.message}`,
      );
    }

    return true;
  }

  async resetConsole() {
    return await this.dbForConsole.delete();
  }
}
