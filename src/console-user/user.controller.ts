import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Headers,
  Req,
  Res,
  Put,
  UseInterceptors,
  ClassSerializerInterceptor,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request, Response } from 'express';
import { Exception } from 'src/core/extend/exception';
import { CreateOrgDto, UpdateOrgDto } from './dto/org.dto';
import { Public } from 'src/Utils/decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Organization } from './schemas/organization.schema';
import { Model } from 'mongoose';
import OrganizationModel, { OrganizationListModel, RolesModel } from './models/organization.model';
import { MembershipsListModel } from './models/membership.model';
import { BillingPlanModel } from './models/plan.model';

@Controller()
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(
    private readonly userService: UserService,
    @InjectModel(Organization.name, 'server') private readonly orgModel: Model<Organization>,
  ) { }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  @Public()
  findAll(@Headers() headers, @Req() req) {
    // console.log(req.user);
    return this.userService.findAll();
  }

  @Get('me')
  me(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    delete user?.session;
    return res.json(user);
  }


  @Get('organizations')
  async findOrganizations(@Query('queries') queries?: string[], @Query('search') search?: string): Promise<OrganizationListModel> {
    const data = await this.userService.findOrganizations(queries, search);
    return new OrganizationListModel(data)
  }

  @Post('organizations')
  async createOrganization(
    @Req() req: Request,
    @Body() createOrgDto: CreateOrgDto,
  ): Promise<OrganizationModel> {
    if (!createOrgDto.organizationId || !createOrgDto.name)
      throw new Exception(
        Exception.MISSING_REQUIRED_PARMS,
        'Please provide `organizationId` and `name` fields in body.',
      );
    return new OrganizationModel(await this.userService.createOrganization(req.user, createOrgDto));
  }

  @Get('organizations/:id')
  async findOneOrganization(@Param('id') id: string): Promise<OrganizationModel> {
    const org = await this.userService.findOneOrganization(id);
    if (org) {
      return new OrganizationModel(org);
    }
    throw new Exception(Exception.TEAM_NOT_FOUND, 'Organization not found.', 404);
  }

  @Put('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Req() req,
    @Body() input: UpdateOrgDto,
  ): Promise<OrganizationModel> {
    return new OrganizationModel(await this.userService.updateOrganization(id, input));
  }

  @Delete('organizations/:id')
  async deleteOrganization(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.userService.deleteOrganization(id);
    return res.status(200).json({
      success: true,
      message: 'Organization deleted successfully.',
    });
  }

  @Get('organizations/:id/prefs')
  async getOrganizationPrefs(@Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let org = await this.orgModel.findOne({ id: id }).select('prefs').exec();
    return org.prefs ?? {};
  }

  @Patch('organizations/:id/prefs')
  async updateOrganizationPrefs(@Param('id') id: string, @Req() req: Request, @Body() prefs: any, @Res() res: Response) {
    await this.orgModel.updateOne({ id: id }, { prefs: prefs }).exec();
    return prefs;
  }

  @Get('organizations/:id/aggregations')
  async findOrganizationAggregations(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // const aggs = await this.userService.findOrganizationAggregations(id, req.user.id);
    return res.json({
      total: 0,// aggs.length,
      aggregations: {} // aggs
    }).status(200)
  }

  @Get('organizations/:id/roles')
  async findOrganizationRoles(@Param('id') id: string): Promise<RolesModel> {
    // const roles = await this.userService.findOrganizationRoles(id, req.user.id);
    return new RolesModel({
      "scopes": [
        "global",
        "public",
        "home",
        "console",
        "graphql",
        "sessions.write",
        "documents.read",
        "documents.write",
        "files.read",
        "files.write",
        "locale.read",
        "avatars.read",
        "execution.write",
        "organizations.write",
        "account",
        "teams.read",
        "projects.read",
        "users.read",
        "databases.read",
        "collections.read",
        "buckets.read",
        "assistant.read",
        "functions.read",
        "execution.read",
        "platforms.read",
        "keys.read",
        "webhooks.read",
        "rules.read",
        "migrations.read",
        "vcs.read",
        "providers.read",
        "messages.read",
        "topics.read",
        "targets.read",
        "subscribers.read",
        "teams.write",
        "targets.write",
        "subscribers.write",
        "buckets.write",
        "users.write",
        "databases.write",
        "collections.write",
        "platforms.write",
        "keys.write",
        "webhooks.write",
        "functions.write",
        "rules.write",
        "migrations.write",
        "vcs.write",
        "providers.write",
        "messages.write",
        "topics.write",
        "policies.write",
        "policies.read",
        "archives.read",
        "archives.write",
        "restorations.read",
        "restorations.write",
        "billing.read",
        "billing.write",
        "projects.write"
      ],
      "roles": [
        "owner"
      ]
    })
  }

  @Get('organizations/:id/credits')
  /**
   * @todo Implement this method.
   */
  async findOrganizationCredits(@Param('id') id: string, @Req() req: Request) {
    // const credits = await this.userService.findOrganizationCredits(id, req.user.id);
    return {
      total: 0,// credits.length,
      credits: [], // credits
      available: 0
    }
  }

  @Post('organizations/:id/credits')
  /**
   * @todo Implement this method.
   * [POST]: /organization/:id/credits - Adds credits to the organization.
   * @param id - The ID of the organization to add credits to.
   * @param req - The request object containing user information.
   * @param input - The DTO containing credits details.
   * @returns The added credits details.
   */
  async addOrganizationCredits(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.addOrganizationCredits(id, req.user.id, input);
    return input;
  }

  @Patch('organizations/:id/billing-address')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/billing-address - Updates the billing address for the organization.
   * @param id - The ID of the organization to update billing address for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated billing address details.
   * @returns The updated billing address details.
   */
  async updateOrganizationBillingAddress(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationBillingAddress(id, req.user.id, input);
    return input;
  }

  @Delete('organizations/:id/billing-address')
  /**
   * @todo Implement this method.
   * [DELETE]: /organization/:id/billing-address - Deletes the billing address for the organization.
   * @param id - The ID of the organization to delete billing address for.
   * @param req - The request object containing user information.
   * @param res - The response object to send the result.
   * @returns A JSON response indicating the success of the deletion.
   */
  async deleteOrganizationBillingAddress(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // await this.userService.deleteOrganizationBillingAddress(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Billing address deleted successfully.',
    });
  }

  @Patch('organizations/:id/billing-email')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/billing-email - Updates the billing email for the organization.
   * @param id - The ID of the organization to update billing email for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated billing email details.
   * @returns The updated billing email details.
   */
  async updateOrganizationBillingEmail(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationBillingEmail(id, req.user.id, input);
    return input;
  }

  @Patch('organizations/:id/budget')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/budget - Updates the budget for the organization.
   * @param id - The ID of the organization to update budget for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated budget details.
   * @returns The updated budget details.
   */
  async updateOrganizationBudget(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationBudget(id, req.user.id, input);
    return input;
  }

  @Get('organizations/:id/invoices')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/invoices - Retrieves the invoices for the organization.
   * @param id - The ID of the organization to retrieve invoices for.
   * @param req - The request object containing user information.
   * @param res - The response object to send the invoices data.
   * @returns A JSON response with the total number of invoices and the invoices data.
   */
  async findOrganizationInvoices(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // const invoices = await this.userService.findOrganizationInvoices(id, req.user.id);
    return res.json({
      total: 0,// invoices.length,
      invoices: [] // invoices
    }).status(200)
  }

  @Patch('organizations/:id/payment-method')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/payment-method - Updates the payment method for the organization.
   * @param id - The ID of the organization to update payment method for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated payment method details.
   * @returns The updated payment method details.
   */
  async updateOrganizationPaymentMethod(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationPaymentMethod(id, req.user.id, input);
    return input;
  }

  @Delete('organizations/:id/payment-method')
  /**
   * @todo Implement this method.
   * [DELETE]: /organization/:id/payment-method - Deletes the payment method for the organization.
   * @param id - The ID of the organization to delete payment method for.
   * @param req - The request object containing user information.
   * @param res - The response object to send the result.
   * @returns A JSON response indicating the success of the deletion.
   */
  async deleteOrganizationPaymentMethod(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // await this.userService.deleteOrganizationPaymentMethod(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully.',
    });
  }

  @Get('organizations/:id/plan')
  async findOneOrganizationPlan(@Param('id') id: string): Promise<BillingPlanModel> {
    const plan = await this.userService.getOrganizationPlan(id);
    return new BillingPlanModel(plan)
  }

  @Patch('organizations/:id/plan')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/plan - Updates the plan for the organization.
   * @param id - The ID of the organization to update plan for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated plan details.
   * @returns The updated plan details.
   */
  async updateOrganizationPlan(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationPlan(id, req.user.id, input);
    return input;
  }

  @Patch('organizations/:id/taxId')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/taxId - Updates the tax ID for the organization.
   * @param id - The ID of the organization to update tax ID for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated tax ID details.
   * @returns The updated tax ID details.
   */
  async updateOrganizationTaxId(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationTaxId(id, req.user.id, input);
    return input;
  }

  @Get('organizations/:id/usage')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/usage - Retrieves the usage for the organization.
   * @param id - The ID of the organization to retrieve usage for.
   * @param req - The request object containing user information.
   * @param res - The response object to send the usage data.
   * @returns The usage if found.
   * @throws Exception if the usage is not found.
   */
  async findOneOrganizationUsage(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // const usage = await this.userService.findOneOrganizationUsage(id, req.user.id);
    // if (usage) {
    //   return res.status(200).json(usage);
    // }
    throw new Exception(null, 'Usage not found.', 404);
  }

  @Get('organizations/:id/memberships')
  async findOrganizationMemberships(
    @Param('id') id: string,
  ): Promise<MembershipsListModel> {
    const memberships = await this.userService.getOrganizationMembers(id);
    return new MembershipsListModel({
      total: memberships.length,
      memberships: memberships
    })
  }

  @Post('organizations/:id/memberships')
  /**
   * @todo Implement this method.
   * [POST]: /organization/:id/memberships - Adds memberships to the organization.
   * @param id - The ID of the organization to add memberships to.
   * @param req - The request object containing user information.
   * @param input - The DTO containing memberships details.
   * @returns The added memberships details.
   */
  async addOrganizationMemberships(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.addOrganizationMemberships(id, req.user.id, input);
    return input;
  }



  /*  ** 2 **   */

  @Get('organizations/:id/memberships/:membershipId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/memberships/:membershipId - Retrieves a single membership by its ID.
   * @param id - The ID of the organization to retrieve the membership for.
   * @param membershipId - The ID of the membership to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the membership data.
   * @returns The membership if found.
   * @throws Exception if the membership is not found.
   */
  async findOneOrganizationMembership(@Param('id') id: string, @Param('membershipId') membershipId: string, @Req() req: Request, @Res() res: Response) {
    // const membership = await this.userService.findOneOrganizationMembership(id, membershipId, req.user.id);
    // if (membership) {
    //   return res.status(200).json(membership);
    // }
    throw new Exception(null, 'Membership not found.', 404);
  }

  @Patch('organizations/:id/memberships/:membershipId')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/memberships/:membershipId - Updates the membership for the organization.
   * @param id - The ID of the organization to update membership for.
   * @param membershipId - The ID of the membership to update.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated membership details.
   * @returns The updated membership details.
   */
  async updateOrganizationMembership(@Param('id') id: string, @Param('membershipId') membershipId: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationMembership(id, membershipId, req.user.id, input);
    return input;
  }

  @Delete('organizations/:id/memberships/:membershipId')
  /**
   * @todo Implement this method.
   * [DELETE]: /organization/:id/memberships/:membershipId - Deletes the membership for the organization.
   * @param id - The ID of the organization to delete membership for.
   * @param membershipId - The ID of the membership to delete.
   * @param req - The request object containing user information.
   * @param res - The response object to send the result.
   * @returns A JSON response indicating the success of the deletion.
   */
  async deleteOrganizationMembership(@Param('id') id: string, @Param('membershipId') membershipId: string, @Req() req: Request, @Res() res: Response) {
    // await this.userService.deleteOrganizationMembership(id, membershipId, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Membership deleted successfully.',
    });
  }

  @Patch('organizations/:id/payment-method/backup')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/payment-method/backup - Updates the backup payment method for the organization.
   * @param id - The ID of the organization to update backup payment method for.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated backup payment method details.
   * @returns The updated backup payment method details.
   */
  async updateOrganizationBackupPaymentMethod(@Param('id') id: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationBackupPaymentMethod(id, req.user.id, input);
    return input;
  }

  @Delete('organizations/:id/payment-method/backup')
  /**
   * @todo Implement this method.
   * [DELETE]: /organization/:id/payment-method/backup - Deletes the backup payment method for the organization.
   * @param id - The ID of the organization to delete backup payment method for.
   * @param req - The request object containing user information.
   * @param res - The response object to send the result.
   * @returns A JSON response indicating the success of the deletion.
   */
  async deleteOrganizationBackupPaymentMethod(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    // await this.userService.deleteOrganizationBackupPaymentMethod(id, req.user.id);
    return res.status(200).json({
      success: true,
      message: 'Backup payment method deleted successfully.',
    });
  }

  @Get('organizations/:id/payment-methods/:methodId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/payment-methods/:methodId - Retrieves a single payment method by its ID.
   * @param id - The ID of the organization to retrieve the payment method for.
   * @param methodId - The ID of the payment method to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the payment method data.
   * @returns The payment method if found.
   * @throws Exception if the payment method is not found.
   */
  async findOneOrganizationPaymentMethod(@Param('id') id: string, @Param('methodId') methodId: string, @Req() req: Request, @Res() res: Response) {
    // const method = await this.userService.findOneOrganizationPaymentMethod(id, methodId, req.user.id);
    // if (method) {
    //   return res.status(200).json(method);
    // }
    throw new Exception(null, 'Payment method not found.', 404);
  }

  @Get('organizations/:id/invoices/:invoiceId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/invoices/:invoiceId - Retrieves a single invoice by its ID.
   * @param id - The ID of the organization to retrieve the invoice for.
   * @param invoiceId - The ID of the invoice to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the invoice data.
   * @returns The invoice if found.
   * @throws Exception if the invoice is not found.
   */
  async findOneOrganizationInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string, @Req() req: Request, @Res() res: Response) {
    // const invoice = await this.userService.findOneOrganizationInvoice(id, invoiceId, req.user.id);
    // if (invoice) {
    //   return res.status(200).json(invoice);
    // }
    throw new Exception(null, 'Invoice not found.', 404);
  }

  @Get('organizations/:id/billing-address/:addressId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/billing-address/:addressId - Retrieves the billing address for the organization.
   * @param id - The ID of the organization to retrieve billing address for.
   * @param addressId - The ID of the billing address to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the billing address data.
   * @returns The billing address if found.
   * @throws Exception if the billing address is not found.
   */
  async findOneOrganizationBillingAddress(@Param('id') id: string, @Param('addressId') addressId: string, @Req() req: Request, @Res() res: Response) {
    // const address = await this.userService.findOneOrganizationBillingAddress(id, addressId, req.user.id);
    // if (address) {
    //   return res.status(200).json(address);
    // }
    throw new Exception(null, 'Billing address not found.', 404);
  }


  @Get('organizations/:id/credits/:creditId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/credits/:creditId - Retrieves a single credit by its ID.
   * @param id - The ID of the organization to retrieve the credit for.
   * @param creditId - The ID of the credit to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the credit data.
   * @returns The credit if found.
   * @throws Exception if the credit is not found.
  */
  async findOneOrganizationCredit(@Param('id') id: string, @Param('creditId') creditId: string, @Req() req: Request, @Res() res: Response) {
    // const credit = await this.userService.findOneOrganizationCredit(id, creditId, req.user.id);
    // if (credit) {
    //   return res.status(200).json(credit);
    // }
    throw new Exception(null, 'Credit not found.', 404);
  }

  @Get('organizations/:id/roles/:roleId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/roles/:roleId - Retrieves a single role by its ID.
   * @param id - The ID of the organization to retrieve the role for.
   * @param roleId - The ID of the role to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the role data.
   * @returns The role if found.
   * @throws Exception if the role is not found.
  */
  async findOneOrganizationRole(@Param('id') id: string, @Param('roleId') roleId: string, @Req() req: Request, @Res() res: Response) {
    // const role = await this.userService.findOneOrganizationRole(id, roleId, req.user.id);
    // if (role) {
    //   return res.status(200).json(role);
    // }
    throw new Exception(null, 'Role not found.', 404);
  }

  @Get('organizations/:id/aggregations/:aggId')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/aggregations/:aggId - Retrieves a single aggregation by its ID.
   * @param id - The ID of the organization to retrieve the aggregation for.
   * @param aggId - The ID of the aggregation to retrieve.
   * @param req - The request object containing user information.
   * @param res - The response object to send the aggregation data.
   * @returns The aggregation if found.
   * @throws Exception if the aggregation is not found.
   */
  async findOneOrganizationAggregation(@Param('id') id: string, @Param('aggId') aggId: string, @Req() req: Request, @Res() res: Response) {
    // const agg = await this.userService.findOneOrganizationAggregation(id, aggId, req.user.id);
    // if (agg) {
    //   return res.status(200).json(agg);
    // }
    throw new Exception(null, 'Aggregation not found.', 404);
  }

  /*  *** 3 ***   */

  @Patch('organizations/:id/memberships/:membershipId/status')
  /**
   * @todo Implement this method.
   * [PATCH]: /organization/:id/memberships/:membershipId/status - Updates the status of the membership for the organization.
   * @param id - The ID of the organization to update membership status for.
   * @param membershipId - The ID of the membership to update status.
   * @param req - The request object containing user information.
   * @param input - The DTO containing updated membership status.
   * @returns The updated membership status.
   */
  async updateOrganizationMembershipStatus(@Param('id') id: string, @Param('membershipId') membershipId: string, @Req() req: Request, @Body() input: any) {
    // return await this.userService.updateOrganizationMembershipStatus(id, membershipId, req.user.id, input);
    return input;
  }

  @Get('organizations/:id/invoices/:invoiceId/download')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/invoices/:invoiceId/download - Downloads the invoice by its ID.
   * @param id - The ID of the organization to retrieve the invoice for.
   * @param invoiceId - The ID of the invoice to download.
   * @param req - The request object containing user information.
   * @param res - The response object to send the invoice file.
   * @returns The invoice file if found.
   * @throws Exception if the invoice is not found.
   */
  async downloadOrganizationInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string, @Req() req: Request, @Res() res: Response) {
    // const invoice = await this.userService.findOneOrganizationInvoice(id, invoiceId, req.user.id);
    // if (invoice) {
    //   return res.download(invoice.file);
    // }
    throw new Exception(null, 'Invoice not found.', 404);
  }

  @Get('organizations/:id/invoices/:invoiceId/view')
  /**
   * @todo Implement this method.
   * [GET]: /organization/:id/invoices/:invoiceId/view - Views the invoice by its ID.
   * @param id - The ID of the organization to retrieve the invoice for.
   * @param invoiceId - The ID of the invoice to view.
   * @param req - The request object containing user information.
   * @param res - The response object to send the invoice file.
   * @returns The invoice file if found.
   * @throws Exception if the invoice is not found.
   */
  async viewOrganizationInvoice(@Param('id') id: string, @Param('invoiceId') invoiceId: string, @Req() req: Request, @Res() res: Response) {
    // const invoice = await this.userService.findOneOrganizationInvoice(id, invoiceId, req.user.id);
    // if (invoice) {
    //   return res.sendFile(invoice.file);
    // }
    throw new Exception(null, 'Invoice not found.', 404);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Res() res: Response) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
