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
  Query,
  Put,
  UseGuards,
} from '@nestjs/common';

import authMethods from '@nuvix/core/config/auth';
import { Exception } from '@nuvix/core/extend/exception';
import { ProjectService } from './projects.service';

// DTO
import { oAuth2DTO } from './DTO/oauth2.dto';
import { CreateJwtDTO } from './DTO/create-jwt.dto';
import { CreateKeyDTO, UpdateKeyDTO } from './DTO/keys.dto';
import { CreateProjectDTO } from './DTO/create-project.dto';
import { CreateWebhookDTO, UpdateWebhookDTO } from './DTO/webhook.dto';
import {
  UpdateProjectDTO,
  UpdateProjectTeamDTO,
} from './DTO/update-project.dto';
import {
  ProjectApiStatusAllDTO,
  ProjectApiStatusDTO,
} from './DTO/project-api.dto';
import {
  UpdateProjectAllServiceDTO,
  UpdateProjectServiceDTO,
} from './DTO/project-service.dto';
import {
  AuthSessionAlertsDTO,
  AuthLimitDTO,
  AuthDurationDTO,
  AuthMethodStatusDTO,
  AuthPasswordHistoryDTO,
  AuthPasswordDictionaryDTO,
  AuthPersonalDataDTO,
  AuthMaxSessionsDTO,
  AuthMockNumbersDTO,
} from './DTO/project-auth.dto';
import { CreatePlatformDTO, UpdatePlatformDTO } from './DTO/platform.dto';
import { SmtpTestsDTO, UpdateSmtpDTO } from './DTO/smtp.dto';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Models } from '@nuvix/core/helper/response.helper';
import type { Query as Queries } from '@nuvix-tech/db';
import { AuthGuard } from '@nuvix/core/resolvers/guards/auth.guard';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';
import { ResModel, Scope } from '@nuvix/core/decorators';
import { ProjectsQueryPipe } from '@nuvix/core/pipes/queries';
import { CreateEnvTokenDTO } from './DTO/env-token.dto';

@Controller({ version: ['1'], path: 'projects' })
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class ProjectsController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Scope('projects.create')
  @ResModel(Models.PROJECT)
  async create(@Body() createProjectDTO: CreateProjectDTO) {
    const project = await this.projectService.create(createProjectDTO);
    return project;
  }

  @Get()
  @Scope('projects.read')
  @ResModel(Models.PROJECT, { list: true })
  async findAll(
    @Query('queries', ProjectsQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    const data = await this.projectService.findAll(queries, search);
    return data;
  }

  @Get('env_tokens')
  @Scope('projects.read')
  @ResModel(Models.ENV_TOKEN, { list: true })
  async listEnvTokens() {
    return this.projectService.listEnvTokens();
  }

  @Post('env_tokens')
  @Scope('projects.read')
  @ResModel(Models.ENV_TOKEN)
  async createEnvToken(
    @Body() body: CreateEnvTokenDTO,
    @Req() req: NuvixRequest,
  ) {
    return this.projectService.createEnvToken(body, req);
  }

  @Put('env_tokens/:tokenId')
  @Scope('projects.read')
  @ResModel(Models.ENV_TOKEN)
  async updateEnvToken(
    @Param('tokenId') tokenId: string,
    @Body('url') url: string,
    @Body('projectId') projectId: string,
  ) {
    return this.projectService.updateEnvToken(projectId, tokenId, url);
  }

  @Get(':projectId')
  @Scope('project.read')
  @ResModel(Models.PROJECT)
  async findOne(@Param('projectId') id: string) {
    const project = await this.projectService.findOne(id);
    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND);
    return project;
  }

  @Patch(':projectId')
  @Scope('project.update')
  @ResModel(Models.PROJECT)
  async update(
    @Param('projectId') id: string,
    @Body() updateProjectDTO: UpdateProjectDTO,
  ) {
    return this.projectService.update(id, updateProjectDTO);
  }

  @Delete(':projectId')
  @Scope('project.delete')
  @ResModel(Models.NONE)
  remove(@Param('projectId') id: string) {
    return this.projectService.remove(id);
  }

  @Post(':projectId/jwts')
  @ResModel(Models.JWT)
  createJwt(@Param('projectId') id: string, @Body() input: CreateJwtDTO) {
    return this.projectService.createJwt(id, input);
  }

  @Get(':projectId/platforms')
  @ResModel({ type: Models.PLATFORM, list: true })
  async getPlatforms(@Param('projectId') id: string) {
    const data = await this.projectService.getPlatforms(id);
    return data;
  }

  @Post(':projectId/platforms')
  @ResModel(Models.PLATFORM)
  async createPlatform(
    @Param('projectId') id: string,
    @Body() input: CreatePlatformDTO,
  ) {
    return this.projectService.createPlatform(id, input);
  }

  @Get(':projectId/platforms/:platformId')
  @ResModel(Models.PLATFORM)
  async getPlatform(
    @Param('projectId') id: string,
    @Param('platformId') platformId: string,
  ) {
    return this.projectService.getPlatform(id, platformId);
  }

  @Put(':projectId/platforms/:platformId')
  @ResModel(Models.PLATFORM)
  async updatePlatform(
    @Param('projectId') id: string,
    @Param('platformId') platformId: string,
    @Body() input: UpdatePlatformDTO,
  ) {
    return this.projectService.updatePlatform(id, platformId, input);
  }

  @Delete(':projectId/platforms/:platformId')
  @ResModel(Models.NONE)
  async deletePlatform(
    @Param('projectId') id: string,
    @Param('platformId') platformId: string,
  ): Promise<{}> {
    return this.projectService.deletePlatform(id, platformId);
  }

  @Get(':projectId/keys')
  @ResModel({ type: Models.KEY, list: true })
  async getKeys(@Param('projectId') id: string) {
    const data = await this.projectService.getKeys(id);
    return data;
  }

  @Post(':projectId/keys')
  @ResModel(Models.KEY)
  async createKey(@Param('projectId') id: string, @Body() input: CreateKeyDTO) {
    const data = await this.projectService.createKey(id, input);
    return data;
  }

  @Get(':projectId/keys/:keyId')
  @ResModel(Models.KEY)
  async getKey(@Param('projectId') id: string, @Param('keyId') keyId: string) {
    return this.projectService.getKey(id, keyId);
  }

  @Put(':projectId/keys/:keyId')
  @ResModel(Models.KEY)
  async updateKey(
    @Param('projectId') id: string,
    @Param('keyId') keyId: string,
    @Body() input: UpdateKeyDTO,
  ) {
    return this.projectService.updateKey(id, keyId, input);
  }

  @Delete(':projectId/keys/:keyId')
  @ResModel(Models.NONE)
  async deleteKey(
    @Param('projectId') id: string,
    @Param('keyId') keyId: string,
  ): Promise<{}> {
    return this.projectService.deleteKey(id, keyId);
  }

  @Get(':projectId/webhooks')
  @ResModel({ type: Models.WEBHOOK, list: true })
  async getWebhooks(@Param('projectId') id: string) {
    const data = await this.projectService.getWebhooks(id);
    return data;
  }

  @Post(':projectId/webhooks')
  @ResModel(Models.WEBHOOK)
  async createWebhook(
    @Param('projectId') id: string,
    @Body() input: CreateWebhookDTO,
  ) {
    const data = await this.projectService.createWebhook(id, input);
    return data;
  }

  @Get(':projectId/webhooks/:webhookId')
  @ResModel(Models.WEBHOOK)
  async getWebhook(
    @Param('projectId') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.projectService.getWebhook(id, webhookId);
  }

  @Put(':projectId/webhooks/:webhookId')
  @ResModel(Models.WEBHOOK)
  async updateWebhook(
    @Param('projectId') id: string,
    @Param('webhookId') webhookId: string,
    @Body() input: UpdateWebhookDTO,
  ) {
    return this.projectService.updateWebhook(id, webhookId, input);
  }

  @Patch(':projectId/webhooks/:webhookId/signature')
  @ResModel(Models.WEBHOOK)
  async updateWebhookSignature(
    @Param('projectId') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.projectService.updateWebhookSignature(id, webhookId);
  }

  @Delete(':projectId/webhooks/:webhookId')
  async deleteWebhook(
    @Param('projectId') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<{}> {
    return this.projectService.deleteWebhook(id, webhookId);
  }

  @Patch([':projectId/organization', ':projectId/team'])
  @ResModel(Models.PROJECT)
  async updateTeam(
    @Param('projectId') id: string,
    @Body() updateProjectTeamDTO: UpdateProjectTeamDTO,
  ) {
    return this.projectService.updateProjectOrganization(
      id,
      updateProjectTeamDTO,
    );
  }

  @Patch(':projectId/service')
  @ResModel(Models.PROJECT)
  async updateService(
    @Param('projectId') id: string,
    @Body() input: UpdateProjectServiceDTO,
  ) {
    return this.projectService.updateServiceStatus(id, input);
  }

  @Patch(':projectId/api')
  @ResModel(Models.PROJECT)
  async updateApi(
    @Param('projectId') id: string,
    @Body() input: ProjectApiStatusDTO,
  ) {
    return this.projectService.updateApiStatus(id, input);
  }

  @Patch(':projectId/oauth2')
  @ResModel(Models.PROJECT)
  async updateOAuth2(@Param('projectId') id: string, @Body() input: oAuth2DTO) {
    return this.projectService.updateOAuth2(id, input);
  }

  @Patch(':projectId/service/all')
  @ResModel(Models.PROJECT)
  async updateServiceAll(
    @Param('projectId') id: string,
    @Body() input: UpdateProjectAllServiceDTO,
  ) {
    return this.projectService.updateAllServiceStatus(id, input.status);
  }

  @Patch(':projectId/api/all')
  @ResModel(Models.PROJECT)
  async updateApiAll(
    @Param('projectId') id: string,
    @Body() input: ProjectApiStatusAllDTO,
  ) {
    return this.projectService.updateAllApiStatus(id, input.status);
  }

  @Patch(':projectId/auth/session-alerts')
  @ResModel(Models.PROJECT)
  async updateSessionAlerts(
    @Param('projectId') id: string,
    @Body() input: AuthSessionAlertsDTO,
  ) {
    return this.projectService.updateSessionAlerts(id, input.alerts);
  }

  @Patch(':projectId/auth/limit')
  @ResModel(Models.PROJECT)
  async updateAuthLimit(
    @Param('projectId') id: string,
    @Body() input: AuthLimitDTO,
  ) {
    return this.projectService.updateAuthLimit(id, input.limit);
  }

  @Patch(':projectId/auth/duration')
  @ResModel(Models.PROJECT)
  async updateAuthDuration(
    @Param('projectId') id: string,
    @Body() input: AuthDurationDTO,
  ) {
    return this.projectService.updateSessionDuration(id, input.duration);
  }

  @Patch(':projectId/auth/password-history')
  @ResModel(Models.PROJECT)
  async updatePasswordHistory(
    @Param('projectId') id: string,
    @Body() input: AuthPasswordHistoryDTO,
  ) {
    return this.projectService.updatePasswordHistory(id, input.limit);
  }

  @Patch(':projectId/auth/password-dictionary')
  @ResModel(Models.PROJECT)
  async updatePasswordDictionary(
    @Param('projectId') id: string,
    @Body() input: AuthPasswordDictionaryDTO,
  ) {
    return this.projectService.updatePasswordDictionary(id, input.enabled);
  }

  @Patch(':projectId/auth/personal-data')
  @ResModel(Models.PROJECT)
  async updatePersonalData(
    @Param('projectId') id: string,
    @Body() input: AuthPersonalDataDTO,
  ) {
    return this.projectService.updatePersonalData(id, input.enabled);
  }

  @Patch(':projectId/auth/max-sessions')
  @ResModel(Models.PROJECT)
  async updateMaxSessions(
    @Param('projectId') id: string,
    @Body() input: AuthMaxSessionsDTO,
  ) {
    return this.projectService.updateMaxSessions(id, input.limit);
  }

  @Patch(':projectId/auth/mock-numbers')
  @ResModel(Models.PROJECT)
  async updateMockNumbers(
    @Param('projectId') id: string,
    @Body() input: AuthMockNumbersDTO,
  ) {
    return this.projectService.updateMockNumbers(id, input);
  }

  @Patch(':projectId/auth/:method')
  @ResModel(Models.PROJECT)
  async updateAuthMethod(
    @Param('projectId') id: string,
    @Param('method') method: string,
    @Body() input: AuthMethodStatusDTO,
  ) {
    if (
      !Object.keys(authMethods).concat('memberships-privacy').includes(method)
    )
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid auth method');
    return this.projectService.updateAuthMethod(id, method, input.status);
  }

  @Patch(':projectId/smtp')
  @ResModel(Models.PROJECT)
  async updateSMTP(
    @Param('projectId') id: string,
    @Body() input: UpdateSmtpDTO,
  ) {
    return this.projectService.updateSMTP(id, input);
  }

  @Post(':projectId/smtp/tests')
  async testSMTP(
    @Param('projectId') id: string,
    @Body() input: SmtpTestsDTO,
  ): Promise<void> {
    return this.projectService.testSMTP(id, input);
  }

  @Get(':projectId/templates/sms/:type/:locale')
  async getSMSTemplate(
    @Param('projectId') id: string,
    @Param('type') type: string,
    @Param('locale') locale: string,
  ) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Patch(':projectId/templates/sms/:type/:locale')
  async updateSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Delete(':projectId/templates/sms/:type/:locale')
  async deleteSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Get(':projectId/templates/email/:type/:locale')
  async getEmailTemplate(
    @Param('projectId') id: string,
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

  @Patch(':projectId/templates/email/:type/:locale')
  async updateEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }

  @Delete(':projectId/templates/email/:type/:locale')
  async deleteEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED);
  }
}
