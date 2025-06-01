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
} from '@nuvix/core/decorators';

import { CreateTokenDTO } from './dto/token.dto';
import { CreateJwtDTO } from './dto/jwt.dto';
import { ParseQueryPipe } from '@nuvix/core/pipes/query.pipe';
import type { Database, Document, Query as Queries } from '@nuvix/database';
import { ProjectGuard } from '@nuvix/core/resolvers/guards/project.guard';
import { ApiInterceptor } from '@nuvix/core/resolvers/interceptors/api.interceptor';
import { CACHE } from '@nuvix/utils/constants';
import { Cache } from '@nuvix/cache';

@Namespace('users')
@Controller({ version: ['1'], path: 'users' })
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
    @AuthDatabase() authDatabase: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(authDatabase, queries, search);
  }

  @Post()
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async create(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.create(authDatabase, createUserDTO, project);
  }

  @Post('argon2')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithArgon2(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithArgon2(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('bcrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithBcrypt(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithBcrypt(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('md5')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithMd5(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithMd5(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('sha')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithSha(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithSha(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('phpass')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithPhpass(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithPhpass(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('scrypt')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScrypt(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScrypt(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Post('scrypt-modified')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithScryptModified(
    @AuthDatabase() authDatabase: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScryptMod(
      authDatabase,
      createUserDTO,
      project,
    );
  }

  @Get('usage')
  @ResModel({ type: Models.USAGE_USERS })
  async getUsage(@AuthDatabase() authDatabase: Database) {
    return await this.usersService.getUsage(authDatabase);
  }

  @Get('identities')
  @Scope('users.read')
  @ResModel({ type: Models.IDENTITY, list: true })
  async getIdentities(
    @AuthDatabase() authDatabase: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.getIdentities(authDatabase, queries, search);
  }

  @Delete('identities/:id')
  @Scope('users.read')
  async deleteIdentity(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.deleteIdentity(authDatabase, id);
  }

  @Get(':id')
  @Scope('users.read')
  @ResModel(Models.USER)
  async findOne(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.findOne(authDatabase, id);
  }

  @Get(':id/prefs')
  @Scope('users.read')
  @ResModel(Models.PREFERENCES)
  async getPrefs(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getPrefs(authDatabase, id);
  }

  @Patch(':id/prefs')
  @Scope('users.update')
  @ResModel(Models.USER)
  async updatePrefs(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPrefsDTO,
  ) {
    return await this.usersService.updatePrefs(authDatabase, id, input.prefs);
  }

  @Patch(':id/status')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateStatus(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDTO,
  ) {
    return await this.usersService.updateStatus(authDatabase, id, status);
  }

  @Put(':id/labels')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateLabels(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDTO,
  ) {
    return await this.usersService.updateLabels(authDatabase, id, input);
  }

  @Patch(':id/name')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateName(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserNameDTO,
  ) {
    return await this.usersService.updateName(authDatabase, id, input);
  }

  @Patch(':id/password')
  @ResModel({ type: Models.USER })
  async updatePassword(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.updatePassword(
      authDatabase,
      id,
      input,
      project,
    );
  }

  @Patch(':id/email')
  @ResModel({ type: Models.USER })
  async updateEmail(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDTO,
  ) {
    return await this.usersService.updateEmail(authDatabase, id, input.email);
  }

  @Patch(':id/phone')
  @ResModel({ type: Models.USER })
  async updatePhone(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDTO,
  ) {
    return await this.usersService.updatePhone(authDatabase, id, input.phone);
  }

  @Patch(':id/mfa')
  @ResModel({ type: Models.USER })
  async updateMfa(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateMfaStatusDTO,
  ) {
    return await this.usersService.updateMfaStatus(authDatabase, id, input.mfa);
  }

  @Post(':id/targets')
  @Scope('targets.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.TARGET)
  @AuditEvent('target.create', 'target/{res.$id}')
  async addTarget(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<any> {
    return await this.usersService.createTarget(
      authDatabase,
      id,
      createTargetDTO,
    );
  }

  @Get(':id/targets')
  @ResModel({ type: Models.TARGET, list: true })
  async getTargets(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getTargets(authDatabase, id);
  }

  @Post(':id/jwts')
  @ResModel({ type: Models.JWT })
  async createJwt(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: CreateJwtDTO,
  ): Promise<any> {
    return await this.usersService.createJwt(authDatabase, id, input);
  }

  @Get(':id/sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getSessions(authDatabase, id);
  }

  @Post(':id/sessions')
  @ResModel({ type: Models.SESSION })
  async createSession(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Req() req: any,
    @Project() project: Document,
  ): Promise<any> {
    return await this.usersService.createSession(
      authDatabase,
      id,
      req,
      project,
    );
  }

  @Delete(':id/sessions')
  async deleteSessions(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.deleteSessions(authDatabase, id);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getMemberships(authDatabase, id);
  }

  @Post(':id/tokens')
  @ResModel({ type: Models.TOKEN })
  async createToken(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: CreateTokenDTO,
    @Req() req: NuvixRequest,
  ): Promise<any> {
    return await this.usersService.createToken(authDatabase, id, input, req);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Query('queries') queries: Queries[],
  ): Promise<any> {
    return await this.usersService.getLogs(authDatabase, id, queries);
  }

  @Patch(':id/verification')
  @ResModel({ type: Models.USER })
  async verify(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDTO,
  ) {
    return await this.usersService.updateEmailVerification(
      authDatabase,
      id,
      input,
    );
  }

  @Patch(':id/verification/phone')
  @ResModel({ type: Models.USER })
  async verifyPhone(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDTO,
  ) {
    return await this.usersService.updatePhoneVerification(
      authDatabase,
      id,
      input,
    );
  }

  @Get(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async getTarget(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ): Promise<any> {
    return await this.usersService.getTarget(authDatabase, id, targetId);
  }

  @Patch(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async updateTarget(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() input: UpdateTargetDTO,
  ): Promise<any> {
    return await this.usersService.updateTarget(
      authDatabase,
      id,
      targetId,
      input,
    );
  }

  @Get(':id/mfa/factors')
  @ResModel({ type: Models.MFA_FACTORS })
  async getMfaFactors(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getMfaFactors(authDatabase, id);
  }

  @Get(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async getMfaRecoveryCodes(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getMfaRecoveryCodes(authDatabase, id);
  }

  @Patch(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async generateMfaRecoveryCodes(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.generateMfaRecoveryCodes(authDatabase, id);
  }

  @Put(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async regenerateMfaRecoveryCodes(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.regenerateMfaRecoveryCodes(authDatabase, id);
  }

  @Delete(':id/mfa/authenticators/:type')
  async deleteMfaAuthenticator(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return await this.usersService.deleteMfaAuthenticator(
      authDatabase,
      id,
      type,
    );
  }

  @Delete(':id/session/:sessionId')
  async deleteSession(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return await this.usersService.deleteSession(authDatabase, id, sessionId);
  }

  @Delete(':id/targets/:targetId')
  async deleteTarget(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ) {
    return await this.usersService.deleteTarget(authDatabase, id, targetId);
  }

  @Delete(':id')
  async remove(
    @AuthDatabase() authDatabase: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.remove(authDatabase, id);
  }
}
