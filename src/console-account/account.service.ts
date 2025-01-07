import { Headers, Injectable, Logger, Req, Res } from '@nestjs/common';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto, UpdatePhoneDto } from './dto/update-account.dto';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserService } from 'src/console-user/user.service';
import emailValidator from 'src/core/validators/common.validator';
import { Request, Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Identities, Session, SessionDocument } from './schemas/account.schema';
import mongoose, { Model } from 'mongoose';
import { Target, User, UserDocument } from 'src/console-user/schemas/user.schema';
import { JwtService } from '@nestjs/jwt';
import { Exception } from 'src/core/extend/exception';
import { ID } from 'src/core/helper/ID.helper';
import { CreateEmailSessionDto } from './dto/create-email-session.dto';
import Permission from 'src/core/helper/permission.helper';
import Role from 'src/core/helper/role.helper';
import { validate } from 'class-validator';
import Permissions from 'src/core/validators/permissions.validator';
import { BillingAddress } from 'src/console-user/schemas/billing.schema';
import { CreateBillingAddressDto, UpdateBillingAddressDto } from './dto/billing.dto';
import { Organization } from 'src/console-user/schemas/organization.schema';
import { Invoice } from 'src/console-user/schemas/invoce.schema';
import { Log } from 'src/console-user/schemas/log.schema';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name)

  constructor(
    private readonly userSerice: UserService,
    @InjectModel(Session.name, 'server') private readonly sessionModel: Model<Session>,
    @InjectModel(User.name, 'server') private readonly userModel: Model<User>,
    @InjectModel(Organization.name, 'server') private readonly orgModel: Model<Organization>,
    @InjectModel(Invoice.name, 'server') private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Target.name, 'server') private readonly targetModel: Model<Target>,
    @InjectModel(Identities.name, 'server') private readonly identityModel: Model<Identities>,
    @InjectModel(BillingAddress.name, 'server') private readonly billingModel: Model<BillingAddress>,
    @InjectModel(Log.name, 'server') private readonly logModel: Model<Log>,
    private jwtService: JwtService
  ) { }

  /**
   * Create Account for User
   */
  async create(createAccountDto: CreateAccountDto) {
    validate(createAccountDto).then(errors => {
      if (errors.length > 0) {
        throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID)
      }
    })
    let userId = createAccountDto.userId === 'unique()' ? ID.unique() : createAccountDto.userId;
    try {
      let user = await this.userModel.create({
        id: userId,
        name: createAccountDto.name,
        email: createAccountDto.email,
        password: await this.userSerice.hashPassword(createAccountDto.password), // Hash the password
        registration: new Date(),
        status: true,
        $permissions: [
          Permission.Read(Role.Any()).toString(),
          Permission.Update(Role.User(userId)).toString(),
          Permission.Delete(Role.User(userId)).toString(),
        ]
      })
      await user.save()
      let target = await this.targetModel.create({
        id: ID.unique(),
        userId: user.$id,
        userInternalId: user._id,
        providerType: 'email',
        identifier: createAccountDto.email,
        $permissions: [
          Permission.Read(Role.User(userId)).toString(),
          Permission.Update(Role.User(userId)).toString(),
          Permission.Delete(Role.User(userId)).toString(),
        ]
      })
      await target.save()
      user.targets.push(target)
      await user.save()
      return user
    } catch (e) {
      this.logger.error(e)
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  /**
   * Update the name of a user
   */
  async updateName(user: UserDocument, name: string) {
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    user.name = name
    await user.save()
    return user
  }

  /**
   * Update the phone of a user
   */
  async updatePhone(user: UserDocument, updatePhoneDto: UpdatePhoneDto) {
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    let isPasswordValid = await this.userSerice.comparePasswords(updatePhoneDto.password, user.password);
    if (!isPasswordValid) {
      throw new Exception(Exception.USER_PASSWORD_MISMATCH)
    }
    user.phone = updatePhoneDto.phone
    await user.save()
    return user
  }

  /**
   * Update the password of a user
   */
  async updatePassword(user: UserDocument, password: string, oldPassword: string) {
    if (!user) {
      throw new Exception(Exception.USER_NOT_FOUND)
    }
    let isPasswordValid = await this.userSerice.comparePasswords(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new Exception(Exception.USER_PASSWORD_MISMATCH)
    }
    user.password = await this.userSerice.hashPassword(password)
    await user.save()
    return user;
  }

  /**
   * Get Session by id
   */
  async getSession(id: string) {
    let session = await this.sessionModel.findOne({ id })
    if (!session) {
      throw new Exception(Exception.USER_SESSION_NOT_FOUND)
    }
    return session
  }

  /**
   * Get all the billing addresses of a user
   */
  async getBillingAddresses(userId: string) {
    let addresses = await this.billingModel.find({ userId })
    return {
      total: addresses.length,
      billingAddresses: addresses
    }
  }

  /**
   * Create a billing address for a user
   */
  async createBillingAddress(input: CreateBillingAddressDto, userId: string) {
    try {
      let address = await this.billingModel.create({
        id: ID.unique(),
        userId: userId,
        country: input.country,
        streetAddress: input.streetAddress,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        addressLine2: input.addressLine2
      })
      await address.save()
      return address
    } catch (e) {
      // TODO: Log the error
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  /**
   * Get a billing address for a user
   */
  async getBillingAddress(id: string) {
    let address = await this.billingModel.findOne({ id })
    if (!address) {
      throw new Exception(Exception.GENERAL_NOT_FOUND)
    }
    return address
  }

  /**
   * Update a billing address for a user
   */
  async updateBillingAddress(id: string, input: UpdateBillingAddressDto) {
    let address = await this.billingModel.findOne({ id })
    if (!address) {
      throw new Exception(Exception.GENERAL_NOT_FOUND)
    }

    try {
      if (input.country !== undefined) address.country = input.country;
      if (input.streetAddress !== undefined) address.streetAddress = input.streetAddress;
      if (input.city !== undefined) address.city = input.city;
      if (input.state !== undefined) address.state = input.state;
      if (input.postalCode !== undefined) address.postalCode = input.postalCode;
      if (input.addressLine2 !== undefined) address.addressLine2 = input.addressLine2;

      await address.save();
      return address;
    } catch (e) {
      throw new Exception(Exception.UPDATE_FAILED)
    }
  }

  /**
   * Delete a billing address for a user
   */
  async deleteBillingAddress(id: string) {
    let address = await this.billingModel.findOneAndDelete({ id })
    if (!address) {
      throw new Exception(Exception.GENERAL_NOT_FOUND)
    }
    return {} // Return empty object
  }

  /**
   * Get Identities of a user
   */
  async getIdentities(userInternalId: mongoose.Types.ObjectId) {
    let identities = await this.identityModel.find({ userInternalId })
    return {
      total: identities.length,
      identities: identities
    }
  }

  /**
   * Delete an identity of a user
   */
  async deleteIdentity(id: string) {
    let identity = await this.identityModel.findOneAndDelete({ id })
    if (!identity) {
      throw new Exception(Exception.GENERAL_NOT_FOUND)
    }
    return {} // Return empty object
  }

  /**
   * List all the Invoices of a user
   */
  async getInvoices(userInternalId: mongoose.Types.ObjectId) {
    let invoices = await this.invoiceModel.find({ userInternalId })
    return {
      total: invoices.length,
      invoices
    }
  }

  /**
   * Get Logs of a user
   */
  async getLogs(userInternalId: mongoose.Types.ObjectId) {
    let logs = await this.logModel.find({ userInternalId })
    return {
      total: logs.length,
      logs: logs
    }
  }

  /**
   * Update MFA of a user
   */
  async updateMfa(user: UserDocument, mfa: boolean) {
    user.mfa = mfa
    await user.save()
    return user
  }

  findOne(id: string) {
    return this.userModel.findOne({ id: id });
  }

  update(id: number, updateAccountDto: UpdateAccountDto) {
    return `This action updates a #${id} account`;
  }

  async remove(id: string, user: UserDocument) {
    let isValid = new Permissions(0, [Permission.Delete(Role.User(user.$id)).toString()]).isValid(user.$permissions)
    if (!isValid) {
      throw new Exception(Exception.GENERAL_ACCESS_FORBIDDEN)
    }
    await this.targetModel.deleteMany({ userInternalId: user._id })
    await user.deleteOne()
  }

  async emailLogin(input: CreateEmailSessionDto, req: Request, headers: Request["headers"]): Promise<SessionDocument> {
    if (input.email !== undefined && input.password !== undefined && emailValidator(input.email)) {
      let user = await this.userSerice.findOneByEmail(input.email);
      if (!user || !user.password) {
        throw new Exception(Exception.USER_NOT_FOUND)
      }
      let isPasswordValid = await this.userSerice.comparePasswords(input.password, user.password);
      if (isPasswordValid) {
        let session = await this.createSession(user, req, headers);
        if (!session.success) {
          throw new Exception(undefined, "Session creation failed.", 200)
        }
        return session.session
      } else {
        throw new Exception(Exception.USER_PASSWORD_MISMATCH)
      }
    }
  }

  async login(loginDto: LoginDto, @Res() res: Response, @Req() req: Request, @Headers() headers: Request["headers"]) {
    if (loginDto.email !== undefined && loginDto.password !== undefined && emailValidator(loginDto.email)) {
      let user = await this.userSerice.findOneByEmail(loginDto.email);
      if (!user || !user.password) {
        return res.json({
          success: false,
          message: "User not found"
        })
      }
      let isPasswordValid = await this.userSerice.comparePasswords(loginDto.password, user.password);
      if (isPasswordValid) {
        let session = await this.createSession(user, req, headers);
        if (!session.success) {
          throw new Exception(undefined, "Session creation failed.", 200)
        }
        return res.json({
          success: true,
          message: "Login successful",
          session: session.session
        })
      } else {
        throw new Exception(Exception.USER_PASSWORD_MISMATCH)
      }
    }
  }

  async register(registerDto: RegisterDto, @Res() res: Response) {
    if (!registerDto.email || !registerDto.password) {
      throw new Exception(Exception.ATTRIBUTE_VALUE_INVALID)
    }
    try {
      let user = await this.userSerice.create(registerDto);
      if (user.$isValid)
        return res.json({
          success: true,
          message: "User created successfully"
        })
      else {
        return res.json({
          success: false,
          message: "User not created"
        })
      }
    } catch (e) {
      return res.json({
        success: false,
        message: "An error ocured while creating User."
      })
    }
  }

  async refreshToken(token: string) {
    if (!token) throw new Exception(null, 'Please include refreshToken in body to refresh the access token.', 401)
    try {
      // let session = await this.sessionModel.findOne({ where: { refreshToken: token } })
      // if (session && session.refreshTokenExpires > new Date()) {
      //   session.accessToken = this.jwtService.sign({ _id: session.id })
      //   await session.accessTokensave()
      //   return session.
      // } else throw new Exception(null, 'Refresh token expired or session invalid.', 403)
    } catch (err: any) {
      if (err instanceof Exception) {
        throw err
      } else throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  async createSession(user: UserDocument, @Req() req: Request, @Headers() headers: Request["headers"],) {
    let userAgent = headers['user-agent'];
    let ipAddress = req.ip;
    let location = req.headers['cf-ipcountry'];
    let device = req.headers['device'];

    try {
      let session = await this.sessionModel.create({
        userId: user.id,
        userInternalId: user._id,
        provider: 'email',
        userAgent: userAgent,
        ip: ipAddress,
        countryName: location,
        deviceName: device,
        secret: "--",
        expire: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        $permissions: [
          Permission.Read(Role.User(user.id)),
          Permission.Update(Role.User(user.id)),
          Permission.Delete(Role.User(user.id))
        ]
      })
      if (!session || !session.$isValid) throw new Error("Session validation error.");
      session.secret = this.jwtService.sign({ _id: session.id })
      await session.save()
      return {
        success: true,
        session: session
      }
    } catch (e) {
      this.logger.error('[SESSION:CREATE] ', e)
      return {
        success: false,
        message: "An error occured while creating session."
      }
    }
  }
}
