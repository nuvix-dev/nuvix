import { Logger } from '@nestjs/common';
import {
  Database,
  Doc,
  Permission,
  Role,
  DuplicateException,
  Adapter,
  Authorization,
  ID,
} from '@nuvix/db';
import collections from '@nuvix/utils/collections';
import { Audit } from '@nuvix/audit';
import { Client } from 'pg';
import { AppConfigService, CoreService } from '@nuvix/core';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DatabaseRole, DEFAULT_DATABASE } from '@nuvix/utils';
import { AccountService } from '../account/account.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { ProjectService } from '../projects/projects.service';
import { ProjectsQueue } from '@nuvix/core/resolvers';

export async function initSetup(
  app: NestFastifyApplication,
  config: AppConfigService,
) {
  const logger = new Logger('Setup');
  const coreService = app.get(CoreService);
  try {
    const { host, password, port, user, name } =
      config.getDatabaseConfig().platform;

    if (config.isSelfHosted) {
      const rootClient = new Client({
        host,
        password,
        port,
        user: DatabaseRole.ADMIN,
        database: DEFAULT_DATABASE,
      });
      try {
        await rootClient.connect();
        const res = await rootClient.query(
          `SELECT 1 FROM pg_database WHERE datname='${name}'`,
        );
        if (res.rowCount === 0) {
          logger.log(`Database ${name} does not exist. Creating...`);
          await rootClient.query(`CREATE DATABASE "${name}"`);
          logger.log(`Database ${name} created.`);
        }
      } catch (error: any) {
        logger.error("Can't create database.", error.message);
        throw error;
      } finally {
        await rootClient.end();
      }
    }

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
    const cache = coreService.getCache();
    const dbForPlatform = new Database(adapter, cache);
    dbForPlatform.setMeta({
      schema: 'public',
      sharedTables: false,
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
        if (await dbForPlatform.exists(dbForPlatform.schema, collection.$id)) {
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
          permissions: [Permission.create(Role.any())],
          documentSecurity: true,
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

      // TODO: improve project setup for selfhost and make it dynamic based on multi project or single project
      if (config.isSelfHosted) {
        logger.log('Setting up project.');
        const accountService = app.get(AccountService);
        const orgService = app.get(OrganizationsService);
        const projectService = app.get(ProjectService);
        const projectsQueue = app.get(ProjectsQueue);

        const adminEmail = 'admin@nuvix.local';
        const adminPassword = 'password';
        const isExists = (
          await dbForPlatform.findOne('users', qb =>
            qb.equal('email', adminEmail),
          )
        ).empty();
        if (!isExists) {
          const user = await accountService.createAccount(
            ID.unique(),
            adminEmail,
            adminPassword,
            undefined,
            new Doc(),
            '',
          );
          const team = await orgService.create(user, {
            organizationId: 'my-team',
            name: 'Team',
          });
          const project = await projectService.create({
            projectId: 'default',
            name: 'Project',
            teamId: team.getId(),
            region: 'local',
            password: password ?? 'password',
          });

          await projectsQueue.devInit(project, {
            host,
            port,
          });

          project
            .set('status', 'active')
            .set('database', {
              postgres: {
                host,
                port,
                password,
              },
              pool: {
                host,
                port: 6432,
                password,
              },
            })
            .set('environment', 'local');

          await dbForPlatform.updateDocument(
            'projects',
            project.getId(),
            project,
          );

          logger.log('Project setup complete.');
          logger.log(`Admin email: ${adminEmail}`);
          logger.log(`Admin password: ${adminPassword}`);
        }
      }

      logger.log('Successfully complete the server setup.');
      await cache.flush();
    });
  } catch (error: any) {
    logger.error(`Error while setting up server: ${error.message}`);
    throw new Error('Something went worng in server setup process.');
  }
}
