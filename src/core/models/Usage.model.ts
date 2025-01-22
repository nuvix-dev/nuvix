import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class UsageBucketsModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() filesTotal: number = 0; // Default to 0
  @Expose() filesStorageTotal: number = 0; // Default to 0
  @Expose() files: any[] = []; // Default to empty array
  @Expose() storage: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageBucketsModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageCollectionModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() documentsTotal: number = 0; // Default to 0
  @Expose() documents: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageCollectionModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageDatabaseModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() collectionsTotal: number = 0; // Default to 0
  @Expose() documentsTotal: number = 0; // Default to 0
  @Expose() collections: any[] = []; // Default to empty array
  @Expose() documents: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageDatabaseModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageDatabasesModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() databasesTotal: number = 0; // Default to 0
  @Expose() collectionsTotal: number = 0; // Default to 0
  @Expose() documentsTotal: number = 0; // Default to 0
  @Expose() databases: any[] = []; // Default to empty array
  @Expose() collections: any[] = []; // Default to empty array
  @Expose() documents: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageDatabasesModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageFunctionModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() deploymentsTotal: number = 0; // Default to 0
  @Expose() deploymentsStorageTotal: number = 0; // Default to 0
  @Expose() buildsTotal: number = 0; // Default to 0
  @Expose() buildsStorageTotal: number = 0; // Default to 0
  @Expose() buildsTimeTotal: number = 0; // Default to 0
  @Expose() buildsMbSecondsTotal: number = 0; // Default to 0
  @Expose() executionsTotal: number = 0; // Default to 0
  @Expose() executionsTimeTotal: number = 0; // Default to 0
  @Expose() executionsMbSecondsTotal: number = 0; // Default to 0
  @Expose() deployments: any[] = []; // Default to empty array
  @Expose() deploymentsStorage: any[] = []; // Default to empty array
  @Expose() builds: any[] = []; // Default to empty array
  @Expose() buildsStorage: any[] = []; // Default to empty array
  @Expose() buildsTime: any[] = []; // Default to empty array
  @Expose() buildsMbSeconds: any[] = []; // Default to empty array
  @Expose() executions: any[] = []; // Default to empty array
  @Expose() executionsTime: any[] = []; // Default to empty array
  @Expose() executionsMbSeconds: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageFunctionModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageFunctionsModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() functionsTotal: number = 0; // Default to 0
  @Expose() deploymentsTotal: number = 0; // Default to 0
  @Expose() deploymentsStorageTotal: number = 0; // Default to 0
  @Expose() buildsTotal: number = 0; // Default to 0
  @Expose() buildsStorageTotal: number = 0; // Default to 0
  @Expose() buildsTimeTotal: number = 0; // Default to 0
  @Expose() buildsMbSecondsTotal: number = 0; // Default to 0
  @Expose() executionsTotal: number = 0; // Default to 0
  @Expose() executionsTimeTotal: number = 0; // Default to 0
  @Expose() executionsMbSecondsTotal: number = 0; // Default to 0
  @Expose() functions: any[] = []; // Default to empty array
  @Expose() deployments: any[] = []; // Default to empty array
  @Expose() deploymentsStorage: any[] = []; // Default to empty array
  @Expose() builds: any[] = []; // Default to empty array
  @Expose() buildsStorage: any[] = []; // Default to empty array
  @Expose() buildsTime: any[] = []; // Default to empty array
  @Expose() buildsMbSeconds: any[] = []; // Default to empty array
  @Expose() executions: any[] = []; // Default to empty array
  @Expose() executionsTime: any[] = []; // Default to empty array
  @Expose() executionsMbSeconds: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageFunctionsModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageProjectModel extends BaseModel {
  @Expose() executionsTotal: number = 0; // Default to 0
  @Expose() documentsTotal: number = 0; // Default to 0
  @Expose() databasesTotal: number = 0; // Default to 0
  @Expose() usersTotal: number = 0; // Default to 0
  @Expose() filesStorageTotal: number = 0; // Default to 0
  @Expose() functionsStorageTotal: number = 0; // Default to 0
  @Expose() buildsStorageTotal: number = 0; // Default to 0
  @Expose() deploymentsStorageTotal: number = 0; // Default to 0
  @Expose() bucketsTotal: number = 0; // Default to 0
  @Expose() executionsMbSecondsTotal: number = 0; // Default to 0
  @Expose() buildsMbSecondsTotal: number = 0; // Default to 0
  @Expose() requests: any[] = []; // Default to empty array
  @Expose() network: any[] = []; // Default to empty array
  @Expose() users: any[] = []; // Default to empty array
  @Expose() executions: any[] = []; // Default to empty array
  @Expose() executionsBreakdown: any[] = []; // Default to empty array
  @Expose() bucketsBreakdown: any[] = []; // Default to empty array
  @Expose() executionsMbSecondsBreakdown: any[] = []; // Default to empty array
  @Expose() buildsMbSecondsBreakdown: any[] = []; // Default to empty array
  @Expose() functionsStorageBreakdown: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageProjectModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageStorageModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() bucketsTotal: number = 0; // Default to 0
  @Expose() filesTotal: number = 0; // Default to 0
  @Expose() filesStorageTotal: number = 0; // Default to 0
  @Expose() buckets: any[] = []; // Default to empty array
  @Expose() files: any[] = []; // Default to empty array
  @Expose() storage: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageStorageModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}

@Exclude()
export class UsageUsersModel extends BaseModel {
  @Expose() range: string = ''; // Default to empty string
  @Expose() usersTotal: number = 0; // Default to 0
  @Expose() sessionsTotal: number = 0; // Default to 0
  @Expose() users: any[] = []; // Default to empty array
  @Expose() sessions: any[] = []; // Default to empty array

  constructor(partial: Partial<UsageUsersModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
