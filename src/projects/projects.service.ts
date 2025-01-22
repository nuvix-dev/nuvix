import { Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import {
  UpdateProjectDto,
  UpdateProjectTeamDto,
} from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { AuthConfig, Project, ProjectDocument } from './schemas/project.schema';
import { Model } from 'mongoose';
import { Exception } from 'src/core/extend/exception';
import { Organization } from 'src/console-user/schemas/organization.schema';
import { ID } from 'src/core/helper/ID.helper';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import {
  API_KEY_DYNAMIC,
  API_KEY_STANDARD,
  APP_VERSION_STABLE,
} from 'src/Utils/constants';
import authMethods, {
  AuthMethod,
  defaultAuthConfig,
} from 'src/core/config/auth';
import { DbService } from 'src/core/db.provider';
import { QueryBuilder } from 'src/Utils/mongo.filter';
import { oAuthProviders } from 'src/core/config/authProviders';
import { defaultSmtpConfig } from 'src/core/config/smtp';
import { services } from 'src/core/config/services';
import { ModelResolver } from 'src/core/resolver/model.resolver';
import { Database } from 'src/core/config/database';
import { UpdateProjectServiceDto } from './dto/project-service.dto';
import { ProjectApiStatusDto } from './dto/project-api.dto';
import apis from 'src/core/config/apis';
import { oAuth2Dto } from './dto/oauth2.dto';
import { AuthMockNumbersDto } from './dto/project-auth.dto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { Platform } from './schemas/platform.schema';
import { Key } from './schemas/key.schema';
import { Webhook } from './schemas/webhook.schema';
import { randomBytes } from 'crypto';
import { Auth } from 'src/core/helper/auth.helper';
import { CreateKeyDto, UpdateKeyDto } from './dto/keys.dto';
import { JwtService } from '@nestjs/jwt';
import { CreateJwtDto } from './dto/create-jwt.dto';
import { CreatePlatformDto, UpdatePlatformDto } from './dto/platform.dto';
import { SmtpTestsDto, UpdateSmtpDto } from './dto/smtp.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project.name, 'server')
    private readonly projectModel: Model<Project>,
    @InjectModel(Organization.name, 'server')
    private readonly orgModel: Model<Organization>,
    @InjectModel(Platform.name, 'server')
    private readonly platformModel: Model<Platform>,
    @InjectModel(Key.name, 'server') private readonly keyModel: Model<Key>,
    @InjectModel(Webhook.name, 'server')
    private readonly webhookModel: Model<Webhook>,
    private readonly jwtService: JwtService,
  ) {}

  private readonly logger = new Logger(ProjectService.name);

  /**
   * Create a new project.
   */
  async create(createProjectDto: CreateProjectDto): Promise<ProjectDocument> {
    let projectId =
      createProjectDto.projectId === 'unique()'
        ? ID.unique()
        : ID.auto(createProjectDto.projectId);
    try {
      let org = await this.orgModel.findOne({ id: createProjectDto.teamId });
      if (!org)
        throw new Exception(
          Exception.TEAM_NOT_FOUND,
          'Organization not found.',
        );

      let auths = loadAuthConfig(authMethods);

      let defaultoAuthProviders = [];
      let defaultServices = {};

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

      Object.values(services).forEach((value) => {
        if (value.optional) {
          defaultServices[value.key] = true;
        }
      });

      const project = await this.projectModel.create({
        id: projectId,
        $permissions: [
          Permission.Read(Role.Team(ID.custom(createProjectDto.teamId))),
          Permission.Update(
            Role.Team(ID.custom(createProjectDto.teamId), 'owner'),
          ),
          Permission.Update(
            Role.Team(ID.custom(createProjectDto.teamId), 'developer'),
          ),
          Permission.Delete(
            Role.Team(ID.custom(createProjectDto.teamId), 'owner'),
          ),
          Permission.Delete(
            Role.Team(ID.custom(createProjectDto.teamId), 'developer'),
          ),
        ],
        orgId: org.id,
        orgInternalId: org._id,
        name: createProjectDto.name,
        region: createProjectDto.region,
        description: createProjectDto.description,
        logo: createProjectDto.logo,
        url: createProjectDto.url,
        legalName: createProjectDto.legalName,
        legalCity: createProjectDto.legalCity,
        legalAddress: createProjectDto.legalAddress,
        legalCountry: createProjectDto.legalCountry,
        legalState: createProjectDto.legalState,
        legalTaxId: createProjectDto.legalTaxId,
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

      await project.save();

      const runner = (await new DbService().getConnection()).createQueryRunner(
        'master',
      );
      await runner.createDatabase('project_' + project.id);
      await runner.release();

      project.database = 'project_' + project.id;

      await project.save();
      const db = await new DbService().getTenantConnection(project.database);
      this.logger.log('Running migrations for project ' + project.id);
      const migrations = await db.runMigrations();
      this.logger.log(
        'Migrations run for project ' + project.id + ': ' + migrations,
      );

      return project;
    } catch (error) {
      try {
        await this.projectModel.deleteOne({ id: projectId });
      } catch (deleteError) {
        this.logger.error('Error deleting project after failure:', deleteError);
      }
      if (error instanceof Exception) {
        throw error;
      } else if (error.name === 'ValidationError') {
        throw Exception.fromValidation(error);
      } else if (error.code === 11000) {
        // Handle duplicate key errors
        // Check which field caused the duplicate key error. Adapt to your needs.
        if (error.keyPattern && error.keyPattern.name === 1) {
          throw new Exception(null, 'Project with this name already exists.');
        } else {
          console.error('Duplicate key error details:', error);
          throw new Exception(null, 'Duplicate key error occurred.');
        }
      } else {
        console.error('Error creating project:', error); // Log the error for debugging
        throw new Exception(null, 'Failed to create project.');
      }
    }
  }

  async findAll(queries?: string[], search?: string) {
    const baseQuery = this.projectModel
      .find()
      .populate(['platforms', 'keys', 'webhooks']);
    const queryBuilder = new QueryBuilder(baseQuery, ['name', 'teamId']);

    queryBuilder.parseQueryStrings(queries);

    if (search) {
      queryBuilder.addSearchFilter(search);
    }

    const { results, totalCount } = await queryBuilder.execute(true);

    return {
      total: totalCount,
      projects: results,
    };
  }

  async findOne(id: string, action: string = Database.PERMISSION_READ) {
    const project = await this.projectModel
      .findOne({ id: id })
      .populate(['platforms', 'keys', 'webhooks']);
    return new ModelResolver(project).getDocument(action);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    if (updateProjectDto.name) project.name = updateProjectDto.name;
    if (updateProjectDto.description)
      project.description = updateProjectDto.description;
    if (updateProjectDto.logo) project.logo = updateProjectDto.logo;
    if (updateProjectDto.url) project.url = updateProjectDto.url;
    if (updateProjectDto.legalName)
      project.legalName = updateProjectDto.legalName;
    if (updateProjectDto.legalCity)
      project.legalCity = updateProjectDto.legalCity;
    if (updateProjectDto.legalAddress)
      project.legalAddress = updateProjectDto.legalAddress;
    if (updateProjectDto.legalCountry)
      project.legalCountry = updateProjectDto.legalCountry;
    if (updateProjectDto.legalState)
      project.legalState = updateProjectDto.legalState;
    if (updateProjectDto.legalTaxId)
      project.legalTaxId = updateProjectDto.legalTaxId;

    await project.save();

    return;
  }

  /**
   * Remove a project.
   */
  async remove(id: string) {
    let project = await this.findOne(id, Database.PERMISSION_DELETE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');
    const runner = (await new DbService().getConnection()).createQueryRunner(
      'master',
    );
    await runner.dropDatabase('project_' + project.id, true);
    await runner.release();
    await project.deleteOne();
    return project;
  }

  /**
   * Update organization of a project.
   */
  async updateProjectOrganization(id: string, input: UpdateProjectTeamDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    let org = await this.orgModel.findOne({ id: input.teamId });
    org = new ModelResolver(org).getDocument(Database.PERMISSION_READ);
    if (!org)
      throw new Exception(Exception.TEAM_NOT_FOUND, 'Organization not found.');

    const permissions = [
      Permission.Read(Role.Team(ID.custom(input.teamId))).toString(),
      Permission.Update(Role.Team(ID.custom(input.teamId), 'owner')).toString(),
      Permission.Update(
        Role.Team(ID.custom(input.teamId), 'developer'),
      ).toString(),
      Permission.Delete(Role.Team(ID.custom(input.teamId), 'owner')).toString(),
      Permission.Delete(
        Role.Team(ID.custom(input.teamId), 'developer'),
      ).toString(),
    ];

    project.orgId = org.id;
    project.orgInternalId = org._id;
    project.permissions = permissions;
    await project.save();

    /**
     * @todo Change permissions of other related resources.
     */

    return project;
  }

  /**
   * Get platforms of a project.
   */
  async getPlatforms(id: string) {
    let project = await this.projectModel.findOne({ id: id });

    project = new ModelResolver(project).getDocument(Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    let platforms = await this.platformModel.find({
      projectInternalId: project._id,
    });
    return {
      total: platforms?.length || 0,
      platforms: platforms || [],
    };
  }

  /**
   * Create a platform for a project.
   */
  async createPlatform(id: string, input: CreatePlatformDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let platform = new this.platformModel({
      id: ID.unique(),
      permissions: [
        Permission.Read(Role.Any()),
        Permission.Update(Role.Any()),
        Permission.Delete(Role.Any()),
      ],
      projectInternalId: project._id,
      projectId: project.id,
      name: input.name,
      type: input.type,
      key: input.key,
      store: input.store,
      hostname: input.hostname,
    });
    await platform.save();

    project.platforms.push(platform);
    await project.save();

    return platform;
  }

  /**
   * Get a Platform.
   */
  async getPlatform(id: string, platformId: string) {
    let project = await this.findOne(id, Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let platform = await this.platformModel.findOne({
      projectInternalId: project._id,
      id: platformId,
    });
    if (!platform) throw new Exception(Exception.PLATFORM_NOT_FOUND);
    return platform;
  }

  /**
   * Update a Platform.
   */
  async updatePlatform(
    id: string,
    platformId: string,
    input: UpdatePlatformDto,
  ) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let platform = await this.platformModel.findOne({
      projectInternalId: project._id,
      id: platformId,
    });
    if (!platform) throw new Exception(Exception.PLATFORM_NOT_FOUND);

    platform.name = input.name;
    platform.key = input.key;
    platform.store = input.store;
    platform.hostname = input.hostname;

    await platform.save();
    return platform;
  }

  /**
   * Delete a Platform.
   */
  async deletePlatform(id: string, platformId: string) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let platform = await this.platformModel.findOne({
      projectInternalId: project._id,
      id: platformId,
    });
    if (!platform) throw new Exception(Exception.PLATFORM_NOT_FOUND);

    await platform.deleteOne();

    return {};
  }

  /**
   * Get keys of a project.
   */
  async getKeys(id: string) {
    let project = await this.projectModel
      .findOne({ id: id })
      .select('keys')
      .populate('keys');
    project = new ModelResolver(project).getDocument(Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');
    return {
      total: project?.keys?.length || 0,
      keys: project.keys || [],
    };
  }

  /**
   * Create a key for a project.
   */
  async createKey(id: string, input: CreateKeyDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    let key = new this.keyModel({
      id: ID.unique(),
      permissions: [
        Permission.Read(Role.Any()),
        Permission.Update(Role.Any()),
        Permission.Delete(Role.Any()),
      ],
      projectInternalId: project._id,
      projectId: project.id,
      name: input.name,
      scopes: input.scopes,
      expire: input.expire,
      sdks: [],
      accessedAt: null,
      secret: API_KEY_STANDARD + '_' + randomBytes(128).toString('hex'),
    });
    await key.save();

    project.keys.push(key);
    await project.save();

    return key;
  }

  /**
   * Get a Key.
   */
  async getKey(id: string, keyId: string) {
    let project = await this.findOne(id, Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let key = await this.keyModel.findOne({
      projectInternalId: project._id,
      id: keyId,
    });
    if (!key) throw new Exception(Exception.KEY_NOT_FOUND);
    return key;
  }

  /**
   * Update a Key.
   */
  async updateKey(id: string, keyId: string, input: UpdateKeyDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let key = await this.keyModel.findOne({
      projectInternalId: project._id,
      id: keyId,
    });
    if (!key) throw new Exception(Exception.KEY_NOT_FOUND);

    key.name = input.name;
    key.scopes = input.scopes;
    key.expire = input.expire as any;

    await key.save();
    return key;
  }

  /**
   * Delete a Key.
   */
  async deleteKey(id: string, keyId: string) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let key = await this.keyModel.findOne({
      projectInternalId: project._id,
      id: keyId,
    });
    if (!key) throw new Exception(Exception.KEY_NOT_FOUND);

    await key.deleteOne();

    return {};
  }

  /**
   * Create A JWT token.
   */
  async createJwt(id: string, input: CreateJwtDto) {
    let project = await this.findOne(id, Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let jwt = await this.jwtService.signAsync(
      { projectId: project.id, scopes: input.scopes },
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
    let project = await this.projectModel
      .findOne({ id: id })
      .select('webhooks')
      .populate('webhooks');
    project = new ModelResolver(project).getDocument(Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');
    return {
      total: project?.webhooks?.length || 0,
      webhooks: project.webhooks || [],
    };
  }

  /**
   * Create a webhook for a project.
   */
  async createWebhook(id: string, input: CreateWebhookDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    let webhook = new this.webhookModel({
      id: ID.unique(),
      permissions: [
        Permission.Read(Role.Any()),
        Permission.Update(Role.Any()),
        Permission.Delete(Role.Any()),
      ],
      projectInternalId: project._id,
      projectId: project.id,
      name: input.name,
      events: input.events,
      url: input.url,
      security: input.security,
      httpUser: input.httpUser,
      httpPass: Auth.encrypt(input.httpPass),
      signatureKey: randomBytes(64).toString('hex'),
      enabled: input.enabled,
    });
    await webhook.save();

    project.webhooks.push(webhook);
    await project.save();

    return webhook;
  }

  /**
   * Get a Webhook.
   */
  async getWebhook(id: string, webhookId: string) {
    let project = await this.findOne(id, Database.PERMISSION_READ);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let webhook = await this.webhookModel.findOne({
      projectInternalId: project._id,
      id: webhookId,
    });
    if (!webhook) throw new Exception(Exception.WEBHOOK_NOT_FOUND);
    return webhook;
  }

  /**
   * Update a Webhook.
   */
  async updateWebhook(id: string, webhookId: string, input: UpdateWebhookDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let webhook = await this.webhookModel.findOne({
      projectInternalId: project._id,
      id: webhookId,
    });
    if (!webhook) throw new Exception(Exception.WEBHOOK_NOT_FOUND);

    webhook.name = input.name;
    webhook.events = input.events;
    webhook.url = input.url;
    webhook.httpUser = input.httpUser;
    webhook.httpPass = Auth.encrypt(input.httpPass);
    if (typeof input.security === 'boolean') webhook.security = input.security;
    if (typeof input.enabled === 'boolean') webhook.enabled = input.enabled;
    if (input.enabled) webhook.attempts = 0;

    await webhook.save();
    return webhook;
  }

  /**
   * Update Signature of a Webhook.
   */
  async updateWebhookSignature(id: string, webhookId: string) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let webhook = await this.webhookModel.findOne({
      projectInternalId: project._id,
      id: webhookId,
    });
    if (!webhook) throw new Exception(Exception.WEBHOOK_NOT_FOUND);

    webhook.signatureKey = randomBytes(64).toString('hex');
    await webhook.save();

    return webhook;
  }

  /**
   * Delete a Webhook.
   */
  async deleteWebhook(id: string, webhookId: string) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    let webhook = await this.webhookModel.findOne({
      projectInternalId: project._id,
      id: webhookId,
    });
    if (!webhook) throw new Exception(Exception.WEBHOOK_NOT_FOUND);

    await webhook.deleteOne();

    return {};
  }

  /**
   * Update service status of a project.
   */
  async updateServiceStatus(id: string, input: UpdateProjectServiceDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.services[input.service] = input.status;

    project.markModified('services');
    await project.save();

    return project;
  }

  /**
   * Update all services status of a project.
   */
  async updateAllServiceStatus(id: string, status: boolean) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    Object.values(services).forEach((value) => {
      if (value.optional) {
        project.services[value.key] = status;
      }
    });

    project.markModified('services');
    await project.save();

    return project;
  }

  /**
   * Update Apis status of a project.
   */
  async updateApiStatus(id: string, input: ProjectApiStatusDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths[input.api] = input.status;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update all Apis status of a project.
   */
  async updateAllApiStatus(id: string, status: boolean) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    Object.values(apis).forEach((value) => {
      project.auths[value.key] = status;
    });

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update OAuth2 of a project.
   */
  async updateOAuth2(id: string, input: oAuth2Dto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    if (!oAuthProviders[input.provider]) {
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid OAuth provider.');
    }

    let provider = project.oAuthProviders.find(
      (provider) => provider.key === input.provider,
    );

    if (provider) {
      if (input.appId) provider.appId = input.appId;
      if (input.secret) provider.secret = input.secret;
      if (typeof input.enabled === 'boolean') provider.enabled = input.enabled;
    } else {
      project.oAuthProviders.push({
        key: input.provider,
        name: oAuthProviders[input.provider].name,
        appId: input.appId,
        secret: input.secret,
        enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
      });
    }

    project.markModified('oAuthProviders');
    await project.save();

    return project;
  }

  /**
   * Update session alerts of a project.
   */
  async updateSessionAlerts(id: string, status: boolean = false) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.sessionAlerts = status;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update users limit of a project.
   */
  async updateAuthLimit(id: string, limit: number) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.sessionsLimit = limit;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update session duration of a project.
   */
  async updateSessionDuration(id: string, duration: number) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.duration = duration;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update auth method of a project.
   */
  async updateAuthMethod(id: string, method: string, status: boolean) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    if (!authMethods[method]) {
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid auth method.');
    }

    project.auths[method] = status;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update password history of a project.
   */
  async updatePasswordHistory(id: string, limit: number) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.passwordHistory = limit;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update password dictionary of a project.
   */
  async updatePasswordDictionary(id: string, enabled: boolean) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.passwordDictionary = enabled;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update personal data of a project.
   */
  async updatePersonalData(id: string, enabled: boolean) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.personalDataCheck = enabled;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update max sessions of a project.
   */
  async updateMaxSessions(id: string, limit: number) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    project.auths.sessionsLimit = limit;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update mock numbers of a project.
   */
  async updateMockNumbers(id: string, input: AuthMockNumbersDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.DOCUMENT_NOT_FOUND, 'Project not found.');

    const uniqueNumbers = new Set();
    input.numbers.forEach((number) => {
      if (uniqueNumbers.has(number.phone)) {
        throw new Exception(
          Exception.GENERAL_BAD_REQUEST,
          'Duplicate phone numbers are not allowed.',
        );
      }
      uniqueNumbers.add(number.phone);
    });

    project.auths.mockNumbers = input.numbers as any;

    project.markModified('auths');
    await project.save();

    return project;
  }

  /**
   * Update SMTP of a project.
   */
  async updateSMTP(id: string, input: UpdateSmtpDto) {
    let project = await this.findOne(id, Database.PERMISSION_UPDATE);
    if (!project)
      throw new Exception(Exception.PROJECT_NOT_FOUND, 'Project not found.');

    if (input.enabled) {
      if (!input.senderName)
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Sender name is required when enabling SMTP.',
        );
      if (!input.senderEmail)
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Sender email is required when enabling SMTP.',
        );
      if (!input.host)
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Host is required when enabling SMTP.',
        );
      if (!input.port)
        throw new Exception(
          Exception.GENERAL_ARGUMENT_INVALID,
          'Port is required when enabling SMTP.',
        );

      // Validate SMTP settings
      // const mail = new PHPMailer(true);
      // mail.isSMTP();
      // mail.Username = input.username;
      // mail.Password = input.password;
      // mail.Host = input.host;
      // mail.Port = input.port;
      // mail.SMTPSecure = input.secure;
      // mail.SMTPAutoTLS = false;
      // mail.Timeout = 5;

      // try {
      //   const valid = await mail.SmtpConnect();
      //   if (!valid) throw new Exception(Exception.PROJECT_SMTP_CONFIG_INVALID, 'Connection is not valid.');
      // } catch (error) {
      //   throw new Exception(Exception.PROJECT_SMTP_CONFIG_INVALID, 'Could not connect to SMTP server: ' + error.message);
      // }
    }

    project.smtp = {
      enabled: input.enabled,
      senderName: input.senderName,
      senderEmail: input.senderEmail,
      replyTo: input.replyTo,
      host: input.host,
      port: input.port,
      username: input.username,
      password: input.password,
      secure: input.secure,
    };

    project.markModified('smtp');
    await project.save();

    return project;
  }

  /**
   * @todo :- Impliment the function...
   * Test SMTP
   */
  async testSMTP(id: string, input: SmtpTestsDto) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
    return {};
  }
}

function loadAuthConfig(authMethods: Record<string, AuthMethod>): AuthConfig {
  const authConfig = { ...defaultAuthConfig };

  Object.values(authMethods).forEach((method) => {
    if (method.enabled) {
      authConfig[method.key] = true;
    }
  });

  return authConfig;
}
