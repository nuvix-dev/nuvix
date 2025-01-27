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
} from './dto/user.dto';
import { CreateTargetDTO, UpdateTargetDTO } from './dto/target.dto';
import { Response } from 'src/core/helper/response.helper';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Request } from 'express';
import { CreateTokenDTO } from './dto/token.dto';
import { CreateJwtDTO } from './dto/jwt.dto';
import { ParseQueryPipe } from 'src/core/pipes/query.pipe';
import type { Query as Queries } from '@nuvix/database';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';

@Controller({ version: ['1'], path: 'users' })
@UseGuards(ProjectGuard)
@UseInterceptors(ResolverInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ResponseType({ type: Response.MODEL_USER, list: true })
  async findAll(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(queries, search);
  }

  @Post()
  @ResponseType({ type: Response.MODEL_USER })
  async create(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.create(createUserDTO);
  }

  @Post('argon2')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithArgon2(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithArgon2(createUserDTO);
  }

  @Post('bcrypt')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithBcrypt(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithBcrypt(createUserDTO);
  }

  @Post('md5')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithMd5(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithMd5(createUserDTO);
  }

  @Post('sha')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithSha(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithSha(createUserDTO);
  }

  @Post('phpass')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithPhpass(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithPhpass(createUserDTO);
  }

  @Post('scrypt')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithScrypt(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithScrypt(createUserDTO);
  }

  @Post('scrypt-modified')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithScryptModified(@Body() createUserDTO: CreateUserDTO) {
    return await this.usersService.createWithScryptMod(createUserDTO);
  }

  @Get('usage')
  @ResponseType({ type: Response.MODEL_USAGE_USERS })
  async getUsage() {
    return await this.usersService.getUsage();
  }

  @Get('identities')
  @ResponseType({ type: Response.MODEL_IDENTITY, list: true })
  async getIdentities(
    @Query('queries', ParseQueryPipe) queries: Queries[],
    @Query('search') search: string,
  ) {
    return await this.usersService.getIdentities(queries, search);
  }

  @Delete('identities/:id')
  async deleteIdentity(@Param('id') id: string) {
    return await this.usersService.deleteIdentity(id);
  }

  @Get(':id')
  @ResponseType({ type: Response.MODEL_USER })
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @Get(':id/prefs')
  async getPrefs(@Param('id') id: string) {
    return await this.usersService.getPrefs(id);
  }

  @Patch(':id/prefs')
  async updatePrefs(
    @Param('id') id: string,
    @Body() input: UpdateUserPrefsDTO,
  ) {
    return await this.usersService.updatePrefs(id, input.prefs);
  }

  @Patch(':id/status')
  @ResponseType({ type: Response.MODEL_USER })
  async updateStatus(
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDTO,
  ) {
    return await this.usersService.updateStatus(id, status);
  }

  @Put(':id/labels')
  @ResponseType({ type: Response.MODEL_USER })
  async updateLabels(
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDTO,
  ) {
    return await this.usersService.updateLabels(id, input);
  }

  @Patch(':id/name')
  @ResponseType({ type: Response.MODEL_USER })
  async updateName(@Param('id') id: string, @Body() input: UpdateUserNameDTO) {
    return await this.usersService.updateName(id, input);
  }

  @Patch(':id/password')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePassword(
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDTO,
  ) {
    return await this.usersService.updatePassword(id, input);
  }

  @Patch(':id/email')
  @ResponseType({ type: Response.MODEL_USER })
  async updateEmail(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDTO,
  ) {
    return await this.usersService.updateEmail(id, input.email);
  }

  @Patch(':id/phone')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDTO,
  ) {
    return await this.usersService.updatePhone(id, input.phone);
  }

  @Patch(':id/mfa')
  @ResponseType({ type: Response.MODEL_USER })
  async updateMfa(@Param('id') id: string, @Body() input: UpdateMfaStatusDTO) {
    return await this.usersService.updateMfaStatus(id, input.mfa);
  }

  @Post(':id/targets')
  @ResponseType({ type: Response.MODEL_TARGET })
  async addTarget(
    @Param('id') id: string,
    @Body() createTargetDTO: CreateTargetDTO,
  ): Promise<any> {
    return await this.usersService.createTarget(id, createTargetDTO);
  }

  @Get(':id/targets')
  @ResponseType({ type: Response.MODEL_TARGET, list: true })
  async getTargets(@Param('id') id: string): Promise<any> {
    return await this.usersService.getTargets(id);
  }

  @Post(':id/jwts')
  @ResponseType({ type: Response.MODEL_JWT })
  async createJwt(
    @Param('id') id: string,
    @Body() input: CreateJwtDTO,
  ): Promise<any> {
    return await this.usersService.createJwt(id, input);
  }

  @Get(':id/sessions')
  @ResponseType({ type: Response.MODEL_SESSION, list: true })
  async getSessions(@Param('id') id: string): Promise<any> {
    return await this.usersService.getSessions(id);
  }

  @Post(':id/sessions')
  @ResponseType({ type: Response.MODEL_SESSION })
  async createSession(@Param('id') id: string, @Req() req: any): Promise<any> {
    return await this.usersService.createSession(id, req);
  }

  @Delete(':id/sessions')
  async deleteSessions(@Param('id') id: string) {
    return await this.usersService.deleteSessions(id);
  }

  @Get(':id/memberships')
  @ResponseType({ type: Response.MODEL_MEMBERSHIP, list: true })
  async getMemberships(@Param('id') id: string): Promise<any> {
    return await this.usersService.getMemberships(id);
  }

  @Post(':id/tokens')
  @ResponseType({ type: Response.MODEL_TOKEN })
  async createToken(
    @Param('id') id: string,
    @Body() input: CreateTokenDTO,
    @Req() req: Request,
  ): Promise<any> {
    return await this.usersService.createToken(id, input, req);
  }

  @Get(':id/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
  async getLogs(
    @Param('id') id: string,
    @Query('queries') queries: Queries[],
  ): Promise<any> {
    return await this.usersService.getLogs(id, queries);
  }

  @Patch(':id/verification')
  @ResponseType({ type: Response.MODEL_USER })
  async verify(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDTO,
  ) {
    return await this.usersService.updateEmailVerification(id, input);
  }

  @Patch(':id/verification/phone')
  @ResponseType({ type: Response.MODEL_USER })
  async verifyPhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDTO,
  ) {
    return await this.usersService.updatePhoneVerification(id, input);
  }

  @Get(':id/targets/:targetId')
  @ResponseType({ type: Response.MODEL_TARGET })
  async getTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
  ): Promise<any> {
    return await this.usersService.getTarget(id, targetId);
  }

  @Patch(':id/targets/:targetId')
  @ResponseType({ type: Response.MODEL_TARGET })
  async updateTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() input: UpdateTargetDTO,
  ): Promise<any> {
    return await this.usersService.updateTarget(id, targetId, input);
  }

  @Get(':id/mfa/factors')
  @ResponseType({ type: Response.MODEL_MFA_FACTORS })
  async getMfaFactors(@Param('id') id: string) {
    return await this.usersService.getMfaFactors(id);
  }

  @Get(':id/mfa/recovery-codes')
  @ResponseType({ type: Response.MODEL_MFA_RECOVERY_CODES })
  async getMfaRecoveryCodes(@Param('id') id: string) {
    return await this.usersService.getMfaRecoveryCodes(id);
  }

  @Patch(':id/mfa/recovery-codes')
  @ResponseType({ type: Response.MODEL_MFA_RECOVERY_CODES })
  async generateMfaRecoveryCodes(@Param('id') id: string) {
    return await this.usersService.generateMfaRecoveryCodes(id);
  }

  @Put(':id/mfa/recovery-codes')
  @ResponseType({ type: Response.MODEL_MFA_RECOVERY_CODES })
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
