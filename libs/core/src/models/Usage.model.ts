import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class UsageBucketsModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() filesTotal = 0 // Default to 0
  @Expose() filesStorageTotal = 0 // Default to 0
  @Expose() files: any[] = [] // Default to empty array
  @Expose() storage: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageBucketsModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageCollectionModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() documentsTotal = 0 // Default to 0
  @Expose() documents: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageCollectionModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageDatabaseModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() collectionsTotal = 0 // Default to 0
  @Expose() documentsTotal = 0 // Default to 0
  @Expose() collections: any[] = [] // Default to empty array
  @Expose() documents: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageDatabaseModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageDatabasesModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() databasesTotal = 0 // Default to 0
  @Expose() collectionsTotal = 0 // Default to 0
  @Expose() documentsTotal = 0 // Default to 0
  @Expose() databases: any[] = [] // Default to empty array
  @Expose() collections: any[] = [] // Default to empty array
  @Expose() documents: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageDatabasesModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageFunctionModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() deploymentsTotal = 0 // Default to 0
  @Expose() deploymentsStorageTotal = 0 // Default to 0
  @Expose() buildsTotal = 0 // Default to 0
  @Expose() buildsStorageTotal = 0 // Default to 0
  @Expose() buildsTimeTotal = 0 // Default to 0
  @Expose() buildsMbSecondsTotal = 0 // Default to 0
  @Expose() executionsTotal = 0 // Default to 0
  @Expose() executionsTimeTotal = 0 // Default to 0
  @Expose() executionsMbSecondsTotal = 0 // Default to 0
  @Expose() deployments: any[] = [] // Default to empty array
  @Expose() deploymentsStorage: any[] = [] // Default to empty array
  @Expose() builds: any[] = [] // Default to empty array
  @Expose() buildsStorage: any[] = [] // Default to empty array
  @Expose() buildsTime: any[] = [] // Default to empty array
  @Expose() buildsMbSeconds: any[] = [] // Default to empty array
  @Expose() executions: any[] = [] // Default to empty array
  @Expose() executionsTime: any[] = [] // Default to empty array
  @Expose() executionsMbSeconds: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageFunctionModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageFunctionsModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() functionsTotal = 0 // Default to 0
  @Expose() deploymentsTotal = 0 // Default to 0
  @Expose() deploymentsStorageTotal = 0 // Default to 0
  @Expose() buildsTotal = 0 // Default to 0
  @Expose() buildsStorageTotal = 0 // Default to 0
  @Expose() buildsTimeTotal = 0 // Default to 0
  @Expose() buildsMbSecondsTotal = 0 // Default to 0
  @Expose() executionsTotal = 0 // Default to 0
  @Expose() executionsTimeTotal = 0 // Default to 0
  @Expose() executionsMbSecondsTotal = 0 // Default to 0
  @Expose() functions: any[] = [] // Default to empty array
  @Expose() deployments: any[] = [] // Default to empty array
  @Expose() deploymentsStorage: any[] = [] // Default to empty array
  @Expose() builds: any[] = [] // Default to empty array
  @Expose() buildsStorage: any[] = [] // Default to empty array
  @Expose() buildsTime: any[] = [] // Default to empty array
  @Expose() buildsMbSeconds: any[] = [] // Default to empty array
  @Expose() executions: any[] = [] // Default to empty array
  @Expose() executionsTime: any[] = [] // Default to empty array
  @Expose() executionsMbSeconds: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageFunctionsModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageProjectModel extends BaseModel {
  @Expose() executionsTotal = 0 // Default to 0
  @Expose() documentsTotal = 0 // Default to 0
  @Expose() databasesTotal = 0 // Default to 0
  @Expose() usersTotal = 0 // Default to 0
  @Expose() filesStorageTotal = 0 // Default to 0
  @Expose() functionsStorageTotal = 0 // Default to 0
  @Expose() buildsStorageTotal = 0 // Default to 0
  @Expose() deploymentsStorageTotal = 0 // Default to 0
  @Expose() bucketsTotal = 0 // Default to 0
  @Expose() executionsMbSecondsTotal = 0 // Default to 0
  @Expose() buildsMbSecondsTotal = 0 // Default to 0
  @Expose() requests: any[] = [] // Default to empty array
  @Expose() network: any[] = [] // Default to empty array
  @Expose() users: any[] = [] // Default to empty array
  @Expose() executions: any[] = [] // Default to empty array
  @Expose() executionsBreakdown: any[] = [] // Default to empty array
  @Expose() bucketsBreakdown: any[] = [] // Default to empty array
  @Expose() executionsMbSecondsBreakdown: any[] = [] // Default to empty array
  @Expose() buildsMbSecondsBreakdown: any[] = [] // Default to empty array
  @Expose() functionsStorageBreakdown: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageProjectModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageStorageModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() bucketsTotal = 0 // Default to 0
  @Expose() filesTotal = 0 // Default to 0
  @Expose() filesStorageTotal = 0 // Default to 0
  @Expose() buckets: any[] = [] // Default to empty array
  @Expose() files: any[] = [] // Default to empty array
  @Expose() storage: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageStorageModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}

@Exclude()
export class UsageUsersModel extends BaseModel {
  @Expose() range = '' // Default to empty string
  @Expose() usersTotal = 0 // Default to 0
  @Expose() sessionsTotal = 0 // Default to 0
  @Expose() users: any[] = [] // Default to empty array
  @Expose() sessions: any[] = [] // Default to empty array

  constructor(partial: Partial<UsageUsersModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
