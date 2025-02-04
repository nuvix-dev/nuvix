import { Body, Controller, Get, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';
import { Document } from '@nuvix/database';
import { CreateAccountDTO, UpdatePrefsDTO } from 'src/account/DTO/account.dto';
import { Response } from 'src/core/helper/response.helper';
import { Public } from 'src/core/resolver/guards/auth.guard';
import { ResponseType } from 'src/core/resolver/response.resolver';
import { Project } from 'src/core/resolver/project.resolver';
import { User } from 'src/core/resolver/project-user.resolver';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) { }

  @Public()
  @Post()
  @ResponseType(Response.MODEL_USER)
  async createAccount(
    @Body() input: CreateAccountDTO,
    @User() user: Document,
    @Project() project: Document,
  ) {
    return await this.accountService.createAccount(
      input.userId,
      input.email,
      input.password,
      input.name,
      user,
      project
    );
  }

  @Get()
  @ResponseType(Response.MODEL_USER)
  async getAccount(@User() user: Document) {
    return user;
  }

  @Get('prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  getPrefs(@User() user: Document) {
    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResponseType(Response.MODEL_PREFERENCES)
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    return await this.accountService.updatePrefs(user, input.prefs);
  }

}
