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
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import authMethods from 'src/core/config/auth';
import { Exception } from 'src/core/extend/exception';
import { ProjectService } from './projects.service';

// DTO
import { oAuth2DTO } from './dto/oauth2.dto';
import { CreateJwtDTO } from './dto/create-jwt.dto';
import { CreateKeyDTO, UpdateKeyDTO } from './dto/keys.dto';
import { CreateProjectDTO } from './dto/create-project.dto';
import { CreateWebhookDTO, UpdateWebhookDTO } from './dto/webhook.dto';
import {
  UpdateProjectDTO,
  UpdateProjectTeamDTO,
} from './dto/update-project.dto';
import {
  ProjectApiStatusAllDTO,
  ProjectApiStatusDTO,
} from './dto/project-api.dto';
import {
  UpdateProjectAllServiceDTO,
  UpdateProjectServiceDTO,
} from './dto/project-service.dto';
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
} from './dto/project-auth.dto';
import { CreatePlatformDTO, UpdatePlatformDTO } from './dto/platform.dto';
import { SmtpTestsDTO, UpdateSmtpDTO } from './dto/smtp.dto';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Response } from 'src/core/helper/response.helper';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import type { Query as Queries } from '@nuvix/database';
import { AuthGuard } from 'src/core/resolver/guards/auth.guard';
import { ConsoleInterceptor } from 'src/core/resolver/console.resolver';

@Controller({ version: ['1'], path: 'console/projects' })
@UseGuards(AuthGuard)
@UseInterceptors(ResolverInterceptor, ConsoleInterceptor)
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly clsService: ClsService,
  ) {}

  @Post()
  async create(
    @Body() createProjectDTO: CreateProjectDTO,
    @Req() req: Request,
  ) {
    const project = await this.projectService.create(createProjectDTO);
    return project;
  }

  @Get()
  @ResponseType({ type: Response.MODEL_PROJECT, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search?: string,
  ) {
    const data = await this.projectService.findAll(queries, search);
    return data;
  }

  @Get(':id')
  @ResponseType(Response.MODEL_PROJECT)
  async findOne(@Param('id') id: string) {
    const project = await this.projectService.findOne(id);
    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND);
    return project;
  }

  @Patch(':id')
  @ResponseType(Response.MODEL_PROJECT)
  async update(
    @Param('id') id: string,
    @Body() updateProjectDTO: UpdateProjectDTO,
  ) {
    return await this.projectService.update(id, updateProjectDTO);
  }

  @Delete(':id')
  @ResponseType(Response.MODEL_NONE)
  remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }

  @Post(':id/jwts')
  @ResponseType(Response.MODEL_JWT)
  createJwt(@Param('id') id: string, @Body() input: CreateJwtDTO) {
    return this.projectService.createJwt(id, input);
  }

  @Get(':id/platforms')
  @ResponseType({ type: Response.MODEL_PLATFORM, list: true })
  async getPlatforms(@Param('id') id: string) {
    const data = await this.projectService.getPlatforms(id);
    return data;
  }

  @Post(':id/platforms')
  @ResponseType(Response.MODEL_PLATFORM)
  async createPlatform(
    @Param('id') id: string,
    @Body() input: CreatePlatformDTO,
  ) {
    return await this.projectService.createPlatform(id, input);
  }

  @Get(':id/platforms/:platformId')
  @ResponseType(Response.MODEL_PLATFORM)
  async getPlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ) {
    return await this.projectService.getPlatform(id, platformId);
  }

  @Put(':id/platforms/:platformId')
  @ResponseType(Response.MODEL_PLATFORM)
  async updatePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
    @Body() input: UpdatePlatformDTO,
  ) {
    return await this.projectService.updatePlatform(id, platformId, input);
  }

  @Delete(':id/platforms/:platformId')
  @ResponseType(Response.MODEL_NONE)
  async deletePlatform(
    @Param('id') id: string,
    @Param('platformId') platformId: string,
  ): Promise<{}> {
    return await this.projectService.deletePlatform(id, platformId);
  }

  @Get(':id/keys')
  @ResponseType({ type: Response.MODEL_KEY, list: true })
  async getKeys(@Param('id') id: string) {
    const data = await this.projectService.getKeys(id);
    return data;
  }

  @Post(':id/keys')
  @ResponseType(Response.MODEL_KEY)
  async createKey(@Param('id') id: string, @Body() input: CreateKeyDTO) {
    const data = await this.projectService.createKey(id, input);
    return data;
  }

  @Get(':id/keys/:keyId')
  @ResponseType(Response.MODEL_KEY)
  async getKey(@Param('id') id: string, @Param('keyId') keyId: string) {
    return await this.projectService.getKey(id, keyId);
  }

  @Put(':id/keys/:keyId')
  @ResponseType(Response.MODEL_KEY)
  async updateKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
    @Body() input: UpdateKeyDTO,
  ) {
    return await this.projectService.updateKey(id, keyId, input);
  }

  @Delete(':id/keys/:keyId')
  @ResponseType(Response.MODEL_NONE)
  async deleteKey(
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ): Promise<{}> {
    return await this.projectService.deleteKey(id, keyId);
  }

  @Get(':id/webhooks')
  @ResponseType({ type: Response.MODEL_WEBHOOK, list: true })
  async getWebhooks(@Param('id') id: string) {
    const data = await this.projectService.getWebhooks(id);
    return data;
  }

  @Post(':id/webhooks')
  @ResponseType(Response.MODEL_WEBHOOK)
  async createWebhook(
    @Param('id') id: string,
    @Body() input: CreateWebhookDTO,
  ) {
    const data = await this.projectService.createWebhook(id, input);
    return data;
  }

  @Get(':id/webhooks/:webhookId')
  @ResponseType(Response.MODEL_WEBHOOK)
  async getWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return await this.projectService.getWebhook(id, webhookId);
  }

  @Put(':id/webhooks/:webhookId')
  @ResponseType(Response.MODEL_WEBHOOK)
  async updateWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
    @Body() input: UpdateWebhookDTO,
  ) {
    return await this.projectService.updateWebhook(id, webhookId, input);
  }

  @Patch(':id/webhooks/:webhookId/signature')
  @ResponseType(Response.MODEL_WEBHOOK)
  async updateWebhookSignature(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ) {
    return await this.projectService.updateWebhookSignature(id, webhookId);
  }

  @Delete(':id/webhooks/:webhookId')
  async deleteWebhook(
    @Param('id') id: string,
    @Param('webhookId') webhookId: string,
  ): Promise<{}> {
    return await this.projectService.deleteWebhook(id, webhookId);
  }

  @Patch([':id/organization', ':id/team'])
  @ResponseType(Response.MODEL_PROJECT)
  async updateTeam(
    @Param('id') id: string,
    @Body() updateProjectTeamDTO: UpdateProjectTeamDTO,
  ) {
    return await this.projectService.updateProjectOrganization(
      id,
      updateProjectTeamDTO,
    );
  }

  @Patch(':id/service')
  @ResponseType(Response.MODEL_PROJECT)
  async updateService(
    @Param('id') id: string,
    @Body() input: UpdateProjectServiceDTO,
  ) {
    return await this.projectService.updateServiceStatus(id, input);
  }

  @Patch(':id/api')
  @ResponseType(Response.MODEL_PROJECT)
  async updateApi(@Param('id') id: string, @Body() input: ProjectApiStatusDTO) {
    return await this.projectService.updateApiStatus(id, input);
  }

  @Patch(':id/oauth2')
  @ResponseType(Response.MODEL_PROJECT)
  async updateOAuth2(@Param('id') id: string, @Body() input: oAuth2DTO) {
    return await this.projectService.updateOAuth2(id, input);
  }

  @Patch(':id/service/all')
  @ResponseType(Response.MODEL_PROJECT)
  async updateServiceAll(
    @Param('id') id: string,
    @Body() input: UpdateProjectAllServiceDTO,
  ) {
    return await this.projectService.updateAllServiceStatus(id, input.status);
  }

  @Patch(':id/api/all')
  @ResponseType(Response.MODEL_PROJECT)
  async updateApiAll(
    @Param('id') id: string,
    @Body() input: ProjectApiStatusAllDTO,
  ) {
    return await this.projectService.updateAllApiStatus(id, input.status);
  }

  @Patch(':id/auth/session-alerts')
  @ResponseType(Response.MODEL_PROJECT)
  async updateSessionAlerts(
    @Param('id') id: string,
    @Body() input: AuthSessionAlertsDTO,
  ) {
    return await this.projectService.updateSessionAlerts(id, input.alerts);
  }

  @Patch(':id/auth/limit')
  @ResponseType(Response.MODEL_PROJECT)
  async updateAuthLimit(@Param('id') id: string, @Body() input: AuthLimitDTO) {
    return await this.projectService.updateAuthLimit(id, input.limit);
  }

  @Patch(':id/auth/duration')
  @ResponseType(Response.MODEL_PROJECT)
  async updateAuthDuration(
    @Param('id') id: string,
    @Body() input: AuthDurationDTO,
  ) {
    return await this.projectService.updateSessionDuration(id, input.duration);
  }

  @Patch(':id/auth/password-history')
  @ResponseType(Response.MODEL_PROJECT)
  async updatePasswordHistory(
    @Param('id') id: string,
    @Body() input: AuthPasswordHistoryDTO,
  ) {
    return await this.projectService.updatePasswordHistory(id, input.limit);
  }

  @Patch(':id/auth/password-dictionary')
  @ResponseType(Response.MODEL_PROJECT)
  async updatePasswordDictionary(
    @Param('id') id: string,
    @Body() input: AuthPasswordDictionaryDTO,
  ) {
    return await this.projectService.updatePasswordDictionary(
      id,
      input.enabled,
    );
  }

  @Patch(':id/auth/personal-data')
  @ResponseType(Response.MODEL_PROJECT)
  async updatePersonalData(
    @Param('id') id: string,
    @Body() input: AuthPersonalDataDTO,
  ) {
    return await this.projectService.updatePersonalData(id, input.enabled);
  }

  @Patch(':id/auth/max-sessions')
  @ResponseType(Response.MODEL_PROJECT)
  async updateMaxSessions(
    @Param('id') id: string,
    @Body() input: AuthMaxSessionsDTO,
  ) {
    return await this.projectService.updateMaxSessions(id, input.limit);
  }

  @Patch(':id/auth/mock-numbers')
  @ResponseType(Response.MODEL_PROJECT)
  async updateMockNumbers(
    @Param('id') id: string,
    @Body() input: AuthMockNumbersDTO,
  ) {
    return await this.projectService.updateMockNumbers(id, input);
  }

  @Patch(':id/auth/:method')
  @ResponseType(Response.MODEL_PROJECT)
  async updateAuthMethod(
    @Param('id') id: string,
    @Param('method') method: string,
    @Body() input: AuthMethodStatusDTO,
  ) {
    if (
      !Object.keys(authMethods).concat('memberships-privacy').includes(method)
    )
      throw new Exception(Exception.INVALID_PARAMS, 'Invalid auth method');
    return await this.projectService.updateAuthMethod(id, method, input.status);
  }

  @Patch(':id/smtp')
  @ResponseType(Response.MODEL_PROJECT)
  async updateSMTP(@Param('id') id: string, @Body() input: UpdateSmtpDTO) {
    return await this.projectService.updateSMTP(id, input);
  }

  @Post(':id/smtp/tests')
  async testSMTP(
    @Param('id') id: string,
    @Body() input: SmtpTestsDTO,
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
