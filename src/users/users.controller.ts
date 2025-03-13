import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
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
} from './dto/user.dto';
import { CreateTargetDTO, UpdateTargetDTO } from './dto/target.dto';
import { Models } from 'src/core/helper/response.helper';
import { ResponseInterceptor } from 'src/core/resolvers/interceptors/response.interceptor';
import {
  AuditEvent,
  Label,
  Namespace,
  Project,
  ResModel,
  Scope,
  AuthType,
} from 'src/core/decorators';
import { FastifyRequest } from 'fastify';
import { CreateTokenDTO } from './dto/token.dto';
import { CreateJwtDTO } from './dto/jwt.dto';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import type { Document, Query as Queries } from '@nuvix/database';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';
import { ApiInterceptor } from 'src/core/resolvers/interceptors/api.interceptor';
import { APP_AUTH_TYPE_KEY, CACHE } from 'src/Utils/constants';
import { Cache } from '@nuvix/cache';

@Namespace('users')
@Controller({ version: ['1'], path: 'users' })
@AuthType(APP_AUTH_TYPE_KEY)
@UseGuards(ProjectGuard)
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  @Get()
  @Scope('users.read')
  @Label('res.type', 'JSON')
  @Label('res.status', 'OK')
  @ResModel({ type: Models.USER, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(queries, search);
  }

  @Post()
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async create(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.create(createUserDTO, project);
  }

  @Post('argon2')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithArgon2(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithArgon2(createUserDTO, project);
  }

  @Post('bcrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithBcrypt(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithBcrypt(createUserDTO, project);
  }

  @Post('md5')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithMd5(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithMd5(createUserDTO, project);
  }

  @Post('sha')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithSha(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithSha(createUserDTO, project);
  }

  @Post('phpass')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithPhpass(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithPhpass(createUserDTO, project);
  }

  @Post('scrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScrypt(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScrypt(createUserDTO, project);
  }

  @Post('scrypt-modified')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScryptModified(
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScryptMod(createUserDTO, project);
  }

  @Get('usage')
  @ResModel({ type: Models.USAGE_USERS })
  async getUsage() {
    return await this.usersService.getUsage();
  }

  @Get('identities')
  @Scope('users.read')
  @ResModel({ type: Models.IDENTITY, list: true })
  async getIdentities(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.getIdentities(queries, search);
  }

  @Delete('identities/:id')
  @Scope('users.read')
  async deleteIdentity(@Param('id') id: string) {
    return await this.usersService.deleteIdentity(id);
  }

  @Get(':id')
  @Scope('users.read')
  @ResModel(Models.USER)
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @Get(':id/prefs')
  @Scope('users.read')
  @ResModel(Models.PREFERENCES)
  async getPrefs(@Param('id') id: string) {
    return await this.usersService.getPrefs(id);
  }

  @Patch(':id/prefs')
  @Scope('users.update')
  @ResModel(Models.USER)
  async updatePrefs(
    @Param('id') id: string,
    @Body() input: UpdateUserPrefsDTO,
  ) {
    return await this.usersService.updatePrefs(id, input.prefs);
  }

  @Patch(':id/status')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateStatus(
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDTO,
  ) {
    return await this.usersService.updateStatus(id, status);
  }

  @Put(':id/labels')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateLabels(
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDTO,
  ) {
    return await this.usersService.updateLabels(id, input);
  }

  @Patch(':id/name')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateName(@Param('id') id: string, @Body() input: UpdateUserNameDTO) {
    return await this.usersService.updateName(id, input);
  }

  @Patch(':id/password')
  @ResModel({ type: Models.USER })
  async updatePassword(
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.updatePassword(id, input, project);
  }

  @Patch(':id/email')
  @ResModel({ type: Models.USER })
  async updateEmail(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDTO,
  ) {
    return await this.usersService.updateEmail(id, input.email);
  }

  @Patch(':id/phone')
  @ResModel({ type: Models.USER })
  async updatePhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDTO,
  ) {
    return await this.usersService.updatePhone(id, input.phone);
  }

  @Patch(':id/mfa')
  @ResModel({ type: Models.USER })
  async updateMfa(@Param('id') id: string, @Body() input: UpdateMfaStatusDTO) {
    return await this.usersService.updateMfaStatus(id, input.mfa);
  }

  @Post(':id/targets')
  @Scope('targets.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.TARGET)
  @AuditEvent('target.create', 'target/{res.$id}')
  async addTarget(
    @Param('id') id: string,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<any> {
    return await this.usersService.createTarget(id, createTargetDTO);
  }

  @Get(':id/targets')
  @ResModel({ type: Models.TARGET, list: true })
  async getTargets(@Param('id') id: string): Promise<any> {
    return await this.usersService.getTargets(id);
  }

  @Post(':id/jwts')
  @ResModel({ type: Models.JWT })
  async createJwt(
    @Param('id') id: string,
    @Body() input: CreateJwtDTO,
  ): Promise<any> {
    return await this.usersService.createJwt(id, input);
  }

  @Get(':id/sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(@Param('id') id: string): Promise<any> {
    return await this.usersService.getSessions(id);
  }

  @Post(':id/sessions')
  @ResModel({ type: Models.SESSION })
  async createSession(
    @Param('id') id: string,
    @Req() req: any,
    @Project() project: Document,
  ): Promise<any> {
    return await this.usersService.createSession(id, req, project);
  }

  @Delete(':id/sessions')
  async deleteSessions(@Param('id') id: string) {
    return await this.usersService.deleteSessions(id);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(@Param('id') id: string): Promise<any> {
    return await this.usersService.getMemberships(id);
  }

  @Post(':id/tokens')
  @ResModel({ type: Models.TOKEN })
  async createToken(
    @Param('id') id: string,
    @Body() input: CreateTokenDTO,
    @Req() req: FastifyRequest,
  ): Promise<any> {
    return await this.usersService.createToken(id, input, req);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(
    @Param('id') id: string,
    @Query('queries') queries: Queries[],
  ): Promise<any> {
    return await this.usersService.getLogs(id, queries);
  }

  @Patch(':id/verification')
  @ResModel({ type: Models.USER })
  async verify(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDTO,
  ) {
    return await this.usersService.updateEmailVerification(id, input);
  }

  @Patch(':id/verification/phone')
  @ResModel({ type: Models.USER })
  async verifyPhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDTO,
  ) {
    return await this.usersService.updatePhoneVerification(id, input);
  }

  @Get(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async getTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ): Promise<any> {
    return await this.usersService.getTarget(id, targetId);
  }

  @Patch(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async updateTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() input: UpdateTargetDTO,
  ): Promise<any> {
    return await this.usersService.updateTarget(id, targetId, input);
  }

  @Get(':id/mfa/factors')
  @ResModel({ type: Models.MFA_FACTORS })
  async getMfaFactors(@Param('id') id: string) {
    return await this.usersService.getMfaFactors(id);
  }

  @Get(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async getMfaRecoveryCodes(@Param('id') id: string) {
    return await this.usersService.getMfaRecoveryCodes(id);
  }

  @Patch(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async generateMfaRecoveryCodes(@Param('id') id: string) {
    return await this.usersService.generateMfaRecoveryCodes(id);
  }

  @Put(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async regenerateMfaRecoveryCodes(@Param('id') id: string) {
    return await this.usersService.regenerateMfaRecoveryCodes(id);
  }

  @Delete(':id/mfa/authenticators/:type')
  async deleteMfaAuthenticator(
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return await this.usersService.deleteMfaAuthenticator(id, type);
  }

  @Delete(':id/session/:sessionId')
  async deleteSession(
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return await this.usersService.deleteSession(id, sessionId);
  }

  @Delete(':id/targets/:targetId')
  async deleteTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ) {
    return await this.usersService.deleteTarget(id, targetId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.usersService.remove(id);
  }
}
