import { Injectable, Logger } from '@nestjs/common';
import { CreateProjectDTO } from './DTO/create-project.dto';
import {
  UpdateProjectDTO,
  UpdateProjectTeamDTO,
} from './DTO/update-project.dto';
import { Exception } from '@nuvix/core/extend/exception';
import {
  ApiKey,
  APP_MAX_COUNT,
  DatabaseRole,
  DEFAULT_DATABASE,
  QueueFor,
  type DatabaseConfig,
} from '@nuvix/utils';
import authMethods, {
  AuthMethod,
  defaultAuthConfig,
} from '@nuvix/core/config/auth';
import {
  oAuthProviders,
  type OAuthProviderType,
} from '@nuvix/core/config/authProviders';
import { defaultSmtpConfig } from '@nuvix/core/config/smtp';
import { services } from '@nuvix/core/config/services';
import { UpdateProjectServiceDTO } from './DTO/project-service.dto';
import { ProjectApiStatusDTO } from './DTO/project-api.dto';
import apis from '@nuvix/core/config/apis';
import { oAuth2DTO } from './DTO/oauth2.dto';
import { AuthMockNumbersDTO } from './DTO/project-auth.dto';
import { CreateWebhookDTO, UpdateWebhookDTO } from './DTO/webhook.dto';
import { randomBytes } from 'crypto';
import { CreateKeyDTO, UpdateKeyDTO } from './DTO/keys.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateJwtDTO } from './DTO/create-jwt.dto';
import { CreatePlatformDTO, UpdatePlatformDTO } from './DTO/platform.dto';
import { SmtpTestsDTO, UpdateSmtpDTO } from './DTO/smtp.dto';
import {
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  Role,
} from '@nuvix/db';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ProjectJob,
  ProjectQueueOptions,
} from '@nuvix/core/resolvers/queues/projects.queue';
import { AppConfigService, CoreService } from '@nuvix/core';
import type { EnvironmentTokens, Projects } from '@nuvix/utils/types';
import type { CreateEnvTokenDTO } from './DTO/env-token.dto';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);
  private readonly db: Database;

  constructor(
    private coreService: CoreService,
    private readonly appConfig: AppConfigService,
    @InjectQueue(QueueFor.PROJECTS)
    private readonly projectQueue: Queue<
      ProjectQueueOptions,
      unknown,
      ProjectJob
    >,
    private readonly jwtService: JwtService,
  ) {
    this.db = coreService.getPlatformDb();
  }

  /**
   * Create a new project.
   */
  async create({
    projectId: _projectId,
    teamId,
    password,
    name,
    env,
    ...rest
  }: CreateProjectDTO): Promise<Doc<Projects>> {
    const projectId = _projectId === 'unique()' ? ID.unique() : _projectId;

    const mainConfig = this.appConfig.get('app');
    if (mainConfig.projects.disabled && !this.appConfig.isSelfHost) {
      throw new Exception(
        Exception.GENERAL_API_DISABLED,
        'Projects are disabled',
      );
    } else if (
      !mainConfig.projects.allowedProdCreate &&
      env === 'prod' &&
      !this.appConfig.isSelfHost
    ) {
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'Creating production projects is not allowed',
      );
    }

    try {
      const org = await this.db.getDocument('teams', teamId);

      if (org.empty())
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
      const defaultoAuthProviders: OAuthProviderType[] = [];
      const defaultServices: Record<string, boolean> = {};

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

      let project = new Doc<Projects>({
        ...rest,
        $id: projectId,
        $permissions: [
          Permission.read(Role.team(ID.custom(teamId))),
          Permission.update(Role.team(ID.custom(teamId), 'owner')),
          Permission.update(Role.team(ID.custom(teamId), 'developer')),
          Permission.delete(Role.team(ID.custom(teamId), 'owner')),
          Permission.delete(Role.team(ID.custom(teamId), 'developer')),
        ],
        teamId: org.getId(),
        teamInternalId: org.getSequence(),
        name: name,
        oAuthProviders: defaultoAuthProviders as any,
        smtp: defaultSmtpConfig as any,
        auths: auths,
        services: defaultServices,
        accessedAt: new Date(),
        environment: env || 'dev',
        database: {
          postgres: {
            password,
          },
          pool: {
            password,
          },
          // other details will be set in queue worker
        } as any,
        enabled: true,
        status: 'pending',
      });

      project = await this.db.createDocument('projects', project);

      // In case if project env is not dev then we need to init the project
      // dev projects will be initialized while envtoken creation
      if (project.get('environment') !== 'dev' && !this.appConfig.isSelfHost) {
        await this.projectQueue.add(ProjectJob.INIT, {
          project,
        });
      }

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

    const filterQueries = Query.groupByType(queries)['filters'];
    return {
      projects: await this.db.find('projects', queries),
      total: await this.db.count('projects', filterQueries, APP_MAX_COUNT),
    };
  }

  async findOne(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    return project;
  }

  async update(id: string, updateProjectDTO: UpdateProjectDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    project
      .set('name', updateProjectDTO.name)
      .set('description', updateProjectDTO.description)
      .set('logo', updateProjectDTO.logo)
      .set('url', updateProjectDTO.url)
      .set('search', [id, updateProjectDTO.name].join(' '));

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project,
    );

    return project;
  }

  /**
   * Create an environment token for a project.
   */
  async createEnvToken(
    { projectId, name, url, metadata }: CreateEnvTokenDTO,
    req: NuvixRequest,
  ) {
    const project = await this.db.getDocument('projects', projectId);

    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    if (project.get('environment') !== 'dev')
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'Env tokens can only be created for dev projects',
      );

    // url must be in format tcp://example:port
    const { host, port } = await this.validateDbUrl(project, url);

    const token = new Doc<EnvironmentTokens>({
      name: name || `Env Token #${ID.unique(1).slice(0, 7)}`,
      projectId: project.getId(),
      projectInternalId: project.getSequence(),
      token: ApiKey.DEV + '_' + randomBytes(128).toString('hex'),
      metadata: { ...metadata, host, port, pool_port: port, requestIp: req.ip },
      $permissions: [
        Permission.read(Role.team(project.get('teamId'))),
        Permission.update(Role.team(project.get('teamId'), 'owner')),
        Permission.delete(Role.team(project.get('teamId'), 'owner')),
      ],
    });

    const createdToken = await this.db.createDocument('envtokens', token);

    // if this is the first token, then we need to initialize the project
    // const tokens = await this.db.find('envtokens',
    //   qb => qb.equal('projectInternalId', project.getSequence())
    // );

    // if (tokens.length === 1) {
    await this.projectQueue.add(ProjectJob.DEV_INIT, {
      project,
      dbConfig: {
        host,
        port,
      },
    });
    // }

    return createdToken;
  }

  /**
   * Update an environment token for a project.
   */
  async updateEnvToken(projectId: string, tokenId: string, url: string) {
    const project = await this.db.getDocument('projects', projectId);
    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND);

    const token = await this.db.findOne('envtokens', qb =>
      qb
        .equal('token', tokenId)
        .equal('projectInternalId', project.getSequence()),
    );

    if (token.empty())
      throw new Exception(Exception.GENERAL_NOT_FOUND, 'Token not found');

    const { host, port } = await this.validateDbUrl(project, url);

    token.set('metadata', {
      ...token.get('metadata', {}),
      host,
      port,
      pool_port: port,
    });
    return this.db.updateDocument('envtokens', token.getId(), token);
  }

  async listEnvTokens() {
    return {
      projects: await this.db.find('envtokens'),
      total: await this.db.count('envtokens', undefined, APP_MAX_COUNT),
    };
  }

  async validateDbUrl(project: Doc<Projects>, url: string) {
    let host: string, port: number;
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'tcp:' && urlObj.protocol !== 'tls:')
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          'URL protocol must be tcp',
        );
      host = urlObj.hostname;
      port = parseInt(urlObj.port, 10);
      if (!host || !port || port <= 0 || port > 65535) {
        throw new Exception(Exception.GENERAL_BAD_REQUEST, 'Invalid URL');
      }
    } catch (e) {
      if (e instanceof Exception) throw e;
      throw new Exception(Exception.GENERAL_BAD_REQUEST, 'Invalid URL');
    }

    try {
      const client = await this.coreService.createProjectDbClient(
        project.getId(),
        {
          host,
          port,
          database: DEFAULT_DATABASE,
          user: DatabaseRole.ADMIN,
          password: (project.get('database') as unknown as DatabaseConfig)?.pool
            ?.password,
        },
      );
      await client.query('SELECT 1;');
      await client.end();
    } catch (e: any) {
      throw new Exception(
        Exception.GENERAL_UNKNOWN,
        `Database connection failed. ${e?.message}`,
      );
    }

    return { host, port };
  }

  /**
   * Delete a project.
   */
  async remove(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    if (team.empty()) {
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
      .set('teamId', input.teamId)
      .set('teamInternalId', team.getSequence())
      .set('$permissions', permissions);

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project,
    );

    const installations = await this.db.find('installations', [
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);
    for (const installation of installations) {
      installation.get('$permissions', permissions);
      await this.db.updateDocument(
        'installations',
        installation.getId(),
        installation,
      );
    }

    const repositories = await this.db.find('repositories', [
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);
    for (const repository of repositories) {
      repository.get('$permissions', permissions);
      await this.db.updateDocument(
        'repositories',
        repository.getId(),
        repository,
      );
    }

    const vcsComments = await this.db.find('vcsComments', [
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);
    for (const vcsComment of vcsComments) {
      vcsComment.get('$permissions', permissions);
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platforms = await this.db.find('platforms', [
      Query.equal('projectInternalId', [project.getSequence()]),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = new Doc({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getSequence(),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (platform.empty()) {
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (platform.empty()) {
      throw new Exception(Exception.PLATFORM_NOT_FOUND);
    }

    platform
      .set('name', input.name)
      .set('key', input.key)
      .set('store', input.store)
      .set('hostname', input.hostname);

    await this.db.updateDocument('platforms', platform.getId(), platform);
    await this.db.purgeCachedDocument('projects', project.getId());

    return platform;
  }

  /**
   * Delete a Platform.
   */
  async deletePlatform(id: string, platformId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const platform = await this.db.findOne('platforms', [
      Query.equal('$id', [platformId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (platform.empty()) {
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const keys = await this.db.find('keys', [
      Query.equal('projectInternalId', [project.getSequence()]),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = new Doc({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getSequence(),
      projectId: project.getId(),
      name: input.name,
      scopes: input.scopes,
      expire: input.expire ?? null,
      sdks: [],
      accessedAt: null,
      secret: ApiKey.STANDARD + '_' + randomBytes(128).toString('hex'),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (key.empty()) {
      throw new Exception(Exception.KEY_NOT_FOUND);
    }

    return key;
  }

  /**
   * Update a Key.
   */
  async updateKey(id: string, keyId: string, input: UpdateKeyDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (key.empty()) {
      throw new Exception(Exception.KEY_NOT_FOUND);
    }

    key
      .set('name', input.name)
      .set('scopes', input.scopes)
      .set('expire', input.expire ?? null);

    await this.db.updateDocument('keys', key.getId(), key);
    await this.db.purgeCachedDocument('projects', project.getId());

    return key;
  }

  /**
   * Delete a Key.
   */
  async deleteKey(id: string, keyId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const key = await this.db.findOne('keys', [
      Query.equal('$id', [keyId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (key.empty()) {
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const jwt = await this.jwtService.signAsync(
      { projectId: project.getId(), scopes: input.scopes },
      { expiresIn: input.duration },
    );

    return {
      jwt: ApiKey.DYNAMIC + '_' + jwt,
    };
  }

  /**
   * Get webhooks of a project.
   */
  async getWebhooks(id: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhooks = await this.db.find('webhooks', [
      Query.equal('projectInternalId', [project.getSequence()]),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = new Doc({
      $id: ID.unique(),
      $permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      projectInternalId: project.getSequence(),
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    return webhook;
  }

  /**
   * Update a Webhook.
   */
  async updateWebhook(id: string, webhookId: string, input: UpdateWebhookDTO) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    webhook
      .set('name', input.name)
      .set('events', input.events)
      .set('url', input.url)
      .set('security', input.security)
      .set('httpUser', input.httpUser)
      .set('httpPass', input.httpPass)
      .set('enabled', input.enabled);

    if (input.enabled) {
      webhook.set('attempts', 0);
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

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    webhook.set('signatureKey', randomBytes(64).toString('hex'));

    await this.db.updateDocument('webhooks', webhook.getId(), webhook);
    await this.db.purgeCachedDocument('projects', project.getId());

    return webhook;
  }

  /**
   * Delete a Webhook.
   */
  async deleteWebhook(id: string, webhookId: string) {
    const project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const webhook = await this.db.findOne('webhooks', [
      Query.equal('$id', [webhookId]),
      Query.equal('projectInternalId', [project.getSequence()]),
    ]);

    if (webhook.empty()) {
      throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    }

    await this.db.deleteDocument('webhooks', webhook.getId());
    await this.db.purgeCachedDocument('projects', project.getId());

    return {};
  }

  /**
   * Update service status of a project.
   */
  async updateServiceStatus(
    id: string,
    { status, service }: UpdateProjectServiceDTO,
  ) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const services = project.get('services', {});
    services[service] = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('services', services),
    );

    return project;
  }

  /**
   * Update all services status of a project.
   */
  async updateAllServiceStatus(id: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const servicesObj: Record<string, boolean> = {};
    Object.entries(services).forEach(([, value]) => {
      if (value.optional) {
        servicesObj[value.key] = status;
      }
    });

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('services', servicesObj),
    );

    return project;
  }

  /**
   * Update Apis status of a project.
   */
  async updateApiStatus(id: string, { api, status }: ProjectApiStatusDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const apis = project.get('apis', {});
    apis[api] = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('apis', apis),
    );

    return project;
  }

  /**
   * Update all Apis status of a project.
   */
  async updateAllApiStatus(id: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const apisObj: Record<string, boolean> = {};
    Object.keys(apis).forEach(api => {
      apisObj[api] = status;
    });

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('apis', apisObj),
    );

    return project;
  }

  /**
   * Update OAuth2 of a project.
   */
  async updateOAuth2(
    id: string,
    { provider, appId, secret, enabled }: oAuth2DTO,
  ) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const providers = project.get('oAuthProviders', []) as OAuthProviderType[];
    const providerIndex = providers.findIndex(p => p.key === provider);

    if (providerIndex === -1) {
      throw new Exception(Exception.PROVIDER_NOT_FOUND);
    }

    if (appId !== undefined) {
      providers[providerIndex]!.appId = appId;
    }

    // TODO: Encrypt the secret
    if (secret !== undefined) {
      providers[providerIndex]!.secret = secret;
    }

    if (enabled !== undefined) {
      providers[providerIndex]!.enabled = enabled;
    }

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('oAuthProviders', providers),
    );

    return project;
  }

  /**
   * Update session alerts of a project.
   */
  async updateSessionAlerts(id: string, status: boolean = false) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['sessionAlerts'] = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update users limit of a project.
   */
  async updateAuthLimit(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['limit'] = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update session duration of a project.
   */
  async updateSessionDuration(id: string, duration: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['duration'] = duration;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update auth method of a project.
   */
  async updateAuthMethod(id: string, method: string, status: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auth: any = authMethods[method] ?? {};
    const authKey = auth.key ?? '';

    const auths = project.get('auths', {});
    auths[authKey] = status;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update password history of a project.
   */
  async updatePasswordHistory(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['passwordHistory'] = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update password dictionary of a project.
   */
  async updatePasswordDictionary(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['passwordDictionary'] = enabled;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update personal data of a project.
   */
  async updatePersonalData(id: string, enabled: boolean) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['personalDataCheck'] = enabled;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update max sessions of a project.
   */
  async updateMaxSessions(id: string, limit: number) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const auths = project.get('auths', {});
    auths['maxSessions'] = limit;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update mock numbers of a project.
   */
  async updateMockNumbers(id: string, input: AuthMockNumbersDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
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

    const auths = project.get('auths', {});
    auths['mockNumbers'] = input.numbers;

    project = await this.db.updateDocument(
      'projects',
      project.getId(),
      project.set('auths', auths),
    );

    return project;
  }

  /**
   * Update SMTP of a project.
   */
  async updateSMTP(id: string, input: UpdateSmtpDTO) {
    let project = await this.db.getDocument('projects', id);

    if (project.empty()) {
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

    // TODO: SMTP validation logic

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
      project.set('smtp', smtp),
    );

    return project;
  }

  /**
   * @todo :- Impliment the function...
   * Test SMTP
   */
  async testSMTP(id: string, input: SmtpTestsDTO) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }
}

function loadAuthConfig(authMethods: Record<string, AuthMethod>) {
  const authConfig: Record<string, any> = { ...defaultAuthConfig };

  Object.values(authMethods).forEach(method => {
    if (method.enabled) {
      authConfig[method.key] = true;
    }
  });

  return authConfig;
}
