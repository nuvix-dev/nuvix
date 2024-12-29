import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, Req, UseFilters, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { HttpExceptionFilter } from 'src/core/filters/http-exception.filter';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UserService } from 'src/user/user.service';

@Controller()
@UseFilters(new HttpExceptionFilter())
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userService: UserService
  ) { }

  @Post()
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  find(@Req() req) {
    return req.user;
  }

  @Post('sessions/email')
  async createEmailSession(@Body() createEmailSessionDto: CreateEmailSessionDto, @Req() req, @Res() res: Response) {
    let session = await this.accountService.emailLogin(createEmailSessionDto, req, req.headers)
    if (session) {
      res.cookie('a_session', session.accessToken, { expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), httpOnly: true, sameSite: 'none', secure: true });
      return res.json(session).status(200);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('prefs')
  async getPrefs(@Res() res, @Req() req: Request) {
    return res.json(await this.userService.getPrefs(req.user.id)).status(200)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('prefs')
  async updatePrefs(@Res() res, @Req() req: Request, @Body() input: { prefs: any }) {
    if (typeof input.prefs === undefined) throw new Exception(Exception.MISSING_REQUIRED_PARMS)
    return await res.jsone(await this.userService.updatePrefs(req.user.id, input.prefs)).status(200)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountService.update(+id, updateAccountDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.accountService.remove(+id);
  }

  @Post('login')
  login(@Body() loginDto: LoginDto, @Headers() headers: Request["headers"], @Res() res, @Req() req) {
    return this.accountService.login(loginDto, res, req, headers);
  }

  @Post('register')
  register(@Body() registerDto: RegisterDto, @Res() res) {
    return this.accountService.register(registerDto, res);
  }

  @Post('refresh')
  async refresh(@Body() refreshDto: RefreshDto, @Res() res: Response) {
    let token = await this.accountService.refreshToken(refreshDto.refreshToken)
    return res.json({
      accessToken: token
    }).status(200)
  }
}
