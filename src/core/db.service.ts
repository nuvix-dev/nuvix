import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DatabaseError } from 'pg-protocol';
import { DataSource, QueryRunner } from 'typeorm';
import { Exception } from './extend/exception';

// Entities
import { UserEntity } from './entities/user.entity';
import { TeamEntity } from './entities/team.entity';
import { SessionEntity } from './entities/session.entity';
import { MembershipEntity } from './entities/membership.entity';
import { AuthenticatorEntity } from './entities/authenticator.entity';
import { TokenEntity } from './entities/token.entity';
import { TargetEntity } from './entities/target.entity';
import { ChallengeEntity } from './entities/challenge.entity';
import { BucketEntity } from './entities/bucket.entity';
import { InitialMigration } from './entities/initial-migration';
import { Request } from 'express';


export const connectionFactory = {
  provide: 'CONNECTION',
  scope: Scope.REQUEST,
  useFactory: async (request: Request) => {
    const projectId = request.headers['x-project-id'];
    const tenantId = 'project_' + projectId;

    if (projectId) {
      try {
        const connection = await new DbService().getTenantConnection(tenantId);
        return connection;
      } catch (error) {
        if (error instanceof DatabaseError) {
          throw new Exception(Exception.GENERAL_SERVER_ERROR, error.message, error.code);
        }
      }
    }

    return null;
  },
  inject: [REQUEST],
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
  private readonly connections: Map<string, DataSource> = new Map();

  // Return or create a new connection for each tenant
  async getTenantConnection(tenantId: string): Promise<DataSource> {
    if (this.connections.has(tenantId)) {
      return this.connections.get(tenantId);
    }

    const connection = new DataSource({
      ...defaultConnectionOptions as any,
      database: tenantId,  // Tenant-specific database
      entities: [
        UserEntity,
        TeamEntity,
        SessionEntity,
        MembershipEntity,
        AuthenticatorEntity,
        TokenEntity,
        TargetEntity,
        ChallengeEntity,
        BucketEntity
      ],  // Dynamically load tenant entities
      migrations: [InitialMigration],  // Dynamically load tenant migrations
      migrationsRun: false,  // Don't auto-run tenant migrations
      migrationsTableName: 'tenant_migration',  // Custom tenant migration table
      synchronize: false,  // Don't auto-sync tenant DBs
      extra: {
        max: 10,  // Pool size, for instance
      },
    });  // Return or create a new connection for each tenant

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
