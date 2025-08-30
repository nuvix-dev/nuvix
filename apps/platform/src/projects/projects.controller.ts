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
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import type { Query as Queries } from '@nuvix-tech/db';
import { AuthGuard } from '@nuvix/core/resolvers/guards/auth.guard';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';
import { ResModel, Scope } from '@nuvix/core/decorators';
import { ProjectsQueryPipe } from '@nuvix/core/pipes/queries';

@Controller({ version: ['1'], path: 'projects' })
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class ProjectsController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Scope('project.create')
  @ResModel(Models.PROJECT)
  async create(@Body() createProjectDTO: CreateProjectDTO) {
    const project = await this.projectService.create(createProjectDTO);
    return project;
  }

  @Get()
  @Scope('project.read')
  @ResModel(Models.PROJECT, { list: true })
  async findAll(
    @Query('queries', ProjectsQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    const data = await this.projectService.findAll(queries, search);
    return data;
  }

  @Get(':id')
  @Scope('project.read')
  @ResModel(Models.PROJECT)
  async findOne(@Param('id') id: string) {
    const project = await this.projectService.findOne(id);
    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND);
    return project;
  }

  @Patch(':id')
  @Scope('project.update')
  @ResModel(Models.PROJECT)
  async update(
    @Param('id') id: string,
    @Body() updateProjectDTO: UpdateProjectDTO,
  ) {
    return this.projectService.update(id, updateProjectDTO);
  }

  @Delete(':id')
  @Scope('project.delete')
  @ResModel(Models.NONE)
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }

  @Post(':id/jwts')
  @ResModel(Models.JWT)
  createJwt(@Param('id') id: string, @Body() input: CreateJwtDTO) {
    return this.projectService.createJwt(id, input);
  }

  @Get(':id/platforms')
  @ResModel({ type: Models.PLATFORM, list: true })
  async getPlatforms(@Param('id') id: string) {
    const data = await this.projectService.getPlatforms(id);
    return data;
  }

  @Post(':id/platforms')
  @ResModel(Models.PLATFORM)
  async createPlatform(
    @Param('id') id: string,
    @Body() input: CreatePlatformDTO,
  ) {
    return this.projectService.createPlatform(id, input);
  }

  @Get(':id/platforms/:platformId')
  @ResModel(Models.PLATFORM)
  async getPlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ) {
    return this.projectService.getPlatform(id, platformId);
  }

  @Put(':id/platforms/:platformId')
  @ResModel(Models.PLATFORM)
  async updatePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
    @Body() input: UpdatePlatformDTO,
  ) {
    return this.projectService.updatePlatform(id, platformId, input);
  }

  @Delete(':id/platforms/:platformId')
  @ResModel(Models.NONE)
  async deletePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ): Promise<{}> {
    return this.projectService.deletePlatform(id, platformId);
  }

  @Get(':id/keys')
  @ResModel({ type: Models.KEY, list: true })
  async getKeys(@Param('id') id: string) {
    const data = await this.projectService.getKeys(id);
    return data;
  }

  @Post(':id/keys')
  @ResModel(Models.KEY)
  async createKey(@Param('id') id: string, @Body() input: CreateKeyDTO) {
    const data = await this.projectService.createKey(id, input);
    return data;
  }

  @Get(':id/keys/:keyId')
  @ResModel(Models.KEY)
  async getKey(@Param('id') id: string, @Param('keyId') keyId: string) {
    return this.projectService.getKey(id, keyId);
  }

  @Put(':id/keys/:keyId')
  @ResModel(Models.KEY)
  async updateKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Body() input: UpdateKeyDTO,
  ) {
    return this.projectService.updateKey(id, keyId, input);
  }

  @Delete(':id/keys/:keyId')
  @ResModel(Models.NONE)
  async deleteKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ): Promise<{}> {
    return this.projectService.deleteKey(id, keyId);
  }

  @Get(':id/webhooks')
  @ResModel({ type: Models.WEBHOOK, list: true })
  async getWebhooks(@Param('id') id: string) {
    const data = await this.projectService.getWebhooks(id);
    return data;
  }

  @Post(':id/webhooks')
  @ResModel(Models.WEBHOOK)
  async createWebhook(
    @Param('id') id: string,
    @Body() input: CreateWebhookDTO,
  ) {
    const data = await this.projectService.createWebhook(id, input);
    return data;
  }

  @Get(':id/webhooks/:webhookId')
  @ResModel(Models.WEBHOOK)
  async getWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.projectService.getWebhook(id, webhookId);
  }

  @Put(':id/webhooks/:webhookId')
  @ResModel(Models.WEBHOOK)
  async updateWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
    @Body() input: UpdateWebhookDTO,
  ) {
    return this.projectService.updateWebhook(id, webhookId, input);
  }

  @Patch(':id/webhooks/:webhookId/signature')
  @ResModel(Models.WEBHOOK)
  async updateWebhookSignature(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return this.projectService.updateWebhookSignature(id, webhookId);
  }

  @Delete(':id/webhooks/:webhookId')
  async deleteWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<{}> {
    return this.projectService.deleteWebhook(id, webhookId);
  }

  @Patch([':id/organization', ':id/team'])
  @ResModel(Models.PROJECT)
  async updateTeam(
    @Param('id') id: string,
    @Body() updateProjectTeamDTO: UpdateProjectTeamDTO,
  ) {
    return this.projectService.updateProjectOrganization(
      id,
      updateProjectTeamDTO,
    );
  }

  @Patch(':id/service')
  @ResModel(Models.PROJECT)
  async updateService(
    @Param('id') id: string,
    @Body() input: UpdateProjectServiceDTO,
  ) {
    return this.projectService.updateServiceStatus(id, input);
  }

  @Patch(':id/api')
  @ResModel(Models.PROJECT)
  async updateApi(@Param('id') id: string, @Body() input: ProjectApiStatusDTO) {
    return this.projectService.updateApiStatus(id, input);
  }

  @Patch(':id/oauth2')
  @ResModel(Models.PROJECT)
  async updateOAuth2(@Param('id') id: string, @Body() input: oAuth2DTO) {
    return this.projectService.updateOAuth2(id, input);
  }

  @Patch(':id/service/all')
  @ResModel(Models.PROJECT)
  async updateServiceAll(
    @Param('id') id: string,
    @Body() input: UpdateProjectAllServiceDTO,
  ) {
    return this.projectService.updateAllServiceStatus(id, input.status);
  }

  @Patch(':id/api/all')
  @ResModel(Models.PROJECT)
  async updateApiAll(
    @Param('id') id: string,
    @Body() input: ProjectApiStatusAllDTO,
  ) {
    return this.projectService.updateAllApiStatus(id, input.status);
  }

  @Patch(':id/auth/session-alerts')
  @ResModel(Models.PROJECT)
  async updateSessionAlerts(
    @Param('id') id: string,
    @Body() input: AuthSessionAlertsDTO,
  ) {
    return this.projectService.updateSessionAlerts(id, input.alerts);
  }

  @Patch(':id/auth/limit')
  @ResModel(Models.PROJECT)
  async updateAuthLimit(@Param('id') id: string, @Body() input: AuthLimitDTO) {
    return this.projectService.updateAuthLimit(id, input.limit);
  }

  @Patch(':id/auth/duration')
  @ResModel(Models.PROJECT)
  async updateAuthDuration(
    @Param('id') id: string,
    @Body() input: AuthDurationDTO,
  ) {
    return this.projectService.updateSessionDuration(id, input.duration);
  }

  @Patch(':id/auth/password-history')
  @ResModel(Models.PROJECT)
  async updatePasswordHistory(
    @Param('id') id: string,
    @Body() input: AuthPasswordHistoryDTO,
  ) {
    return this.projectService.updatePasswordHistory(id, input.limit);
  }

  @Patch(':id/auth/password-dictionary')
  @ResModel(Models.PROJECT)
  async updatePasswordDictionary(
    @Param('id') id: string,
    @Body() input: AuthPasswordDictionaryDTO,
  ) {
    return this.projectService.updatePasswordDictionary(id, input.enabled);
  }

  @Patch(':id/auth/personal-data')
  @ResModel(Models.PROJECT)
  async updatePersonalData(
    @Param('id') id: string,
    @Body() input: AuthPersonalDataDTO,
  ) {
    return this.projectService.updatePersonalData(id, input.enabled);
  }

  @Patch(':id/auth/max-sessions')
  @ResModel(Models.PROJECT)
  async updateMaxSessions(
    @Param('id') id: string,
    @Body() input: AuthMaxSessionsDTO,
  ) {
    return this.projectService.updateMaxSessions(id, input.limit);
  }

  @Patch(':id/auth/mock-numbers')
  @ResModel(Models.PROJECT)
  async updateMockNumbers(
    @Param('id') id: string,
    @Body() input: AuthMockNumbersDTO,
  ) {
    return this.projectService.updateMockNumbers(id, input);
  }

  @Patch(':id/auth/:method')
  @ResModel(Models.PROJECT)
  async updateAuthMethod(
    @Param('id') id: string,
    @Param('method') method: string,
    @Body() input: AuthMethodStatusDTO,
  ) {
    if (
      !Object.keys(authMethods).concat('memberships-privacy').includes(method)
    )
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid auth method');
    return this.projectService.updateAuthMethod(id, method, input.status);
  }

  @Patch(':id/smtp')
  @ResModel(Models.PROJECT)
  async updateSMTP(@Param('id') id: string, @Body() input: UpdateSmtpDTO) {
    return this.projectService.updateSMTP(id, input);
  }

  @Post(':id/smtp/tests')
  async testSMTP(
    @Param('id') id: string,
    @Body() input: SmtpTestsDTO,
  ): Promise<void> {
    return this.projectService.testSMTP(id, input);
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
