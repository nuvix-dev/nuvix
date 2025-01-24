import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseInterceptors,
} from '@nestjs/common';
import { AccountService } from './account.service';
import {
  ResolverInterceptor,
  ResponseType,
} from 'src/core/resolver/response.resolver';
import { Response } from 'src/core/helper/response.helper';
import { User } from 'src/core/resolver/user.resolver';
import { Document } from '@nuvix/database';
import {
  CreateAccountDTO,
  UpdateEmailDTO,
  UpdateNameDTO,
  UpdatePhoneDTO,
  UpdatePrefsDTO,
} from './DTO/account.dto';
import { Exception } from 'src/core/extend/exception';

@Controller({ version: ['1'], path: 'console/account' })
@UseInterceptors(ResolverInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Post()
  @ResponseType({ type: Response.MODEL_USER })
  async createAccount(
    @Body() input: CreateAccountDTO,
    @User() user: Document,
    @Request() req: any,
  ) {
    return await this.accountService.createAccount(
      input.userId,
      input.email,
      input.password,
      input.name,
      req,
      user,
    );
  }

  @Get()
  @ResponseType({ type: Response.MODEL_USER })
  async getAccount(@User() user: Document) {
    if (user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }

    return user;
  }

  @Get('prefs')
  @ResponseType({ type: Response.MODEL_PREFERENCES })
  getPrefs(@User() user: Document) {
    if (!user || user.isEmpty()) throw new Exception(Exception.USER_NOT_FOUND);

    return user.getAttribute('prefs', {});
  }

  @Patch('prefs')
  @ResponseType({ type: Response.MODEL_PREFERENCES })
  async updatePrefs(@User() user: Document, @Body() input: UpdatePrefsDTO) {
    if (!user || user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return await this.accountService.updatePrefs(user, input.prefs);
  }

  @Patch('email')
  @ResponseType({ type: Response.MODEL_USER })
  async updateEmail(
    @User() user: Document,
    @Body() updateEmailDto: UpdateEmailDTO,
  ) {
    if (!user || user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return await this.accountService.updateEmail(user, updateEmailDto);
  }

  @Patch('name')
  @ResponseType({ type: Response.MODEL_USER })
  async updateName(@User() user: Document, @Body() input: UpdateNameDTO) {
    if (!user || user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    return await this.accountService.updateName(user, input);
  }

  @Patch('phone')
  @ResponseType({ type: Response.MODEL_USER })
  async updatePhone(
    @User() user: Document,
    @Body() updatePhoneDto: UpdatePhoneDTO,
  ) {
    if (!user || user.isEmpty()) {
      throw new Exception(Exception.USER_NOT_FOUND);
    }
    await this.accountService.updatePhone(user, updatePhoneDto);
  }
}
