import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Res,
  Req,
  Put,
  UseInterceptors,
  ClassSerializerInterceptor
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto, UpdateEmailDto, UpdateNameDto, UpdatePasswordDto, UpdatePhoneDto } from './dto/update-account.dto';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';
import { UserService } from 'src/console-user/user.service';
import { Public } from 'src/Utils/decorator';
import { AccountModel } from './models/account.model';
import { User } from 'src/console-user/decorators';
import { UserDocument, User as UserSchema } from 'src/console-user/schemas/user.schema';
import { CreateBillingAddressDto, UpdateBillingAddressDto } from './dto/billing.dto';
import { BillingAddressListModel, BillingAddressModel } from 'src/console-user/models/billing.model';
import { IdentitieListModel } from './models/identitie.model';
import { InvoicesListModel } from 'src/console-user/models/invoice.model';
import { LogsListModel } from 'src/console-user/models/log.model';
import { PaymentMethodListModel, PaymentMethodModel } from 'src/console-user/models/payment.model';
import { UpdatePaymentMethodDto } from './dto/payment.dto';
import { SessionModel } from './models/session.model';
import { Auth } from './auth';

@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userService: UserService,
  ) { }

  @Get()
  async find(@User() user: UserDocument): Promise<AccountModel> {
    await user.populate(['targets', 'memberships'])
    return new AccountModel(user);
  }

  @Public()
  @Post()
  async create(@Body() createAccountDto: CreateAccountDto): Promise<AccountModel> {
    let account = await this.accountService.create(createAccountDto);
    return new AccountModel(account);
  }

  @Delete()
  async delete(@User() user: UserDocument, @Res({ passthrough: true }) res: Response) {
    await this.accountService.remove(user.id, user);
    res.clearCookie('a_session')
    return {}
  }

  @Get('prefs')
  getPrefs(@User() user: UserDocument) {
    return user.prefs
  }

  @Patch('prefs')
  async updatePrefs(@User() user: UserDocument, @Body() input: { prefs: any }) {
    if (typeof input.prefs === undefined) throw new Exception(Exception.MISSING_REQUIRED_PARMS)
    user.prefs = input.prefs
    await user.save()
    return user.prefs ?? {}
  }

  @Patch('email')
  async updateEmail(@User() user: UserDocument, @Body() updateEmailDto: UpdateEmailDto): Promise<AccountModel> {
    return new AccountModel(await this.userService.updateEmail(user.id, updateEmailDto))
  }

  @Patch('name')
  async updateName(@User() user: UserDocument, @Body() input: UpdateNameDto): Promise<AccountModel> {
    return new AccountModel(await this.accountService.updateName(user, input.name))
  }

  @Patch('phone')
  async updatePhone(@User() user: UserDocument, @Body() updatePhoneDto: UpdatePhoneDto): Promise<AccountModel> {
    return new AccountModel(await this.accountService.updatePhone(user, updatePhoneDto))
  }

  @Patch('password')
  async updatePassword(@User() user: UserDocument, @Body() input: UpdatePasswordDto): Promise<AccountModel> {
    return new AccountModel(await this.accountService.updatePassword(user, input.password, input.oldPassword))
  }

  @Post('recovery')
  /**
   * @todo: Implement the create recovery functionality.
   * [POST]: /account/recovery - Creates a new recovery.
   * @param req - The request object.
   * @returns The new recovery.
   * @throws Exception - If the recovery creation fails.
   **/
  async createRecovery(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the recovery.
    return res.json({}).status(200)
  }

  @Put('recovery')
  /**
   * @todo: Implement the update recovery functionality.
   * [PUT]: /account/recovery - Updates the recovery.
   * @param req - The request object.
   * @returns The updated recovery.
   * @throws Exception - If the recovery update fails.
   **/
  async updateRecovery(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the recovery.
    return res.json({}).status(200)
  }

  @Get('sessions')
  async getSessions(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the sessions.
    return res.json({
      total: 0,
      sessions: []
    }).status(200)
  }

  @Delete('sessions')
  /**
   * @todo: Implement the delete sessions functionality.
   * [DELETE]: /account/sessions - Deletes the sessions.
   * @param req - The request object.
   * @throws Exception - If the sessions deletion fails.
   * @returns HTTP status code [200].
    **/
  async deleteSessions(@Req() req: Request, @Res() res: Response) {
    // Some logic to delete the sessions.
    return res.json({}).status(200)
  }

  @Get('billing-addresses')
  async getBillingAddresses(@User() user: UserDocument): Promise<BillingAddressListModel> {
    let data = await this.accountService.getBillingAddresses(user.id)
    return new BillingAddressListModel(data)
  }

  @Post('billing-addresses')
  async createBillingAddress(@Body() input: CreateBillingAddressDto, @User() user: UserDocument): Promise<BillingAddressModel> {
    let data = await this.accountService.createBillingAddress(input, user.id)
    return new BillingAddressModel(data)
  }

  @Get('payment-methods')
  async getPaymentMethods(@User() user: UserDocument): Promise<PaymentMethodListModel> {
    return new PaymentMethodListModel(await this.userService.getPaymentMethods(user.id))
  }

  @Post('payment-methods')
  /**
   * @todo: Implement the create payment method functionality.
   **/
  async createPaymentMethod(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the payment method.
    return res.json({}).status(200)
  }

  @Get('identities')
  async getIdentities(@User() user: UserDocument): Promise<IdentitieListModel> {
    return new IdentitieListModel(await this.accountService.getIdentities(user._id))
  }

  @Get('invoices')
  async getInvoices(@User() user: UserDocument): Promise<InvoicesListModel> {
    return new InvoicesListModel(await this.accountService.getInvoices(user._id))
  }

  @Post('jwts')
  /**
   * @todo: Implement the create JWT functionality.
   **/
  async createJwt(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the JWT.
    return res.json({}).status(200)
  }

  @Get('logs')
  async getLogs(@User() user: UserDocument): Promise<LogsListModel> {
    return new LogsListModel(await this.accountService.getLogs(user._id))
  }

  @Patch('mfa')
  async updateMfa(@User() user: UserDocument, @Body() input: { mfa: boolean }): Promise<AccountModel> {
    return new AccountModel(await this.accountService.updateMfa(user, input.mfa))
  }


  /*  ** 2 **   */

  @Get('billing-addresses/:id')
  async getBillingAddress(@Param('id') id: string): Promise<BillingAddressModel> {
    return new BillingAddressModel(await this.accountService.getBillingAddress(id));
  }

  @Put('billing-addresses/:id')
  async updateBillingAddress(@Param('id') id: string, @Body() input: UpdateBillingAddressDto): Promise<BillingAddressModel> {
    return new BillingAddressModel(await this.accountService.updateBillingAddress(id, input));
  }

  @Delete('billing-addresses/:id')
  async deleteBillingAddress(@Param('id') id: string) {
    return this.accountService.deleteBillingAddress(id);
  }

  @Get('payment-methods/:id')
  async getPaymentMethod(@Param('id') id: string): Promise<PaymentMethodModel> {
    return new PaymentMethodModel(await this.userService.getPaymentMethod(id));
  }

  @Patch('payment-methods/:id')
  async updatePaymentMethod(@Param('id') id: string, @Body() input: UpdatePaymentMethodDto): Promise<PaymentMethodModel> {
    return new PaymentMethodModel(await this.userService.updatePaymentMethod(id, input));
  }

  @Delete('payment-methods/:id')
  /**
   * @todo: Implement the delete payment method functionality.
   * [DELETE]: /account/payment-methods/:id - Deletes the payment method.
   * @param req - The request object.
   * @throws Exception - If the payment method deletion fails.
   * @returns HTTP status code [200].
   **/
  async deletePaymentMethod(@Req() req: Request, @Res() res: Response) {
    // Some logic to delete the payment method.
    return res.json({}).status(200)
  }

  @Delete('identities/:id')
  async deleteIdentity(@Param('id') id: string) {
    return this.accountService.deleteIdentity(id);
  }

  @Public()
  @Post('sessions/email')
  async createEmailSession(@Body() createEmailSessionDto: CreateEmailSessionDto, @Req() req, @Res({ passthrough: true }) res: Response): Promise<SessionModel> {
    let session = await this.accountService.emailLogin(createEmailSessionDto, req, req.headers)
    if (session) {
      res.cookie('a_session', session.secret, { expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), httpOnly: true, sameSite: 'none', secure: true });
      return new SessionModel(session);
    }
  }

  @Get('sessions/current')
  async getCurrentSession(@User() user: UserDocument): Promise<SessionModel> {
    console.log(user.session.$permissions, typeof user.session.$permissions)
    return new SessionModel(user.session);
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string): Promise<SessionModel> {
    return new SessionModel(await this.accountService.getSession(id));
  }

  @Post('mfa/challenge')
  /**
   * @todo: Implement the create MFA challenge functionality.
   * [POST]: /account/mfa/challenge - Creates a new MFA challenge.
   * @param req - The request object.
   * @returns The new MFA challenge.
   * @throws Exception - If the MFA challenge creation fails.
   **/
  async createMfaChallenge(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the MFA challenge.
    return res.json({}).status(200)
  }

  @Put('mfa/challenge')
  /**
   * @todo: Implement the update MFA challenge functionality.
   * [PUT]: /account/mfa/challenge - Updates the MFA challenge.
   * @param req - The request object.
   * @returns The updated MFA challenge.
   * @throws Exception - If the MFA challenge update fails.
   **/
  async updateMfaChallenge(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the MFA challenge.
    return res.json({}).status(200)
  }

  @Get('mfa/factors')
  /**
   * @todo: Implement the get MFA factors functionality.
   * [GET]: /account/mfa/factors - Retrieves the MFA factors.
   * @param req - The request object.
   * @returns The MFA factors.
   * @throws Exception - If the MFA factors retrieval fails.
   **/
  async getMfaFactors(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the MFA factors.
    return res.json({
      total: 0,
      factors: []
    }).status(200)
  }

  @Get('mfa/recovery-codes')
  /**
   * @todo: Implement the get MFA recovery codes functionality.
   * [GET]: /account/mfa/recovery-codes - Retrieves the MFA recovery codes.
   * @param req - The request object.
   * @returns The MFA recovery codes.
   * @throws Exception - If the MFA recovery codes retrieval fails.
   **/
  async getMfaRecoveryCodes(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the MFA recovery codes.
    return res.json({
      total: 0,
      codes: []
    }).status(200)
  }

  @Post('mfa/recovery-codes')
  /**
   * @todo: Implement the create MFA recovery codes functionality.
   * [POST]: /account/mfa/recovery-codes - Creates a new MFA recovery codes.
   * @param req - The request object.
   * @returns The new MFA recovery codes.
   * @throws Exception - If the MFA recovery codes creation fails.
   **/
  async createMfaRecoveryCodes(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the MFA recovery codes.
    return res.json({}).status(200)
  }

  @Patch('mfa/recovery-codes')
  /**
   * @todo: Implement the update MFA recovery codes functionality.
   * [PATCH]: /account/mfa/recovery-codes - Updates the MFA recovery codes.
   * @param req - The request object.
   * @returns The updated MFA recovery codes.
   * @throws Exception - If the MFA recovery codes update fails.
   **/
  async updateMfaRecoveryCodes(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the MFA recovery codes.
    return res.json({}).status(200)
  }

  /*  ** 3 **   */

  @Patch('payment-methods/:id/provider')
  /**
   * @todo: Implement the update payment method provider functionality.
   * [PATCH]: /account/payment-methods/:id/provider - Updates the payment method provider.
   * @param req - The request object.
   * @returns The updated payment method provider.
   * @throws Exception - If the payment method provider update fails.
   **/
  async updatePaymentMethodProvider(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the payment method provider.
    return res.json({}).status(200)
  }

  @Patch('payment-methods/:id/setup')
  /**
   * @todo: Implement the update payment method setup functionality.
   * [PATCH]: /account/payment-methods/:id/setup - Updates the payment method setup.
   * @param req - The request object.
   * @returns The updated payment method setup.
   * @throws Exception - If the payment method setup update fails.
   **/
  async updatePaymentMethodSetup(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the payment method setup.
    return res.json({}).status(200)
  }

  @Post('mfa/authenticators/:type')
  /**
   * @todo: Implement the create MFA authenticator functionality.
   * [POST]: /account/mfa/authenticators/:type - Creates a new MFA authenticator.
   * @param req - The request object.
   * @returns The new MFA authenticator.
   * @throws Exception - If the MFA authenticator creation fails.
   **/
  async createMfaAuthenticator(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the MFA authenticator.
    return res.json({}).status(200)
  }

  @Put('mfa/authenticators/:id')
  /**
   * @todo: Implement the update MFA authenticator functionality.
   * [PUT]: /account/mfa/authenticators/:id - Updates the MFA authenticator.
   * @param req - The request object.
   * @returns The updated MFA authenticator.
   * @throws Exception - If the MFA authenticator update fails.
   **/
  async updateMfaAuthenticator(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the MFA authenticator.
    return res.json({}).status(200)
  }

  @Delete('mfa/authenticators/:type')
  /**
   * @todo: Implement the delete MFA authenticator functionality.
   * [DELETE]: /account/mfa/authenticators/:type - Deletes the MFA authenticator.
   * @param req - The request object.
   * @throws Exception - If the MFA authenticator deletion fails.
   * @returns HTTP status code [200].
   **/
  async deleteMfaAuthenticator(@Req() req: Request, @Res() res: Response) {
    // Some logic to delete the MFA authenticator.
    return res.json({}).status(200)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.accountService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAccountDto: UpdateAccountDto) {
    return this.accountService.update(+id, updateAccountDto);
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
