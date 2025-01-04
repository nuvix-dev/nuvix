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
import { UserEntity } from 'src/core/entities/user.entity';

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project.name, 'server') private readonly projectModel: Model<Project>,
    @InjectModel(Organization.name, 'server') private readonly orgModel: Model<Organization>,
  ) { }

  private readonly logger = new Logger(ProjectService.name);

  async create(createProjectDto: CreateProjectDto): Promise<ProjectDocument> {
    let projectId = createProjectDto.projectId === 'unique()' ? ID.unique() : ID.auto(createProjectDto.projectId)
    try {
      let org = await this.orgModel.findOne({ id: createProjectDto.teamId })
      if (!org) throw new Exception(Exception.DOCUMENT_NOT_FOUND, "Organization not found.")

      let auths = loadAuthConfig(authMethods);

      const project = await this.projectModel.create({
        id: projectId,
        $permissions: [
          Permission.Read(Role.Team(ID.custom(createProjectDto.teamId))).toString(),
          Permission.Update(Role.Team(ID.custom(createProjectDto.teamId), 'owner')).toString(),
          Permission.Update(Role.Team(ID.custom(createProjectDto.teamId), 'developer')).toString(),
          Permission.Delete(Role.Team(ID.custom(createProjectDto.teamId), 'owner')).toString(),
          Permission.Delete(Role.Team(ID.custom(createProjectDto.teamId), 'developer')).toString(),
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
        platforms: null,
        oAuthProviders: [],
        webhooks: null,
        keys: null,
        auths: auths,
        accessedAt: new Date(),
        version: APP_VERSION_STABLE,
        database: 'undefiend', // Will be updated after database creation
      })

      await project.save();

      const runner = (await new DbService().getConnection()).createQueryRunner("master");
      await runner.createDatabase('project_' + project.id, true);
      await runner.release();

      project.database = 'project_' + project.id;

      await project.save();
      const db = await new DbService().getTenantConnection(project.database);
      this.logger.log('Running migrations for project ' + project.id);
      const migrations = await db.runMigrations();
      this.logger.log('Migrations run for project ' + project.id + ': ' + migrations);

      const userRepo = db.getRepository(UserEntity);
      // Create the owner user
      return project;
    } catch (error) {
      try {
        await this.projectModel.deleteOne({ id: projectId });
      } catch (deleteError) {
        console.error('Error deleting project after failure:', deleteError);
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

  async findAll() {
    return {
      total: await this.projectModel.countDocuments(),
      projects: await this.projectModel.find()
    }
  }

  findOne(id: number) {
    return this.projectModel.findOne({ id: id })
  }

  update(id: number, updateProjectDto: UpdateProjectDto) {
    return `This action updates a #${id} project`;
  }

  remove(id: number) {
    return `This action removes a #${id} project`;
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