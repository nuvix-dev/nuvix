import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards, UseInterceptors, ClassSerializerInterceptor, Query } from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/console-account/jwt-auth.guard';
import { ProjectListModel, ProjectModel } from './models/project.model';
import { PlatformListModel } from './models/platform.model';
import { KeyListModel } from './models/key.model';
import { WebhookListModel } from './models/webhook.model';
import { User } from 'src/console-user/decorators';
import { UserDocument } from 'src/console-user/schemas/user.schema';
import { Auth } from 'src/console-account/auth';
import { ClsService } from 'nestjs-cls';
import { Authorization } from 'src/core/validators/authorization.validator';
import { Input } from 'src/core/validators/authorization-input.validator';
import { Database } from 'src/core/config/database';

@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly clsService: ClsService
  ) { }

  @Post()
  async create(@Body() createProjectDto: CreateProjectDto, @Req() req: Request): Promise<ProjectModel> {
    const project = await this.projectService.create(createProjectDto)
    return new ProjectModel(project);
  }

  @Get()
  async findAll(@User() user: UserDocument, @Query('queries') queries?: string[], @Query('search') search?: string): Promise<ProjectListModel> {
    let data = await this.projectService.findAll(user, queries, search);
    return new ProjectListModel(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @User() user: UserDocument): Promise<ProjectModel> {
    let project = await this.projectService.findOne(id)
    let roles = Auth.getRoles(user)
    console.log(roles, user)
    let authorization = this.clsService.get('authorization') as Authorization;
    let skipAuth = authorization.isValid(new Input(Database.PERMISSION_CREATE, project.$permissions))
    console.log(skipAuth)
    return new ProjectModel(project);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(+id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }

  @Get(':id/platforms')
  async getPlatforms(@Param('id') id: string): Promise<PlatformListModel> {
    let data = await this.projectService.getPlatforms(id);
    return new PlatformListModel(data);
  }

  @Get(':id/keys')
  async getKeys(@Param('id') id: string): Promise<KeyListModel> {
    let data = await this.projectService.getKeys(id);
    return new KeyListModel(data);
  }

  @Get(':id/webhooks')
  async getWebhooks(@Param('id') id: string): Promise<WebhookListModel> {
    let data = await this.projectService.getWebhooks(id);
    return new WebhookListModel(data);
  }
}
