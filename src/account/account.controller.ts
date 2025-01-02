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
import { UpdateAccountDto } from './dto/update-account.dto';
import { LoginDto, RefreshDto, RegisterDto } from './dto/auth.dto';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';
import { UserService } from 'src/user/user.service';
import { Public } from 'src/Utils/decorator';
import { AccountModel } from './models/account.model';

@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class AccountController {
  constructor(private readonly accountService: AccountService,
    private readonly userService: UserService
  ) { }

  @Get()
  async find(@Req() req: Request): Promise<AccountModel> {
    let user = await this.accountService.findOne(req.user.$id).populate('targets')
    return new AccountModel(user);
  }

  @Public()
  @Post()
  async create(@Body() createAccountDto: CreateAccountDto): Promise<AccountModel> {
    let account = await this.accountService.create(createAccountDto);
    return new AccountModel(account);
  }

  @Delete()
  async delete(@Req() req: Request, @Res() res: Response) {
    await this.accountService.remove(req.user.id, req.user.id);
    return res.clearCookie('a_session').status(200).json()
  }

  @Get('prefs')
  async getPrefs(@Req() req: Request) {
    return await this.userService.getPrefs(req.user.id)
  }

  @Patch('prefs')
  async updatePrefs(@Req() req: Request, @Body() input: { prefs: any }) {
    if (typeof input.prefs === undefined) throw new Exception(Exception.MISSING_REQUIRED_PARMS)
    return await this.userService.updatePrefs(req.user.id, input.prefs)
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

  @Patch('name')
  /**
   * @todo: Implement the update name functionality.
   * [PATCH]: /account/name - Updates the name.
   * @param req - The request object.
   * @param res - The response object.
   * @throws Exception - If the name update fails.
   * @returns The updated name.
   **/
  async updateName(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the name.
    return res.json({}).status(200)
  }

  @Patch('phone')
  /**
   * @todo: Implement the update phone functionality.
   * [PATCH]: /account/phone - Updates the phone.
   * @param req - The request object.
   * @param res - The response object.
   * @throws Exception - If the phone update fails.
   * @returns The updated phone.  
   **/
  async updatePhone(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the phone.
    return res.json({}).status(200)
  }

  @Patch('password')
  /**
   * @todo: Implement the update password functionality.
   * [PATCH]: /account/password - Updates the password.
   * @param req - The request object.
   * @param res - The response object.
   * @throws Exception - If the password update fails.
   **/
  async updatePassword(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the password.
    return res.json({}).status(200)
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
  /**
   * @todo: Implement the get sessions functionality.
   * [GET]: /account/sessions - Retrieves the sessions.
   * @param req - The request object.
   * @returns The sessions.
   * @throws Exception - If the sessions retrieval fails.
   **/
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

  @Get('payment-methods')
  /**
   * @todo: Implement the get payment methods functionality.
   * [GET]: /account/payment-methods - Retrieves the payment methods.
   * @param req - The request object.
   * @returns The payment methods.
   * @throws Exception - If the payment methods retrieval fails.
   **/
  async getPaymentMethods(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the payment methods.
    return res.json({
      total: 0,
      methods: []
    }).status(200)
  }

  @Post('payment-methods')
  /**
   * @todo: Implement the create payment method functionality.
   * [POST]: /account/payment-methods - Creates a new payment method.
   * @param req - The request object.
   * @returns The new payment method.
   * @throws Exception - If the payment method creation fails.
   **/
  async createPaymentMethod(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the payment method.
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

  @Get('invoices')
  /**
   * @todo: Implement the get invoices functionality.
   * [GET]: /account/invoices - Retrieves the invoices.
   * @param req - The request object.
   * @returns The invoices.
   * @throws Exception - If the invoices retrieval fails.
   **/
  async getInvoices(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the invoices.
    return res.json({
      total: 0,
      data: []
    }).status(200)
  }

  @Post('jwts')
  /**
   * @todo: Implement the create JWT functionality.
   * [POST]: /account/jwts - Creates a new JWT.
   * @param req - The request object.
   * @returns The new JWT.
   * @throws Exception - If the JWT creation fails.
   **/
  async createJwt(@Req() req: Request, @Res() res: Response) {
    // Some logic to create the JWT.
    return res.json({}).status(200)
  }

  @Get('logs')
  /**
   * @todo: Implement the get logs functionality.
   * [GET]: /account/logs - Retrieves the logs.
   * @param req - The request object.
   * @returns The logs.
   * @throws Exception - If the logs retrieval fails.
   **/
  async getLogs(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the logs.
    return res.json({
      total: 0,
      logs: []
    }).status(200)
  }

  @Patch('mfa')
  /**
   * @todo: Implement the update MFA functionality.
   * [PATCH]: /account/mfa - Updates the MFA.
   * @param req - The request object.
   * @param res - The response object.
   * @throws Exception - If the MFA update fails.
   * @returns The updated MFA.
   **/
  async updateMfa(@Req() req: Request, @Res() res: Response, @Body() input: any) {
    // Some logic to update the MFA.
    return res.json({}).status(200)
  }


  /*  ** 2 **   */

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

  @Get('payment-methods/:id')
  /**
   *  @todo: Implement the get payment method functionality.
   * [GET]: /account/payment-methods/:id - Retrieves the payment method.
   * @param req - The request object.
   * @returns The payment method.
   * @throws Exception - If the payment method retrieval fails.
   **/
  async getPaymentMethod(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the payment method.
    return res.json({}).status(200)
  }

  @Patch('payment-methods/:id')
  /**
   * @todo: Implement the update payment method functionality.
   * [PATCH]: /account/payment-methods/:id - Updates the payment method.
   * @param req - The request object.
   * @returns The updated payment method.
   * @throws Exception - If the payment method update fails.
   **/
  async updatePaymentMethod(@Req() req: Request, @Res() res: Response) {
    // Some logic to update the payment method.
    return res.json({}).status(200)
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
  /**
   * @todo: Implement the delete identity functionality.
   * [DELETE]: /account/identities/:id - Deletes the identity.
   * @param req - The request object.
   * @throws Exception - If the identity deletion fails.
   **/
  async deleteIdentity(@Req() req: Request, @Res() res: Response) {
    // Some logic to delete the identity.
    return res.json({}).status(200)
  }

  @Public()
  @Post('sessions/email')
  async createEmailSession(@Body() createEmailSessionDto: CreateEmailSessionDto, @Req() req, @Res() res: Response) {
    let session = await this.accountService.emailLogin(createEmailSessionDto, req, req.headers)
    if (session) {
      res.cookie('a_session', session.secret, { expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), httpOnly: true, sameSite: 'none', secure: true });
      return res.json(session).status(200);
    }
  }

  @Get('sessions/:id')
  /**
   * @todo: Implement the get session functionality.
   * [GET]: /account/sessions/:id - Retrieves the session.
   * @param req - The request object.
   * @returns The session.
   * @throws Exception - If the session retrieval fails.
   * @throws Exception - If the session is not found.
   **/
  async getSession(@Req() req: Request, @Res() res: Response) {
    // Some logic to get the session.
    return res.json({}).status(200)
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
