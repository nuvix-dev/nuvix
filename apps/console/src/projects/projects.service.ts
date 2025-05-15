import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateProjectDTO } from './dto/create-project.dto';
import {
  UpdateProjectDTO,
  UpdateProjectTeamDTO,
} from './dto/update-project.dto';
import { Exception } from '@nuvix/core/extend/exception';
import {
  API_KEY_DYNAMIC,
  API_KEY_STANDARD,
  APP_MAX_COUNT,
  APP_VERSION_STABLE,
  CACHE,
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
  GET_PROJECT_DB,
  GET_PROJECT_PG,
  POOLS,
} from '@nuvix/utils/constants';
import authMethods, {
  AuthMethod,
  defaultAuthConfig,
} from '@nuvix/core/config/auth';
import { oAuthProviders } from '@nuvix/core/config/authProviders';
import { defaultSmtpConfig } from '@nuvix/core/config/smtp';
import { services } from '@nuvix/core/config/services';
import { UpdateProjectServiceDTO } from './dto/project-service.dto';
import { ProjectApiStatusDTO } from './dto/project-api.dto';
import apis from '@nuvix/core/config/apis';
import { oAuth2DTO } from './dto/oauth2.dto';
import { AuthMockNumbersDTO } from './dto/project-auth.dto';
import { CreateWebhookDTO, UpdateWebhookDTO } from './dto/webhook.dto';
import { randomBytes } from 'crypto';
import { CreateKeyDTO, UpdateKeyDTO } from './dto/keys.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateJwtDTO } from './dto/create-jwt.dto';
import { CreatePlatformDTO, UpdatePlatformDTO } from './dto/platform.dto';
import { SmtpTestsDTO, UpdateSmtpDTO } from './dto/smtp.dto';
import {
  Database,
  Document,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/database';
import type {
  GetProjectDbFn,
  GetProjectPG,
  PoolStoreFn,
} from '@nuvix/core/core.module';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ProjectJobs,
  ProjectQueueOptions,
} from '@nuvix/core/resolvers/queues/project.queue';
import { Cache } from '@nuvix/cache';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly db: Database,
    @Inject(POOLS) private readonly getPool: PoolStoreFn,
    @Inject(GET_PROJECT_PG) private readonly getProjectPg: GetProjectPG,
    @Inject(CACHE) private readonly cache: Cache,
    @InjectQueue('projects')
    private readonly projectQueue: Queue<ProjectQueueOptions, any, ProjectJobs>,
    private readonly jwtService: JwtService,
  ) { }

  private readonly logger = new Logger(ProjectService.name);

  /**
   * Create a new project.
   */
  async create(data: CreateProjectDTO): Promise<Document> {
    const projectId =
      data.projectId === 'unique()'
        ? ID.unique()
        : ID.custom(data.projectId);
    const {
      teamId, password, name, description, logo, region,
      url, legalAddress, legalCity, legalCountry, legalName, legalState, legalTaxId
    } = data;

    try {
      const org = await this.db.getDocument('teams', teamId);

      if (!org || org.isEmpty())
        throw new Exception(
          Exception.TEAM_NOT_FOUND,
          'Organization not found.',
        );

      if (projectId === 'console') {
        throw new Exception(
          Exception.PROJECT_RESERVED_PROJECT,
          '`console` is a reserved project.',
        );
      }

      const auths = loadAuthConfig(authMethods);

      const defaultoAuthProviders = [];
      const defaultServices = {};

      Object.entries(oAuthProviders).forEach(([key, value]) => {
        if (value.enabled) {
          defaultoAuthProviders.push({
            key: key,
            name: value.name,
            appId: '',
            secret: '',
            enabled: false,
          });
        }
      });

      Object.values(services).forEach(value => {
        if (value.optional) {
          defaultServices[value.key] = true;
        }
      });

      let project = new Document({
        $id: projectId,
        $permissions: [
          Permission.read(Role.team(ID.custom(teamId))),
          Permission.update(
            Role.team(ID.custom(teamId), 'owner'),
          ),
          Permission.update(
            Role.team(ID.custom(teamId), 'developer'),
          ),
          Permission.delete(
            Role.team(ID.custom(teamId), 'owner'),
          ),
          Permission.delete(
            Role.team(ID.custom(teamId), 'developer'),
          ),
        ],
        teamId: org.getId(),
        teamInternalId: org.getInternalId(),
        name: name,
        region: region,
        description: description ?? null,
        logo: logo ?? null,
        url: url ?? null,
        legalName: legalName ?? null,
        legalCity: legalCity ?? null,
        legalAddress: legalAddress ?? null,
        legalCountry: legalCountry ?? null,
        legalState: legalState ?? null,
        legalTaxId: legalTaxId ?? null,
        platforms: [],
        oAuthProviders: defaultoAuthProviders,
        webhooks: [],
        smtp: defaultSmtpConfig,
        keys: [],
        auths: auths,
        services: defaultServices,
        accessedAt: new Date(),
        version: APP_VERSION_STABLE,
        database: 'undefiend', // Will be updated after database creation
      });

      project = await this.db.createDocument('projects', project);

      const pool = await this.getPool('root', {} as any);
      const dbName = `project_${project.getInternalId()}`;

      try {
        const checkResult = await pool.query(
          `SELECT 1 FROM pg_database WHERE datname = $1`,
          [dbName],
        );

        if (checkResult.rowCount === 0) {
          await pool.query(`CREATE DATABASE ${dbName}`);
          this.logger.log(`Created database: ${dbName}`);
        }

        project = await this.db.updateDocument(
          'projects',
          project.getId(),
          project.setAttribute('database', dbName),
        );
        await this.db.purgeCachedDocument('projects', project.getId());
      } catch (error) {
        this.logger.error(
          `Failed to create database: ${error.message}`,
          error.stack,
        );
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to create project database',
        );
      } finally {
        // Always release the connection
        // TODO: ----
      }

      const projectPool = await this.getPool(project.getId(), {
        database: dbName,
      });
      const client = await projectPool.connect();
      const projectPg = this.getProjectPg(client);

      try {
        await projectPg.init();
      } catch (e) {
        this.logger.error(e);
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          `Failed to initialize project database.`,
        );
      }

      try {
        client.release();
      } catch {
        /** noop */
      }

      await this.projectQueue.add('init', {
        project,
      });

      return project;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.PROJECT_ALREADY_EXISTS);
      } else throw error;
    }
  }

  async findAll(queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const cursor = queries.find(query =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const projectId = cursor.getValue();
      const cursorDocument = await this.db.getDocument('projects', projectId);

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Project '${projectId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries)['filters'];

    return {
      projects: await this.db.find('projects', queries),
      total: await this.db.count('projects', filterQueries, APP_MAX_COUNT),
    };
  }

  async findOne(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    return project;
  }

  async update(id: string, updateProjectDTO: UpdateProjectDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    project
      .setAttribute('name', updateProjectDTO.name)
      .setAttribute('description', updateProjectDTO.description)
      .setAttribute('logo', updateProjectDTO.logo)
      .setAttribute('url', updateProjectDTO.url)
      .setAttribute('legalName', updateProjectDTO.legalName)
      .setAttribute('legalCity', updateProjectDTO.legalCity)
      .setAttribute('legalAddress', updateProjectDTO.legalAddress)
      .setAttribute('legalCountry', updateProjectDTO.legalCountry)
      .setAttribute('legalState', updateProjectDTO.legalState)
      .setAttribute('legalTaxId', updateProjectDTO.legalTaxId)
      .setAttribute('search', [id, updateProjectDTO.name].join(' '));

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project,
    );

    return project;
  }

  /**
   * Delete a project.
   */
  async remove(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    if (!(await this.db.deleteDocument('projects', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove project from DB',
      );
    }

    return;
  }

  /**
   * Update organization of a project.
   */
  async updateProjectOrganization(id: string, input: UpdateProjectTeamDTO) {
    let project = await this.db.getDocument('projects', id);
    const team = await this.db.getDocument('teams', input.teamId);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    if (team.isEmpty()) {
      throw new Exception(Exception.TEAM_NOT_FOUND);
    }

    const permissions = [
      Permission.read(Role.team(ID.custom(input.teamId))),
      Permission.update(Role.team(ID.custom(input.teamId), 'owner')),
      Permission.update(Role.team(ID.custom(input.teamId), 'developer')),
      Permission.delete(Role.team(ID.custom(input.teamId), 'owner')),
      Permission.delete(Role.team(ID.custom(input.teamId), 'developer')),
    ];

    project
      .setAttribute('teamId', input.teamId)
      .setAttribute('teamInternalId', team.getInternalId())
      .setAttribute('$permissions', permissions);

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project,
    );

    const installations = await this.db.find('installations', [
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);
    for (const installation of installations) {
      installation.getAttribute('$permissions', permissions);
      await this.db.updateDocument(
        'installations',
        installation.getId(),
        installation,
      );
    }

    const repositories = await this.db.find('repositories', [
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);
    for (const repository of repositories) {
      repository.getAttribute('$permissions', permissions);
      await this.db.updateDocument(
        'repositories',
        repository.getId(),
        repository,
      );
    }

    const vcsComments = await this.db.find('vcsComments', [
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);
    for (const vcsComment of vcsComments) {
      vcsComment.getAttribute('$permissions', permissions);
      await this.db.updateDocument(
        'vcsComments',
        vcsComment.getId(),
        vcsComment,
      );
    }

    return project;
  }

  /**
   * Get platforms of a project.
   */
  async getPlatforms(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platforms = await this.db.find('platforms', [
      Query.equal('projectInternalId', [project.getInternalId()]),
      Query.limit(5000),
    ]);

    return {
      total: platforms.length,
      platforms: platforms,
    };
  }

  /**
   * Create a platform for a project.
   */
  async createPlatform(id: string, input: CreatePlatformDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = new Document({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getInternalId(),
      projectId: project.getId(),
      type: input.type,
      name: input.name,
      key: input.key ?? null,
      store: input.store ?? null,
      hostname: input.hostname ?? null,
    });

    const createdPlatform = await this.db.createDocument('platforms', platform);

    await this.db.purgeCachedDocument('projects', project.getId());

    return createdPlatform;
  }

  /**
   * Get a Platform.
   */
  async getPlatform(id: string, platformId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (platform.isEmpty()) {
      throw new Exception(Exception.PLATFORM_NOT_FOUND);
    }

    return platform;
  }

  /**
   * Update a Platform.
   */
  async updatePlatform(
    id: string,
    platformId: string,
    input: UpdatePlatformDTO,
  ) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (platform.isEmpty()) {
      throw new Exception(Exception.PLATFORM_NOT_FOUND);
    }

    platform
      .setAttribute('name', input.name)
      .setAttribute('key', input.key)
      .setAttribute('store', input.store)
      .setAttribute('hostname', input.hostname);

    await this.db.updateDocument('platforms', platform.getId(), platform);
    await this.db.purgeCachedDocument('projects', project.getId());

    return platform;
  }

  /**
   * Delete a Platform.
   */
  async deletePlatform(id: string, platformId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (platform.isEmpty()) {
      throw new Exception(Exception.PLATFORM_NOT_FOUND);
    }

    await this.db.deleteDocument('platforms', platformId);
    await this.db.purgeCachedDocument('projects', project.getId());

    return {};
  }

  /**
   * Get keys of a project.
   */
  async getKeys(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const keys = await this.db.find('keys', [
      Query.equal('projectInternalId', [project.getInternalId()]),
      Query.limit(5000),
    ]);

    return {
      total: keys.length,
      keys: keys,
    };
  }

  /**
   * Create a key for a project.
   */
  async createKey(id: string, input: CreateKeyDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = new Document({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getInternalId(),
      projectId: project.getId(),
      name: input.name,
      scopes: input.scopes,
      expire: input.expire ?? null,
      sdks: [],
      accessedAt: null,
      secret: API_KEY_STANDARD + '_' + randomBytes(128).toString('hex'),
    });

    const createdKey = await this.db.createDocument('keys', key);

    await this.db.purgeCachedDocument('projects', project.getId());

    return createdKey;
  }

  /**
   * Get a Key.
   */
  async getKey(id: string, keyId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (key.isEmpty()) {
      throw new Exception(Exception.KEY_NOT_FOUND);
    }

    return key;
  }

  /**
   * Update a Key.
   */
  async updateKey(id: string, keyId: string, input: UpdateKeyDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (key.isEmpty()) {
      throw new Exception(Exception.KEY_NOT_FOUND);
    }

    key
      .setAttribute('name', input.name)
      .setAttribute('scopes', input.scopes)
      .setAttribute('expire', input.expire ?? null);

    await this.db.updateDocument('keys', key.getId(), key);
    await this.db.purgeCachedDocument('projects', project.getId());

    return key;
  }

  /**
   * Delete a Key.
   */
  async deleteKey(id: string, keyId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (key.isEmpty()) {
      throw new Exception(Exception.KEY_NOT_FOUND);
    }

    await this.db.deleteDocument('keys', key.getId());
    await this.db.purgeCachedDocument('projects', project.getId());

    return {};
  }

  /**
   * Create A JWT token.
   */
  async createJwt(id: string, input: CreateJwtDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const jwt = await this.jwtService.signAsync(
      { projectId: project.getId(), scopes: input.scopes },
      { expiresIn: input.duration },
    );

    return {
      jwt: API_KEY_DYNAMIC + '_' + jwt,
    };
  }

  /**
   * Get webhooks of a project.
   */
  async getWebhooks(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhooks = await this.db.find('webhooks', [
      Query.equal('projectInternalId', [project.getInternalId()]),
      Query.limit(5000),
    ]);

    return {
      total: webhooks.length,
      webhooks: webhooks,
    };
  }

  /**
   * Create a webhook for a project.
   */
  async createWebhook(id: string, input: CreateWebhookDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = new Document({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getInternalId(),
      projectId: project.getId(),
      name: input.name,
      events: input.events,
      url: input.url,
      security: input.security,
      httpUser: input.httpUser,
      httpPass: input.httpPass,
      signatureKey: randomBytes(64).toString('hex'),
      enabled: input.enabled,
    });

    const createdWebhook = await this.db.createDocument('webhooks', webhook);

    await this.db.purgeCachedDocument('projects', project.getId());

    return createdWebhook;
  }

  /**
   * Get a Webhook.
   */
  async getWebhook(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (webhook.isEmpty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    return webhook;
  }

  /**
   * Update a Webhook.
   */
  async updateWebhook(id: string, webhookId: string, input: UpdateWebhookDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (webhook.isEmpty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    webhook
      .setAttribute('name', input.name)
      .setAttribute('events', input.events)
      .setAttribute('url', input.url)
      .setAttribute('security', input.security)
      .setAttribute('httpUser', input.httpUser)
      .setAttribute('httpPass', input.httpPass)
      .setAttribute('enabled', input.enabled);

    if (input.enabled) {
      webhook.setAttribute('attempts', 0);
    }

    await this.db.updateDocument('webhooks', webhook.getId(), webhook);
    await this.db.purgeCachedDocument('projects', project.getId());

    return webhook;
  }

  /**
   * Update Signature of a Webhook.
   */
  async updateWebhookSignature(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (webhook.isEmpty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    webhook.setAttribute('signatureKey', randomBytes(64).toString('hex'));

    await this.db.updateDocument('webhooks', webhook.getId(), webhook);
    await this.db.purgeCachedDocument('projects', project.getId());

    return webhook;
  }

  /**
   * Delete a Webhook.
   */
  async deleteWebhook(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getInternalId()]),
    ]);

    if (webhook.isEmpty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    await this.db.deleteDocument('webhooks', webhook.getId());
    await this.db.purgeCachedDocument('projects', project.getId());

    return {};
  }

  /**
   * Update service status of a project.
   */
  async updateServiceStatus(id: string, input: UpdateProjectServiceDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const services = project.getAttribute('services', {});
    services[input.service] = input.status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('services', services),
    );

    return project;
  }

  /**
   * Update all services status of a project.
   */
  async updateAllServiceStatus(id: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const servicesObj = {};
    Object.entries(services).forEach(([key, value]) => {
      if (value.optional) {
        servicesObj[key] = status;
      }
    });

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('services', servicesObj),
    );

    return project;
  }

  /**
   * Update Apis status of a project.
   */
  async updateApiStatus(id: string, input: ProjectApiStatusDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const apis = project.getAttribute('apis', {});
    apis[input.api] = input.status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('apis', apis),
    );

    return project;
  }

  /**
   * Update all Apis status of a project.
   */
  async updateAllApiStatus(id: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const apisObj = {};
    Object.keys(apis).forEach(api => {
      apisObj[api] = status;
    });

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('apis', apisObj),
    );

    return project;
  }

  /**
   * Update OAuth2 of a project.
   */
  async updateOAuth2(id: string, input: oAuth2DTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const providers = project.getAttribute('oAuthProviders', []);
    const providerIndex = providers.findIndex(
      (provider: any) => provider.key === input.provider,
    );

    if (providerIndex === -1) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    if (input.appId !== undefined) {
      providers[providerIndex].appId = input.appId;
    }

    if (input.secret !== undefined) {
      providers[providerIndex].secret = input.secret;
    }

    if (input.enabled !== undefined) {
      providers[providerIndex].enabled = input.enabled;
    }

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('oAuthProviders', providers),
    );

    return project;
  }

  /**
   * Update session alerts of a project.
   */
  async updateSessionAlerts(id: string, status: boolean = false) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.sessionAlerts = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update users limit of a project.
   */
  async updateAuthLimit(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.limit = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update session duration of a project.
   */
  async updateSessionDuration(id: string, duration: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.duration = duration;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update auth method of a project.
   */
  async updateAuthMethod(id: string, method: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auth: any = authMethods[method] ?? {};
    const authKey = auth.key ?? '';

    const auths = project.getAttribute('auths', {});
    auths[authKey] = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update password history of a project.
   */
  async updatePasswordHistory(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.passwordHistory = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update password dictionary of a project.
   */
  async updatePasswordDictionary(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.passwordDictionary = enabled;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update personal data of a project.
   */
  async updatePersonalData(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.personalDataCheck = enabled;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update max sessions of a project.
   */
  async updateMaxSessions(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.getAttribute('auths', {});
    auths.maxSessions = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update mock numbers of a project.
   */
  async updateMockNumbers(id: string, input: AuthMockNumbersDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const uniqueNumbers: { [key: string]: string } = {};
    input.numbers.forEach(number => {
      if (uniqueNumbers[number.phone]) {
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          'Duplicate phone numbers are not allowed.',
        );
      }
      uniqueNumbers[number.phone] = number.otp;
    });

    const auths = project.getAttribute('auths', {});
    auths.mockNumbers = input.numbers;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('auths', auths),
    );

    return project;
  }

  /**
   * Update SMTP of a project.
   */
  async updateSMTP(id: string, input: UpdateSmtpDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.isEmpty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    if (input.enabled) {
      if (!input.senderName) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Sender name is required when enabling SMTP.',
        );
      }
      if (!input.senderEmail) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Sender email is required when enabling SMTP.',
        );
      }
      if (!input.host) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Host is required when enabling SMTP.',
        );
      }
      if (!input.port) {
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Port is required when enabling SMTP.',
        );
      }
    }

    // Note: SMTP validation is commented out as it requires implementation
    // of SMTP validation logic

    const smtp = input.enabled
      ? {
        enabled: input.enabled,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        replyTo: input.replyTo,
        host: input.host,
        port: input.port,
        username: input.username,
        password: input.password,
        secure: input.secure,
      }
      : {
        enabled: false,
      };

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.setAttribute('smtp', smtp),
    );

    return project;
  }

  /**
   * @todo :- Impliment the function...
   * Test SMTP
   */
  async testSMTP(id: string, input: SmtpTestsDTO) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
    return {};
  }
}

function loadAuthConfig(authMethods: Record<string, AuthMethod>) {
  const authConfig = { ...defaultAuthConfig };

  Object.values(authMethods).forEach(method => {
    if (method.enabled) {
      authConfig[method.key] = true;
    }
  });

  return authConfig;
}
