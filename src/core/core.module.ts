import { Global, Logger, Module, Scope } from '@nestjs/common';
import * as fs from 'fs';

// Services
import { ClsService } from 'nestjs-cls';
import { DB_FOR_CONSOLE, DB_FOR_PROJECT, GEO_DB } from 'src/Utils/constants';
import { Database, MariaDB } from '@nuvix/database';
import { filters } from './resolver/db.resolver';
import { CountryResponse, Reader } from 'maxmind';

Object.keys(filters).forEach((key) => {
  Database.addFilter(key, {
    encode: filters[key].serialize,
    decode: filters[key].deserialize,
  });
});

@Global()
@Module({
  providers: [
    {
      provide: DB_FOR_CONSOLE,
      useFactory: async (cls: ClsService) => {
        const adapter = new MariaDB({
          connection: {
            host: process.env.DATABASE_HOST || 'localhost',
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            port: 3306,
          },
          maxVarCharLimit: 5000,
        });

        await adapter.init();

        const connection = new Database(adapter);

        await connection.ping();

        return connection;
      },
      inject: [ClsService],
    },
    {
      provide: DB_FOR_PROJECT,
      // scope: Scope.REQUEST,
      useFactory: async (cls: ClsService) => {
        const adapter = new MariaDB({
          connection: {
            host: process.env.DATABASE_HOST || 'localhost',
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME2,
            port: 3306,
          },
          maxVarCharLimit: 5000,
        });

        await adapter.init();

        const connection = new Database(adapter);

        await connection.ping();

        return connection;
      },
      inject: [ClsService],
    },
    {
      provide: GEO_DB,
      useFactory: async (cls: ClsService) => {
        const logger = cls.get<Logger>('logger');
        try {
          const buffer = fs.readFileSync(
            process.cwd() + '/assets/dbip/dbip-country-lite-2024-09.mmdb',
          );
          return new Reader<CountryResponse>(buffer);
        } catch (error) {
          logger.warn(
            'GeoIP database not found, country detection will be disabled',
          );
          return {};
        }
      },
      inject: [ClsService],
    },
  ],
  exports: [DB_FOR_CONSOLE, DB_FOR_PROJECT, GEO_DB],
})
export class CoreModule {}
