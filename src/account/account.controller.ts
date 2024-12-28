import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, Req, UseFilters } from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { HttpExceptionFilter } from 'src/core/filters/http-exception.filter';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';

@Controller()
@UseFilters(new HttpExceptionFilter())
export class AccountController {
  constructor(private readonly accountService: AccountService) { }

  @Post()
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @Get()
  findAll() {
    return { "$id": "6746b3792c8979b5a6f3", "$createdAt": "2024-11-27T05:51:53.183+00:00", "$updatedAt": "2024-12-27T07:17:00.635+00:00", "name": "Hansraj Saini", "registration": "2024-11-27T05:51:53.182+00:00", "status": true, "labels": [], "passwordUpdate": "", "email": "hansraj1111saini@gmail.com", "phone": "", "emailVerification": true, "phoneVerification": false, "mfa": false, "prefs": { "notificationPrefs": { "modal:databaseBackups": { "hideCount": 0, "state": "hidden", "expiry": 1764223042597 } } }, "targets": [{ "$id": "6746b379352af34551c0", "$createdAt": "2024-11-27T05:51:53.217+00:00", "$updatedAt": "2024-11-27T05:51:53.217+00:00", "name": "", "userId": "6746b3792c8979b5a6f3", "providerId": null, "providerType": "email", "identifier": "hansraj1111saini@gmail.com", "expired": false }], "accessedAt": "2024-12-27T07:17:00.631+00:00", "paymentMethod": null, "paymentMethods": [{ "providerMethodId": null, "userId": "6746b3792c8979b5a6f3", "userInternalId": "200948", "providerUserId": "cus_RS0OkySuQ0HM2k", "clientSecret": "seti_1QZ6OBGYD1ySxNCyArvM61BH_secret_RS0Oz0PbWBnQnZqEBtvcoHEWpHGBjQM", "lastError": null, "name": null, "last4": null, "country": null, "brand": null, "expiryYear": null, "expiryMonth": null, "expired": false, "failed": false, "default": false, "mandateCreated": null, "mandateId": null, "mandateStatus": null, "$id": "676915ffd2feefe2bd39", "$internalId": "38498", "$createdAt": "2024-12-23T07:49:19.865+00:00", "$updatedAt": "2024-12-23T07:49:19.865+00:00", "$permissions": ["read(\"user:6746b3792c8979b5a6f3\")", "update(\"user:6746b3792c8979b5a6f3\")", "delete(\"user:6746b3792c8979b5a6f3\")"], "$collection": "paymentMethods" }] }
  }

  @Post('sessions/email')
  async createEmailSession(@Body() createEmailSessionDto: CreateEmailSessionDto, @Req() req, @Res() res: Response) {
    let session = await this.accountService.emailLogin(createEmailSessionDto, req, req.headers)
    if (session) {
      res.cookie('a_session', session.id, { expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), httpOnly: true, sameSite: 'none', secure: true });
      return res;
    }
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
