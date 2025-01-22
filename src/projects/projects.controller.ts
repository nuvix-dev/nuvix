import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseInterceptors,
  ClassSerializerInterceptor,
  Query,
  Put,
} from '@nestjs/common';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import authMethods from 'src/core/config/auth';
import { Exception } from 'src/core/extend/exception';
import { ProjectService } from './projects.service';

// Models
import { ProjectListModel, ProjectModel } from './models/project.model';
import { PlatformListModel, PlatformModel } from './models/platform.model';
import { KeyListModel, KeyModel } from './models/key.model';
import { WebhookListModel, WebhookModel } from './models/webhook.model';

// DTO
import { oAuth2Dto } from './dto/oauth2.dto';
import { CreateJwtDto } from './dto/create-jwt.dto';
import { CreateKeyDto, UpdateKeyDto } from './dto/keys.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import {
  UpdateProjectDto,
  UpdateProjectTeamDto,
} from './dto/update-project.dto';
import {
  ProjectApiStatusAllDto,
  ProjectApiStatusDto,
} from './dto/project-api.dto';
import {
  UpdateProjectAllServiceDto,
  UpdateProjectServiceDto,
} from './dto/project-service.dto';
import {
  AuthSessionAlertsDto,
  AuthLimitDto,
  AuthDurationDto,
  AuthMethodStatusDto,
  AuthPasswordHistoryDto,
  AuthPasswordDictionaryDto,
  AuthPersonalDataDto,
  AuthMaxSessionsDto,
  AuthMockNumbersDto,
} from './dto/project-auth.dto';
import { CreatePlatformDto, UpdatePlatformDto } from './dto/platform.dto';
import { SmtpTestsDto, UpdateSmtpDto } from './dto/smtp.dto';

@Controller({ version: ['1'], path: 'projects' })
@UseInterceptors(ClassSerializerInterceptor)
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly clsService: ClsService,
  ) {}

  @Post()
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: Request,
  ): Promise<ProjectModel> {
    const project = await this.projectService.create(createProjectDto);
    return new ProjectModel(project);
  }

  @Get()
  async findAll(
    @Query('queries') queries?: string[],
    @Query('search') search?: string,
  ): Promise<ProjectListModel> {
    let data = await this.projectService.findAll(queries, search);
    return new ProjectListModel(data);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ProjectModel> {
    let project = await this.projectService.findOne(id);
    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND);
    return new ProjectModel(project);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.update(id, updateProjectDto),
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }

  @Post(':id/jwts')
  createJwt(@Param('id') id: string, @Body() input: CreateJwtDto) {
    return this.projectService.createJwt(id, input);
  }

  @Get(':id/platforms')
  async getPlatforms(@Param('id') id: string): Promise<PlatformListModel> {
    let data = await this.projectService.getPlatforms(id);
    return new PlatformListModel(data);
  }

  @Post(':id/platforms')
  async createPlatform(
    @Param('id') id: string,
    @Body() input: CreatePlatformDto,
  ): Promise<PlatformModel> {
    return new PlatformModel(
      await this.projectService.createPlatform(id, input),
    );
  }

  @Get(':id/platforms/:platformId')
  async getPlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ): Promise<PlatformModel> {
    return new PlatformModel(
      await this.projectService.getPlatform(id, platformId),
    );
  }

  @Put(':id/platforms/:platformId')
  async updatePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
    @Body() input: UpdatePlatformDto,
  ): Promise<PlatformModel> {
    return new PlatformModel(
      await this.projectService.updatePlatform(id, platformId, input),
    );
  }

  @Delete(':id/platforms/:platformId')
  async deletePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ): Promise<{}> {
    return await this.projectService.deletePlatform(id, platformId);
  }

  @Get(':id/keys')
  async getKeys(@Param('id') id: string): Promise<KeyListModel> {
    let data = await this.projectService.getKeys(id);
    return new KeyListModel(data);
  }

  @Post(':id/keys')
  async createKey(
    @Param('id') id: string,
    @Body() input: CreateKeyDto,
  ): Promise<KeyModel> {
    let data = await this.projectService.createKey(id, input);
    return new KeyModel(data);
  }

  @Get(':id/keys/:keyId')
  async getKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ): Promise<KeyModel> {
    return new KeyModel(await this.projectService.getKey(id, keyId));
  }

  @Put(':id/keys/:keyId')
  async updateKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Body() input: UpdateKeyDto,
  ): Promise<KeyModel> {
    return new KeyModel(await this.projectService.updateKey(id, keyId, input));
  }

  @Delete(':id/keys/:keyId')
  async deleteKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ): Promise<{}> {
    return await this.projectService.deleteKey(id, keyId);
  }

  @Get(':id/webhooks')
  async getWebhooks(@Param('id') id: string): Promise<WebhookListModel> {
    let data = await this.projectService.getWebhooks(id);
    return new WebhookListModel(data);
  }

  @Post(':id/webhooks')
  async createWebhook(
    @Param('id') id: string,
    @Body() input: CreateWebhookDto,
  ): Promise<WebhookModel> {
    let data = await this.projectService.createWebhook(id, input);
    return new WebhookModel(data);
  }

  @Get(':id/webhooks/:webhookId')
  async getWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<WebhookModel> {
    return new WebhookModel(
      await this.projectService.getWebhook(id, webhookId),
    );
  }

  @Put(':id/webhooks/:webhookId')
  async updateWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
    @Body() input: UpdateWebhookDto,
  ): Promise<WebhookModel> {
    return new WebhookModel(
      await this.projectService.updateWebhook(id, webhookId, input),
    );
  }

  @Patch(':id/webhooks/:webhookId/signature')
  async updateWebhookSignature(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<WebhookModel> {
    return new WebhookModel(
      await this.projectService.updateWebhookSignature(id, webhookId),
    );
  }

  @Delete(':id/webhooks/:webhookId')
  async deleteWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<{}> {
    return await this.projectService.deleteWebhook(id, webhookId);
  }

  @Patch([':id/organization', ':id/team'])
  async updateTeam(
    @Param('id') id: string,
    @Body() updateProjectTeamDto: UpdateProjectTeamDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateProjectOrganization(
        id,
        updateProjectTeamDto,
      ),
    );
  }

  @Patch(':id/service')
  async updateService(
    @Param('id') id: string,
    @Body() input: UpdateProjectServiceDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateServiceStatus(id, input),
    );
  }

  @Patch(':id/api')
  async updateApi(
    @Param('id') id: string,
    @Body() input: ProjectApiStatusDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateApiStatus(id, input),
    );
  }

  @Patch(':id/oauth2')
  async updateOAuth2(
    @Param('id') id: string,
    @Body() input: oAuth2Dto,
  ): Promise<ProjectModel> {
    return new ProjectModel(await this.projectService.updateOAuth2(id, input));
  }

  @Patch(':id/service/all')
  async updateServiceAll(
    @Param('id') id: string,
    @Body() input: UpdateProjectAllServiceDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateAllServiceStatus(id, input.status),
    );
  }

  @Patch(':id/api/all')
  async updateApiAll(
    @Param('id') id: string,
    @Body() input: ProjectApiStatusAllDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateAllApiStatus(id, input.status),
    );
  }

  @Patch(':id/auth/session-alerts')
  async updateSessionAlerts(
    @Param('id') id: string,
    @Body() input: AuthSessionAlertsDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateSessionAlerts(id, input.alerts),
    );
  }

  @Patch(':id/auth/limit')
  async updateAuthLimit(
    @Param('id') id: string,
    @Body() input: AuthLimitDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateAuthLimit(id, input.limit),
    );
  }

  @Patch(':id/auth/duration')
  async updateAuthDuration(
    @Param('id') id: string,
    @Body() input: AuthDurationDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateSessionDuration(id, input.duration),
    );
  }

  @Patch(':id/auth/password-history')
  async updatePasswordHistory(
    @Param('id') id: string,
    @Body() input: AuthPasswordHistoryDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updatePasswordHistory(id, input.limit),
    );
  }

  @Patch(':id/auth/password-dictionary')
  async updatePasswordDictionary(
    @Param('id') id: string,
    @Body() input: AuthPasswordDictionaryDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updatePasswordDictionary(id, input.enabled),
    );
  }

  @Patch(':id/auth/personal-data')
  async updatePersonalData(
    @Param('id') id: string,
    @Body() input: AuthPersonalDataDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updatePersonalData(id, input.enabled),
    );
  }

  @Patch(':id/auth/max-sessions')
  async updateMaxSessions(
    @Param('id') id: string,
    @Body() input: AuthMaxSessionsDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateMaxSessions(id, input.limit),
    );
  }

  @Patch(':id/auth/mock-numbers')
  async updateMockNumbers(
    @Param('id') id: string,
    @Body() input: AuthMockNumbersDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(
      await this.projectService.updateMockNumbers(id, input),
    );
  }

  @Patch(':id/auth/:method')
  async updateAuthMethod(
    @Param('id') id: string,
    @Param('method') method: string,
    @Body() input: AuthMethodStatusDto,
  ): Promise<ProjectModel> {
    if (
      Object.keys(authMethods)
        .map((m) => m)
        .indexOf(method) === -1
    )
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid auth method');
    return new ProjectModel(
      await this.projectService.updateAuthMethod(id, method, input.status),
    );
  }

  @Patch(':id/smtp')
  async updateSMTP(
    @Param('id') id: string,
    @Body() input: UpdateSmtpDto,
  ): Promise<ProjectModel> {
    return new ProjectModel(await this.projectService.updateSMTP(id, input));
  }

  @Post(':id/smtp/tests')
  async testSMTP(
    @Param('id') id: string,
    @Body() input: SmtpTestsDto,
  ): Promise<{}> {
    return await this.projectService.testSMTP(id, input);
  }

  @Get(':id/templates/sms/:type/:locale')
  async getSMSTemplate(
    @Param('id') id: string,
    @Param('type') type: string,
    @Param('locale') locale: string,
  ) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Patch(':id/templates/sms/:type/:locale')
  async updateSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Delete(':id/templates/sms/:type/:locale')
  async deleteSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Get(':id/templates/email/:type/:locale')
  async getEmailTemplate(
    @Param('id') id: string,
    @Param('type') type: string,
    @Param('locale') locale: string,
  ) {
    return {
      message: '$message',
      subject: "$localeObj -> getText('emails.'.$type. '.subject')",
      senderEmail: '',
      senderName: '',
      locale,
      type,
    };
  }

  @Patch(':id/templates/email/:type/:locale')
  async updateEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Delete(':id/templates/email/:type/:locale')
  async deleteEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }
}
