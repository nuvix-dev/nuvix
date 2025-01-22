import { Inject, Injectable } from '@nestjs/common';
import { Database, Document, Query } from '@nuvix/database';
import collections from 'src/core/collections';
import { DB_FOR_CONSOLE } from 'src/Utils/constants';

@Injectable()
export class ConsoleService {
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly dbForConsole: Database,
  ) {}

  async createPlan() {
    let plans = [
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
        addons: [],
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
        backupPolicies: 9223372036854775807,
      },
    ];

    plans = (await this.dbForConsole.createDocuments(
      'plans',
      plans.map((p) => new Document(p)),
    )) as any;

    return plans;
  }

  async getPlans() {
    return await this.dbForConsole.find('plans', [
      Query.equal('isAvailable', [true]),
    ]);
  }

  async getPlanById(id: string) {
    return await this.dbForConsole.findOne('plans', [Query.equal('$id', [id])]);
  }

  async applyONE() {
    try {
      Object.entries(collections.console).map(async ([key, value]) => {
        console.log(key, value.attributes.length, value.indexes.length);

        return await this.dbForConsole.createCollection(
          value.$id,
          value.attributes.map((a: any) => new Document(a)),
          // value.indexes.map((i: any) => new Document(i))
        );
      });
    } catch (e) {
      console.error(e);
    }
    return 'HU HA';
  }
}
