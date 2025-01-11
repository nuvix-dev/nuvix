import { FactoryProvider, Injectable, Logger, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DatabaseError } from 'pg-protocol';
import { DataSource, QueryRunner } from 'typeorm';
import { Exception } from './extend/exception';
import { Request } from 'express';

// Entities
import { UserEntity } from './entities/users/user.entity';
import { TeamEntity } from './entities/users/team.entity';
import { SessionEntity } from './entities/users/session.entity';
import { MembershipEntity } from './entities/users/membership.entity';
import { AuthenticatorEntity } from './entities/users/authenticator.entity';
import { TokenEntity } from './entities/users/token.entity';
import { TargetEntity } from './entities/messages/target.entity';
import { ChallengeEntity } from './entities/users/challenge.entity';
import { BucketEntity } from './entities/storage/bucket.entity';
import { InitialMigration } from './entities/initial-migration';
import { FileEntity } from './entities/storage/file.entity';
import { TopicEntity } from './entities/messages/topic.entity';
import { ProviderEntity } from './entities/messages/provider.entity';
import { SubscriberEntity } from './entities/messages/subscriber.entity';
import { MessageEntity } from './entities/messages/message.entity';
import { DatabaseEntity } from './entities/meta/database.entity';
import { StatsEntity } from './entities/meta/stats.entity';
import { VariablesEntity } from './entities/meta/variables.entity';
import { MigrationsEntity } from './entities/meta/migrations.entity';
import { IdentityEntity } from './entities/users/identity.entity';
import { FunctionEntity } from './entities/functions/function.entity';
import { BuildsEntity } from './entities/functions/builds.entity';
import { DeploymentEntity } from './entities/functions/deployment.entity';
import { ExecutionsEntity } from './entities/functions/executions.entity';

// Services
import { Project } from 'src/projects/schemas/project.schema';
import { ClsService, ClsServiceManager } from 'nestjs-cls';
import { PROJECT } from 'src/Utils/constants';


export const connectionFactory: FactoryProvider = {
  provide: 'CONNECTION',
  scope: Scope.REQUEST,
  durable: true,
  useFactory: async (
    cls: ClsService,
  ) => {
    const logger = cls.get('logger') as Logger;
    const project = cls.get(PROJECT) as Project;
    const tenantId = project.database;

    if (tenantId) {
      try {
        const connection = await new DbService().getTenantConnection(tenantId);
        logger.log(`Connection: ${connection.options.database}`);
        return connection;
      } catch (error) {
        logger.error(error);
        if (error instanceof DatabaseError) {
          throw new Exception(Exception.GENERAL_SERVER_ERROR, error.message, error.code);
        }
      }
    }

    return null;
  },
  inject: [ClsService],
};

const defaultConnectionOptions = {
  type: 'postgres',
  logging: true,
  host: process.env.DB_HOST || 'localhost',
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: true,
}

export class DbService {
  private connections = new Map<string, DataSource>();
  private logger = ClsServiceManager.getClsService().get('logger') as Logger;

  // Return or create a new connection for each tenant
  async getTenantConnection(tenantId: string): Promise<DataSource> {
    if (this.connections.has(tenantId)) {
      console.log('Connection exists');
      return this.connections.get(tenantId);
    }

    const connection = new DataSource({
      ...defaultConnectionOptions as any,
      database: tenantId,
      entities: [
        UserEntity,
        SessionEntity,
        AuthenticatorEntity,
        IdentityEntity,
        TokenEntity,
        ChallengeEntity,
        TeamEntity,
        MembershipEntity,
        BucketEntity,
        FileEntity,
        TargetEntity,
        TopicEntity,
        ProviderEntity,
        SubscriberEntity,
        MessageEntity,
        FunctionEntity,
        BuildsEntity,
        DeploymentEntity,
        ExecutionsEntity,
        DatabaseEntity,
        StatsEntity,
        VariablesEntity,
        MigrationsEntity
      ],  // Dynamically load tenant entities
      migrations: [InitialMigration],  // Dynamically load tenant migrations
      migrationsRun: false,  // Don't auto-run tenant migrations
      migrationsTableName: 'tenant_migration',
      synchronize: false,  // Don't auto-sync tenant DBs
      cache: {
        duration: 1000,
      },
      extra: {
        max: 10,  // Pool size, for instance
      },
    });

    await connection.initialize();
    this.connections.set(tenantId, connection);
    return connection;
  }

  async getConnection(): Promise<DataSource> {
    const connection = new DataSource({
      ...defaultConnectionOptions as any,
      synchronize: false,  // Don't auto-sync tenant DBs
      extra: {
        max: 10,  // Pool size, for instance
      },
    });  // Return or create a new connection for each tenant

    await connection.initialize();
    return connection;
  }
}
