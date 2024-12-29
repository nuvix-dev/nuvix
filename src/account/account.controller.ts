import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Res, Req, UseFilters, UseGuards, Put } from '@nestjs/common';
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
import { Public } from 'src/Utils/decorator';

@Controller()
@UseFilters(new HttpExceptionFilter())
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userService: UserService
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get()
  /**
   * [GET]: /account - Retrieves the user information from the request.
   * @param req - The request object.
   * @returns The user information.
   */
  find(@Req() req) {
    return req.user;
  }

  @Public()
  @Post()
  /**
   * [POST]: /account - Creates a new account.
   * @param createAccountDto - The account information.
   * @returns The new account.
   * @throws Exception - If the account already exists.
   * @throws Exception - If the account creation fails.
   **/
  create(@Body() createAccountDto: CreateAccountDto) {
    return this.accountService.create(createAccountDto);
  }

  @Delete()
  /**
   * @todo: Implement the delete account functionality.
   * [DELETE]: /account - Deletes the account.
   * @param req - The request object.
   * @returns The account information.
   * @throws Exception - If the account deletion fails.
   **/
  delete(@Req() req: Request, @Res() res: Response) {
    // return this.accountService.delete(req.user.id);
    return res.clearCookie('a_session').status(200).json({ message: 'Logged out' })
  }

  @Get('billing-addresses')
  /**
   * @todo: Implement the get billing addresses functionality.
   * [GET]: /account/billing-addresses - Retrieves the billing addresses.
   * @param req - The request object.
   * @returns The billing addresses.
   * @throws Exception - If the billing addresses retrieval fails.
   * @throws Exception - If the billing addresses are not found.
   **/
  async getBillingAddresses(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the billing addresses.
    return res.json({
      total: 0,
      data: []
    }).status(200)
  }

  @Post('billing-addresses')
  /**
   * @todo: Implement the create billing address functionality.
   * [POST]: /account/billing-addresses - Creates a new billing address.
   * @param req - The request object.
   * @returns The new billing address.
   * @throws Exception
   **/
  async createBillingAddress(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to create the billing address.
    return res.json({}).status(200)
  }

  @Get('billing-addresses/:id')
  /**
   * @todo: Implement the get billing address functionality.
   * [GET]: /account/billing-addresses/:id - Retrieves the billing address.
   * @param req - The request object.
   * @returns The billing address.
   * @throws Exception - If the billing address retrieval fails.
   **/
  async getBillingAddress(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the billing address.
    return res.json({}).status(200)
  }

  @Put('billing-addresses/:id')
  /**
   * @todo: Implement the update billing address functionality.
   * [PUT]: /account/billing-addresses/:id - Updates the billing address.
   * @param req - The request object.
   * @returns The updated billing address.
   * @throws Exception - If the billing address update fails.
   **/
  async updateBillingAddress(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the billing address.
    return res.json({}).status(200)
  }

  @Delete('billing-addresses/:id')
  /**
   * @todo: Implement the delete billing address functionality.
   * [DELETE]: /account/billing-addresses/:id - Deletes the billing address.
   * @param req - The request object.
   * @throws Exception - If the billing address deletion fails.
   **/
  async deleteBillingAddress(@Req() req: Request, @Res() res: Response) {
    // Some logic to delete the billing address.
    return res.json({}).status(200)
  }

  @Patch('email')
  /**
   * @todo: Implement the update email functionality.
   * [PATCH]: /account/email - Updates the email.
   * @param req - The request object.
   * @param res - The response object.
   **/
  async updateEmail(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the email.
    return res.json({}).status(200)
  }

  @Get('identities')
  /**
   * @todo: Implement the get identities functionality.
   * [GET]: /account/identities - Retrieves the identities.
   * @param req - The request object.
   **/
  async getIdentities(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the identities.
    return res.json({
      total: 0,
      data: []
    }).status(200)
  }

  @Public()
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
