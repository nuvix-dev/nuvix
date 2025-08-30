import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDTO,
  UpdateMfaStatusDTO,
  UpdateUserEmailDTO,
  UpdateUserEmailVerificationDTO,
  UpdateUserLabelDTO,
  UpdateUserNameDTO,
  UpdateUserPasswordDTO,
  UpdateUserPhoneDTO,
  UpdateUserPoneVerificationDTO,
  UpdateUserPrefsDTO,
  UpdateUserStatusDTO,
} from './DTO/user.dto';
import { CreateTargetDTO, UpdateTargetDTO } from './DTO/target.dto';
import { Models } from '@nuvix/core/helper/response.helper';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import {
  AuditEvent,
  Label,
  Namespace,
  Project,
  ResModel,
  Scope,
  AuthType,
  AuthDatabase,
  Sdk,
} from '@nuvix/core/decorators';

import { CreateTokenDTO } from './DTO/token.dto';
import { CreateJwtDTO } from './DTO/jwt.dto';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import type { Database, Doc, Query as Queries } from '@nuvix-tech/db';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import type { ProjectsDoc } from '@nuvix/utils/types';
import { IdentitiesQueryPipe, UsersQueryPipe } from '@nuvix/core/pipes/queries';

@Namespace('users')
@Controller({ version: ['1'], path: 'users' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Scope('users.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  @ResModel(Models.USER, { list: true })
  async findAll(
    @AuthDatabase() db: Database,
    @Query('queries', UsersQueryPipe) queries?: Queries[],
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(db, queries, search);
  }

  @Post()
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async create(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.create(db, createUserDTO, project);
  }

  @Post('argon2')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithArgon2(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithArgon2(db, createUserDTO, project);
  }

  @Post('bcrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithBcrypt(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithBcrypt(db, createUserDTO, project);
  }

  @Post('md5')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithMd5(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithMd5(db, createUserDTO, project);
  }

  @Post('sha')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithSha(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithSha(db, createUserDTO, project);
  }

  @Post('phpass')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithPhpass(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithPhpass(db, createUserDTO, project);
  }

  @Post('scrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScrypt(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithScrypt(db, createUserDTO, project);
  }

  @Post('scrypt-modified')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScryptModified(
    @AuthDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.createWithScryptMod(db, createUserDTO, project);
  }

  @Get('usage')
  @ResModel({ type: Models.USAGE_USERS })
  async getUsage(@AuthDatabase() db: Database) {
    return this.usersService.getUsage(db);
  }

  @Get('identities')
  @Scope('users.read')
  @ResModel({ type: Models.IDENTITY, list: true })
  async getIdentities(
    @AuthDatabase() db: Database,
    @Query('queries', IdentitiesQueryPipe) queries?: Queries[],
    @Query('search') search?: string,
  ) {
    return this.usersService.getIdentities(db, queries, search);
  }

  @Delete('identities/:id')
  @Scope('users.read')
  async deleteIdentity(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.deleteIdentity(db, id);
  }

  @Get(':id')
  @Scope('users.read')
  @ResModel(Models.USER)
  async findOne(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.findOne(db, id);
  }

  @Get(':id/prefs')
  @Scope('users.read')
  @ResModel(Models.PREFERENCES)
  async getPrefs(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.getPrefs(db, id);
  }

  @Patch(':id/prefs')
  @Scope('users.update')
  @ResModel(Models.USER)
  async updatePrefs(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() { prefs }: UpdateUserPrefsDTO,
  ) {
    return this.usersService.updatePrefs(db, id, prefs);
  }

  @Patch(':id/status')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateStatus(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDTO,
  ) {
    return this.usersService.updateStatus(db, id, status);
  }

  @Put(':id/labels')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateLabels(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDTO,
  ) {
    return this.usersService.updateLabels(db, id, input);
  }

  @Patch(':id/name')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateName(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserNameDTO,
  ) {
    return this.usersService.updateName(db, id, input);
  }

  @Patch(':id/password')
  @ResModel({ type: Models.USER })
  async updatePassword(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDTO,
    @Project() project: ProjectsDoc,
  ) {
    return this.usersService.updatePassword(db, id, input, project);
  }

  @Patch(':id/email')
  @ResModel({ type: Models.USER })
  async updateEmail(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDTO,
  ) {
    return this.usersService.updateEmail(db, id, input.email);
  }

  @Patch(':id/phone')
  @ResModel({ type: Models.USER })
  async updatePhone(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDTO,
  ) {
    return this.usersService.updatePhone(db, id, input.phone);
  }

  @Patch(':id/mfa')
  @ResModel({ type: Models.USER })
  async updateMfa(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateMfaStatusDTO,
  ) {
    return this.usersService.updateMfaStatus(db, id, input.mfa);
  }

  @Post(':id/targets')
  @Scope('targets.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.TARGET)
  @AuditEvent('target.create', 'target/{res.$id}')
  async addTarget(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<any> {
    return this.usersService.createTarget(db, id, createTargetDTO);
  }

  @Get(':id/targets')
  @ResModel({ type: Models.TARGET, list: true })
  async getTargets(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return this.usersService.getTargets(db, id);
  }

  @Post(':id/jwts')
  @ResModel({ type: Models.JWT })
  async createJwt(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateJwtDTO,
  ): Promise<any> {
    return this.usersService.createJwt(db, id, input);
  }

  @Get(':id/sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return this.usersService.getSessions(db, id);
  }

  @Post(':id/sessions')
  @ResModel({ type: Models.SESSION })
  async createSession(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Req() req: any,
    @Project() project: ProjectsDoc,
  ): Promise<any> {
    return this.usersService.createSession(db, id, req, project);
  }

  @Delete(':id/sessions')
  async deleteSessions(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.deleteSessions(db, id);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return this.usersService.getMemberships(db, id);
  }

  @Post(':id/tokens')
  @ResModel({ type: Models.TOKEN })
  async createToken(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateTokenDTO,
    @Req() req: NuvixRequest,
  ): Promise<any> {
    return this.usersService.createToken(db, id, input, req);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries') queries: Queries[],
  ): Promise<any> {
    return this.usersService.getLogs(db, id, queries);
  }

  @Patch(':id/verification')
  @ResModel({ type: Models.USER })
  async verify(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDTO,
  ) {
    return this.usersService.updateEmailVerification(db, id, input);
  }

  @Patch(':id/verification/phone')
  @ResModel({ type: Models.USER })
  async verifyPhone(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDTO,
  ) {
    return this.usersService.updatePhoneVerification(db, id, input);
  }

  @Get(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async getTarget(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ): Promise<any> {
    return this.usersService.getTarget(db, id, targetId);
  }

  @Patch(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async updateTarget(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() input: UpdateTargetDTO,
  ): Promise<any> {
    return this.usersService.updateTarget(db, id, targetId, input);
  }

  @Get(':id/mfa/factors')
  @ResModel({ type: Models.MFA_FACTORS })
  async getMfaFactors(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.getMfaFactors(db, id);
  }

  @Get(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async getMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return this.usersService.getMfaRecoveryCodes(db, id);
  }

  @Patch(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async generateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return this.usersService.generateMfaRecoveryCodes(db, id);
  }

  @Put(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async regenerateMfaRecoveryCodes(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return this.usersService.regenerateMfaRecoveryCodes(db, id);
  }

  @Delete(':id/mfa/authenticators/:type')
  async deleteMfaAuthenticator(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return this.usersService.deleteMfaAuthenticator(db, id, type);
  }

  @Delete(':id/session/:sessionId')
  async deleteSession(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.usersService.deleteSession(db, id, sessionId);
  }

  @Delete(':id/targets/:targetId')
  async deleteTarget(
    @AuthDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ) {
    return this.usersService.deleteTarget(db, id, targetId);
  }

  @Delete(':id')
  async remove(@AuthDatabase() db: Database, @Param('id') id: string) {
    return this.usersService.remove(db, id);
  }
}
