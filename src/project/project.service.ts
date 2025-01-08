import { Injectable, Logger } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { AuthConfig, Project, ProjectDocument } from './schemas/project.schema';
import { Model } from 'mongoose';
import { Exception } from 'src/core/extend/exception';
import { Organization } from 'src/console-user/schemas/organization.schema';
import { ID } from 'src/core/helper/ID.helper';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { APP_VERSION_STABLE } from 'src/Utils/constants';
import authMethods, { AuthMethod, defaultAuthConfig } from 'src/core/config/auth';
import { DbService } from 'src/core/db.service';
import { QueryBuilder } from 'src/Utils/mongo.filter';
import { oAuthProviders } from 'src/core/config/authProviders';
import { defaultSmtpConfig } from 'src/core/config/smtp';
import { services } from 'src/core/config/services';

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project.name, 'server') private readonly projectModel: Model<Project>,
    @InjectModel(Organization.name, 'server') private readonly orgModel: Model<Organization>,
  ) { }

  private readonly logger = new Logger(ProjectService.name);

  /**
   * Create a new project.
   */
  async create(createProjectDto: CreateProjectDto): Promise<ProjectDocument> {
    let projectId = createProjectDto.projectId === 'unique()' ? ID.unique() : ID.auto(createProjectDto.projectId)
    try {
      let org = await this.orgModel.findOne({ id: createProjectDto.teamId })
      if (!org) throw new Exception(Exception.TEAM_NOT_FOUND, "Organization not found.")

      let auths = loadAuthConfig(authMethods);

      let defaultoAuthProviders = []
      let defaultServices = {}

      Object.entries(oAuthProviders).forEach(([key, value]) => {
        if (value.enabled) {
          defaultoAuthProviders.push({
            key: key,
            name: value.name,
            appId: '',
            secret: '',
            enabled: false,
          })
        }
      })

      Object.values(services).forEach((value) => {
        if (value.optional) {
          defaultServices[value.key] = true;
        }
      })

      const project = await this.projectModel.create({
        id: projectId,
        $permissions: [
          Permission.Read(Role.Team(ID.custom(createProjectDto.teamId))),
          Permission.Update(Role.Team(ID.custom(createProjectDto.teamId), 'owner')),
          Permission.Update(Role.Team(ID.custom(createProjectDto.teamId), 'developer')),
          Permission.Delete(Role.Team(ID.custom(createProjectDto.teamId), 'owner')),
          Permission.Delete(Role.Team(ID.custom(createProjectDto.teamId), 'developer')),
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
      })

      await project.save();

      const runner = (await new DbService().getConnection()).createQueryRunner("master");
      await runner.createDatabase('project_' + project.id);
      await runner.release();

      project.database = 'project_' + project.id;

      await project.save();
      const db = await new DbService().getTenantConnection(project.database);
      this.logger.log('Running migrations for project ' + project.id);
      const migrations = await db.runMigrations();
      this.logger.log('Migrations run for project ' + project.id + ': ' + migrations);

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
      } else if (error.code === 11000) { // Handle duplicate key errors
        // Check which field caused the duplicate key error. Adapt to your needs.
        if (error.keyPattern && error.keyPattern.name === 1) {
          throw new Exception(null, 'Project with this name already exists.');
        } else {
          console.error("Duplicate key error details:", error);
          throw new Exception(null, 'Duplicate key error occurred.');
        }
      } else {
        console.error('Error creating project:', error); // Log the error for debugging
        throw new Exception(null, 'Failed to create project.');
      }
    }
  }

  async findAll(queries: string[]) {
    const baseQuery = this.projectModel.find().populate(['platforms', 'keys', 'webhooks']);
    const queryBuilder = new QueryBuilder(baseQuery, ['name', 'teamId']);

    queryBuilder.parseQueryStrings(queries);

    let { results, totalCount } = await queryBuilder.execute();

    return {
      total: totalCount,
      projects: results
    }
  }

  findOne(id: string) {
    return this.projectModel.findOne({ id: id });
  }

  update(id: number, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }

  /**
   * Remove a project.
   */
  async remove(id: string) {
    let project = await this.projectModel.findOne({ id: id });
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");
    const runner = (await new DbService().getConnection()).createQueryRunner("master");
    await runner.dropDatabase('project_' + project.id, true);
    await runner.release();
    await project.deleteOne();
    return project;
  }

  /**
   * Get platforms of a project.
   */
  async getPlatforms(id: string) {
    let project = await this.projectModel.findOne({ id: id }).select('platforms').populate('platforms');
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");
    return {
      total: project?.platforms?.length || 0,
      platforms: project.platforms || []
    }
  }

  /**
   * Get keys of a project.
   */
  async getKeys(id: string) {
    let project = await this.projectModel.findOne({ id: id }).select('keys').populate('keys');
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");
    return {
      total: project?.keys?.length || 0,
      keys: project.keys || []
    }
  }

  /**
   * Get webhooks of a project.
   */
  async getWebhooks(id: string) {
    let project = await this.projectModel.findOne({ id: id }).select('webhooks').populate('webhooks');
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");
    return {
      total: project?.webhooks?.length || 0,
      webhooks: project.webhooks || []
    }
  }

  /**
   * Update service status of a project.
   */
  async updateServiceStatus(id: string, service: string, status: boolean) {
    let project = await this.projectModel.findOne({ id: id });
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");

    project.services[service] = status;
    await project.save();

    return project;
  }

  /**
   * Update all services status of a project.
   */
  async updateAllServiceStatus(id: string, status: boolean) {
    let project = await this.projectModel.findOne({ id: id });
    if (!project) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Project not found.");

    Object.values(services).forEach((value) => {
      if (value.optional) {
        project.services[value.key] = status;
      }
    })
    await project.save();

    return project;
  }
}


function loadAuthConfig(authMethods: Record<string, AuthMethod>): AuthConfig {
  const authConfig = { ...defaultAuthConfig };

  Object.values(authMethods).forEach(method => {
    if (method.enabled) {
      authConfig[method.key] = true;
    }
  });

  return authConfig;
}