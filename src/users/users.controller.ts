import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateMfaStatusDto,
  UpdateUserEmailDto,
  UpdateUserEmailVerificationDto,
  UpdateUserLabelDto,
  UpdateUserNameDto,
  UpdateUserPasswordDto,
  UpdateUserPhoneDto,
  UpdateUserPoneVerificationDto,
  UpdateUserPrefsDto,
  UpdateUserStatusDto,
} from './dto/user.dto';
import { CreateTargetDto, UpdateTargetDto } from './dto/target.dto';
import { Response } from 'src/core/helper/response.helper';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Request } from 'express';
import { CreateTokenDto } from './dto/token.dto';
import { CreateJwtDto } from './dto/jwt.dto';

@Controller({ version: ['1'], path: 'users' })
@UseInterceptors(ResolverInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ResponseType({ type: Response.MODEL_USER, list: true })
  async findAll(
    @Query('queries') queries: string[],
    @Query('search') search: string,
  ) {
    return await this.usersService.findAll(queries, search);
  }

  @Post()
  @ResponseType({ type: Response.MODEL_USER })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Post('argon2')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithArgon2(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithArgon2(createUserDto);
  }

  @Post('bcrypt')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithBcrypt(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithBcrypt(createUserDto);
  }

  @Post('md5')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithMd5(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithMd5(createUserDto);
  }

  @Post('sha')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithSha(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithSha(createUserDto);
  }

  @Post('phpass')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithPhpass(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithPhpass(createUserDto);
  }

  @Post('scrypt')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithScrypt(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithScrypt(createUserDto);
  }

  @Post('scrypt-modified')
  @ResponseType({ type: Response.MODEL_USER })
  async createWithScryptModified(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.createWithScryptMod(createUserDto);
  }

  @Get('usage')
  @ResponseType({ type: Response.MODEL_USAGE_USERS })
  async getUsage() {
    return await this.usersService.getUsage();
  }

  @Get('identities')
  @ResponseType({ type: Response.MODEL_IDENTITY, list: true })
  async getIdentities(
    @Query('queries') queries: string[],
    @Query('search') search: string,
  ) {
    return await this.usersService.getIdentities(queries, search);
  }

  @Delete('identities/:id')
  async deleteIdentity(@Param('id') id: string) {
    return await this.usersService.deleteIdentity(id);
  }

  @Get('temp/migrate')
  async migrate() {
    return this.usersService.tempDoMigrations();
  }

  @Get('temp/unmigrate')
  async unmigrate() {
    return await this.usersService.tempUndoMigrations();
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
    @Body() input: UpdateUserPrefsDto,
  ) {
    return await this.usersService.updatePrefs(id, input.prefs);
  }

  @Patch(':id/status')
  @ResponseType({ type: Response.MODEL_USER })
  async updateStatus(
    @Param('id') id: string,
    @Body() status: UpdateUserStatusDto,
  ) {
    return await this.usersService.updateStatus(id, status);
  }

  @Put(':id/labels')
  @ResponseType({ type: Response.MODEL_USER })
  async updateLabels(
    @Param('id') id: string,
    @Body() input: UpdateUserLabelDto,
  ) {
    return await this.usersService.updateLabels(id, input);
  }

  @Patch(':id/name')
  @ResponseType({ type: Response.MODEL_USER })
  async updateName(@Param('id') id: string, @Body() input: UpdateUserNameDto) {
    return await this.usersService.updateName(id, input);
  }

  @Patch(':id/password')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePassword(
    @Param('id') id: string,
    @Body() input: UpdateUserPasswordDto,
  ) {
    return await this.usersService.updatePassword(id, input);
  }

  @Patch(':id/email')
  @ResponseType({ type: Response.MODEL_USER })
  async updateEmail(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailDto,
  ) {
    return await this.usersService.updateEmail(id, input.email);
  }

  @Patch(':id/phone')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPhoneDto,
  ) {
    return await this.usersService.updatePhone(id, input.phone);
  }

  @Patch(':id/mfa')
  @ResponseType({ type: Response.MODEL_USER })
  async updateMfa(@Param('id') id: string, @Body() input: UpdateMfaStatusDto) {
    return await this.usersService.updateMfaStatus(id, input.mfa);
  }

  @Post(':id/targets')
  @ResponseType({ type: Response.MODEL_TARGET })
  async addTarget(
    @Param('id') id: string,
    @Body() createTargetDto: CreateTargetDto,
  ): Promise<any> {
    return await this.usersService.createTarget(id, createTargetDto);
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
    @Body() input: CreateJwtDto,
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
    @Body() input: CreateTokenDto,
    @Req() req: Request,
  ): Promise<any> {
    return await this.usersService.createToken(id, input, {
      ip: req.ip,
      ua: req.headers['user-agent'],
    });
  }

  @Get(':id/logs')
  @ResponseType({ type: Response.MODEL_LOG, list: true })
  /**
   * @todo ....
   */
  async getLogs(@Param('id') id: string): Promise<any> {
    return {
      logs: [],
      total: 0,
    };
  }

  @Patch(':id/verification')
  @ResponseType({ type: Response.MODEL_USER })
  async verify(
    @Param('id') id: string,
    @Body() input: UpdateUserEmailVerificationDto,
  ) {
    return await this.usersService.updateEmailVerification(id, input);
  }

  @Patch(':id/verification/phone')
  @ResponseType({ type: Response.MODEL_USER })
  async verifyPhone(
    @Param('id') id: string,
    @Body() input: UpdateUserPoneVerificationDto,
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
    @Body() input: UpdateTargetDto,
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
