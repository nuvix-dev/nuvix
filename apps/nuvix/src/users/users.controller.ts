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
  ProjectDatabase,
} from '@nuvix/core/decorators';

import { CreateTokenDTO } from './DTO/token.dto';
import { CreateJwtDTO } from './DTO/jwt.dto';
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
    @ProjectDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(db, queries, search);
  }

  @Post()
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async create(
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.create(db, createUserDTO, project);
  }

  @Post('argon2')
  @Scope('users.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.USER)
  @AuditEvent('user.create', 'user/{res.$id}')
  async createWithArgon2(
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithArgon2(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithBcrypt(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithMd5(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithSha(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithPhpass(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScrypt(
      db,
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
    @ProjectDatabase() db: Database,
    @Body() createUserDTO: CreateUserDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.createWithScryptMod(
      db,
      createUserDTO,
      project,
    );
  }

  @Get('usage')
  @ResModel({ type: Models.USAGE_USERS })
  async getUsage(@ProjectDatabase() db: Database) {
    return await this.usersService.getUsage(db);
  }

  @Get('identities')
  @Scope('users.read')
  @ResModel({ type: Models.IDENTITY, list: true })
  async getIdentities(
    @ProjectDatabase() db: Database,
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.getIdentities(db, queries, search);
  }

  @Delete('identities/:id')
  @Scope('users.read')
  async deleteIdentity(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.deleteIdentity(db, id);
  }

  @Get(':id')
  @Scope('users.read')
  @ResModel(Models.USER)
  async findOne(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.findOne(db, id);
  }

  @Get(':id/prefs')
  @Scope('users.read')
  @ResModel(Models.PREFERENCES)
  async getPrefs(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getPrefs(db, id);
  }

  @Patch(':id/prefs')
  @Scope('users.update')
  @ResModel(Models.USER)
  async updatePrefs(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPrefsDTO,
  ) {
    return await this.usersService.updatePrefs(db, id, input.prefs);
  }

  @Patch(':id/status')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateStatus(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDTO,
  ) {
    return await this.usersService.updateStatus(db, id, status);
  }

  @Put(':id/labels')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateLabels(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDTO,
  ) {
    return await this.usersService.updateLabels(db, id, input);
  }

  @Patch(':id/name')
  @Scope('users.update')
  @ResModel({ type: Models.USER })
  async updateName(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserNameDTO,
  ) {
    return await this.usersService.updateName(db, id, input);
  }

  @Patch(':id/password')
  @ResModel({ type: Models.USER })
  async updatePassword(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDTO,
    @Project() project: Document,
  ) {
    return await this.usersService.updatePassword(
      db,
      id,
      input,
      project,
    );
  }

  @Patch(':id/email')
  @ResModel({ type: Models.USER })
  async updateEmail(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDTO,
  ) {
    return await this.usersService.updateEmail(db, id, input.email);
  }

  @Patch(':id/phone')
  @ResModel({ type: Models.USER })
  async updatePhone(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDTO,
  ) {
    return await this.usersService.updatePhone(db, id, input.phone);
  }

  @Patch(':id/mfa')
  @ResModel({ type: Models.USER })
  async updateMfa(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateMfaStatusDTO,
  ) {
    return await this.usersService.updateMfaStatus(db, id, input.mfa);
  }

  @Post(':id/targets')
  @Scope('targets.create')
  @Label('res.type', 'JSON')
  @Label('res.status', 'CREATED')
  @ResModel(Models.TARGET)
  @AuditEvent('target.create', 'target/{res.$id}')
  async addTarget(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<any> {
    return await this.usersService.createTarget(
      db,
      id,
      createTargetDTO,
    );
  }

  @Get(':id/targets')
  @ResModel({ type: Models.TARGET, list: true })
  async getTargets(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getTargets(db, id);
  }

  @Post(':id/jwts')
  @ResModel({ type: Models.JWT })
  async createJwt(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateJwtDTO,
  ): Promise<any> {
    return await this.usersService.createJwt(db, id, input);
  }

  @Get(':id/sessions')
  @ResModel({ type: Models.SESSION, list: true })
  async getSessions(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getSessions(db, id);
  }

  @Post(':id/sessions')
  @ResModel({ type: Models.SESSION })
  async createSession(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Req() req: any,
    @Project() project: Document,
  ): Promise<any> {
    return await this.usersService.createSession(
      db,
      id,
      req,
      project,
    );
  }

  @Delete(':id/sessions')
  async deleteSessions(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.deleteSessions(db, id);
  }

  @Get(':id/memberships')
  @ResModel({ type: Models.MEMBERSHIP, list: true })
  async getMemberships(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ): Promise<any> {
    return await this.usersService.getMemberships(db, id);
  }

  @Post(':id/tokens')
  @ResModel({ type: Models.TOKEN })
  async createToken(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: CreateTokenDTO,
    @Req() req: NuvixRequest,
  ): Promise<any> {
    return await this.usersService.createToken(db, id, input, req);
  }

  @Get(':id/logs')
  @ResModel({ type: Models.LOG, list: true })
  async getLogs(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Query('queries') queries: Queries[],
  ): Promise<any> {
    return await this.usersService.getLogs(db, id, queries);
  }

  @Patch(':id/verification')
  @ResModel({ type: Models.USER })
  async verify(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDTO,
  ) {
    return await this.usersService.updateEmailVerification(
      db,
      id,
      input,
    );
  }

  @Patch(':id/verification/phone')
  @ResModel({ type: Models.USER })
  async verifyPhone(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDTO,
  ) {
    return await this.usersService.updatePhoneVerification(
      db,
      id,
      input,
    );
  }

  @Get(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async getTarget(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ): Promise<any> {
    return await this.usersService.getTarget(db, id, targetId);
  }

  @Patch(':id/targets/:targetId')
  @ResModel({ type: Models.TARGET })
  async updateTarget(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() input: UpdateTargetDTO,
  ): Promise<any> {
    return await this.usersService.updateTarget(
      db,
      id,
      targetId,
      input,
    );
  }

  @Get(':id/mfa/factors')
  @ResModel({ type: Models.MFA_FACTORS })
  async getMfaFactors(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getMfaFactors(db, id);
  }

  @Get(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async getMfaRecoveryCodes(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.getMfaRecoveryCodes(db, id);
  }

  @Patch(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async generateMfaRecoveryCodes(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.generateMfaRecoveryCodes(db, id);
  }

  @Put(':id/mfa/recovery-codes')
  @ResModel({ type: Models.MFA_RECOVERY_CODES })
  async regenerateMfaRecoveryCodes(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.regenerateMfaRecoveryCodes(db, id);
  }

  @Delete(':id/mfa/authenticators/:type')
  async deleteMfaAuthenticator(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('type') type: string,
  ) {
    return await this.usersService.deleteMfaAuthenticator(
      db,
      id,
      type,
    );
  }

  @Delete(':id/session/:sessionId')
  async deleteSession(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return await this.usersService.deleteSession(db, id, sessionId);
  }

  @Delete(':id/targets/:targetId')
  async deleteTarget(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ) {
    return await this.usersService.deleteTarget(db, id, targetId);
  }

  @Delete(':id')
  async remove(
    @ProjectDatabase() db: Database,
    @Param('id') id: string,
  ) {
    return await this.usersService.remove(db, id);
  }
}
